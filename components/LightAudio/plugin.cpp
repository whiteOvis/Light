#include "analysis.h"
#include "scratch.h"
#include <QAudioSink>
#include <QMediaDevices>
#include <QElapsedTimer>
#include <memory>
#include <QAudioBufferOutput>
#include <QQmlExtensionPlugin>
#include <QTimer>
#include <QMediaPlayer>
#include <QPointer>
#include <QtQml/qqml.h>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QRegularExpression>

// Qt's FFmpeg backend does not expose ICY StreamTitle in QMediaMetaData.
class RadioMetadata : public QObject {
    Q_OBJECT
    Q_PROPERTY(QUrl source READ source WRITE setSource NOTIFY sourceChanged)
    Q_PROPERTY(bool active READ active WRITE setActive NOTIFY activeChanged)
    Q_PROPERTY(QString title READ title NOTIFY titleChanged)
public:
    explicit RadioMetadata(QObject *parent = nullptr) : QObject(parent) {
        retry.setSingleShot(true);
        retry.setInterval(15000);
        connect(&retry, &QTimer::timeout, this, &RadioMetadata::start);
    }
    ~RadioMetadata() override { stop(); }
    QUrl source() const { return url; }
    bool active() const { return enabled; }
    QString title() const { return text; }
    void setSource(const QUrl &value) {
        if (value == url) return;
        stop(); url = value; setTitle({});
        emit sourceChanged(); start();
    }
    void setActive(bool value) {
        if (enabled == value) return;
        stop(); enabled = value; setTitle({});
        emit activeChanged(); start();
    }
signals:
    void sourceChanged();
    void activeChanged();
    void titleChanged();
private:
    void setTitle(const QString &value) {
        if (text == value) return;
        text = value; emit titleChanged();
    }
    void stop() {
        retry.stop();
        if (reply) {
            auto *old = reply.data();
            reply = nullptr;
            disconnect(old, nullptr, this, nullptr);
            old->abort(); old->deleteLater();
        }
        pending.clear(); interval = 0; remaining = 0; metadataSize = -1;
    }
    void start() {
        if (!enabled || reply || (url.scheme() != "https" && url.scheme() != "http")) return;
        QNetworkRequest request(url);
        request.setRawHeader("Icy-MetaData", "1");
        request.setRawHeader("User-Agent", "Light/0.6");
        request.setTransferTimeout(15000);
        reply = network.get(request);
        reply->setReadBufferSize(65536);
        connect(reply, &QNetworkReply::metaDataChanged, this, [this]() {
            if (!reply || interval) return;
            if (reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() != 200) return;
            bool ok = false;
            const int size = reply->rawHeader("icy-metaint").toInt(&ok);
            if (!ok || size <= 0 || size > 1048576) { stop(); return; }
            interval = size; remaining = size;
        });
        connect(reply, &QNetworkReply::readyRead, this, [this]() {
            if (!reply || !interval) return;
            while (reply && reply->bytesAvailable() > 0) {
                if (remaining > 0) {
                    const auto bytes = reply->read(qMin<qint64>(remaining, 65536));
                    if (bytes.isEmpty()) return;
                    remaining -= bytes.size();
                } else if (metadataSize < 0) {
                    char length = 0;
                    if (!reply->getChar(&length)) return;
                    metadataSize = static_cast<unsigned char>(length) * 16;
                    if (!metadataSize) { remaining = interval; metadataSize = -1; }
                } else {
                    pending += reply->read(metadataSize - pending.size());
                    if (pending.size() < metadataSize) return;
                    const int end = pending.indexOf('\0');
                    const auto block = end < 0 ? pending : pending.left(end);
                    QString decoded = QString::fromUtf8(block);
                    if (decoded.contains(QChar::ReplacementCharacter)) decoded = QString::fromLatin1(block);
                    static const QRegularExpression pattern(
                        QStringLiteral("(?:^|;)\\s*StreamTitle='(.*?)';"),
                        QRegularExpression::DotMatchesEverythingOption);
                    const auto match = pattern.match(decoded);
                    if (match.hasMatch()) setTitle(match.captured(1).simplified());
                    pending.clear(); metadataSize = -1; remaining = interval;
                }
            }
        });
        connect(reply, &QNetworkReply::finished, this, [this]() {
            stop(); setTitle({});
            if (enabled) retry.start();
        });
    }
    QNetworkAccessManager network;
    QPointer<QNetworkReply> reply;
    QTimer retry;
    QUrl url;
    QString text;
    QByteArray pending;
    int interval = 0, remaining = 0, metadataSize = -1;
    bool enabled = false;
};

class AudioTap : public QAudioBufferOutput {
    Q_OBJECT
    Q_PROPERTY(bool scratching READ scratching NOTIFY scratchingChanged)
    Q_PROPERTY(double scratchMix READ scratchMix NOTIFY scratchMixChanged)
    Q_PROPERTY(double gain READ gain WRITE setGain NOTIFY gainChanged)
    Q_PROPERTY(QObject *player READ player WRITE setPlayer NOTIFY playerChanged)
    Q_PROPERTY(bool active READ active WRITE setActive NOTIFY activeChanged)
    Q_PROPERTY(QVariantList levels READ levels NOTIFY measurementsChanged)
    Q_PROPERTY(QVariantList waveform READ waveform NOTIFY measurementsChanged)
public:
    explicit AudioTap(QObject *parent = nullptr) : QAudioBufferOutput(parent) {
        scratchTimer.setInterval(5);
        connect(&scratchTimer, &QTimer::timeout, this, &AudioTap::pumpScratch);
        timeout.setSingleShot(true);
        timeout.setInterval(250);
        connect(&timeout, &QTimer::timeout, this, &AudioTap::clear);
        connect(this, &QAudioBufferOutput::audioBufferReceived, this,
                [this](const QAudioBuffer &buffer) {
            if (!m_active) return;
            if (!buffer.isValid()) { clear(); return; }
            if (scratch.sampleRate && scratch.sampleRate != buffer.format().sampleRate()) endScratch();
            scratch.append(buffer);
            values = measureAudio(buffer, m_gain);
            emit measurementsChanged();
            timeout.start();
        });
    }
    ~AudioTap() override { if (sink) sink->stop(); }
    bool scratching() const { return m_scratching; }
    double scratchMix() const { return mix; }
    Q_INVOKABLE bool beginScratch() {
        if (!m_active || m_scratching || !scratch.begin()) return false;
        if (sink) sink->stop();
        const auto device = QMediaDevices::defaultAudioOutput();
        QAudioFormat format;
        format.setSampleRate(scratch.sampleRate);
        format.setChannelCount(2);
        format.setSampleFormat(QAudioFormat::Float);
        if (!device.isFormatSupported(format)) return false;
        sink = std::make_unique<QAudioSink>(device, format);
        sink->setBufferSize(format.bytesForDuration(20000));
        sink->setVolume(0);
        scratchOutput = sink->start();
        if (!scratchOutput || sink->error() != QtAudio::NoError) { sink->stop(); return false; }
        outputRate = format.sampleRate();
        targetSpeed = 0;
        m_scratching = true;
        gestureClock.start();
        fadeClock.start();
        scratchTimer.start();
        emit scratchingChanged();
        return true;
    }
    Q_INVOKABLE void moveScratch(double radians, double seconds) {
        if (!m_scratching || !std::isfinite(radians) || !std::isfinite(seconds)) return;
        targetSpeed = std::clamp(radians / (std::max(0.008, seconds) * 1.8), -4.0, 4.0);
        gestureClock.restart();
    }
    Q_INVOKABLE void endScratch() {
        if (!m_scratching) return;
        m_scratching = false;
        fadeClock.restart();
        emit scratchingChanged();
    }
    double gain() const { return m_gain; }
    QObject *player() const { return m_player; }
    void setPlayer(QObject *object) {
        auto *next = qobject_cast<QMediaPlayer *>(object);
        if (next == m_player) return;
        endScratch();
        scratch.clear();
        if (m_player) { disconnect(m_player, nullptr, this, nullptr); m_player->setAudioBufferOutput(nullptr); }
        m_player = next;
        if (m_player) {
            m_player->setAudioBufferOutput(this);
            connect(m_player, &QMediaPlayer::sourceChanged, this, [this]() { endScratch(); scratch.clear(); });
        }
        clear();
        emit playerChanged();
    }
    void setGain(double gain) {
        gain = std::clamp(gain, 0.0, 1.0);
        if (gain == m_gain) return;
        m_gain = gain;
        clear();
        emit gainChanged();
    }
    bool active() const { return m_active; }
    void setActive(bool active) {
        if (active == m_active) return;
        m_active = active;
        if (!active) { endScratch(); scratch.history.clear(); }
        clear();
        emit activeChanged();
    }
    QVariantList levels() const { return {values.rms[0], values.rms[1]}; }
    QVariantList waveform() const {
        QVariantList result;
        result.reserve(65);
        for (double peak : values.peaks) result.append(peak);
        return result;
    }
signals:
    void scratchingChanged();
    void scratchMixChanged();
    void playerChanged();
    void gainChanged();
    void activeChanged();
    void measurementsChanged();
private:
    void pumpScratch() {
        if (!sink || !scratchOutput) return;
        if (sink->error() != QtAudio::NoError) {
            endScratch(); mix = 0; emit scratchMixChanged();
            sink->stop(); scratchOutput = nullptr; scratchTimer.stop(); return;
        }
        const double step = fadeClock.restart() / 30.0;
        mix = std::clamp(mix + (m_scratching ? step : -step), 0.0, 1.0);
        emit scratchMixChanged();
        sink->setVolume(m_gain * mix);
        if (!m_scratching && mix <= 0) {
            sink->stop(); scratchOutput = nullptr; scratchTimer.stop(); scratch.record.clear(); return;
        }
        // A stationary hand stops the record even without further pointer events.
        const double rate = gestureClock.elapsed() > 65 ? 0 : targetSpeed;
        const int frames = std::min(int(sink->bytesFree() / (2 * sizeof(float))), outputRate / 50);
        if (frames <= 0) return;
        auto data = scratch.render(frames, rate, outputRate);
        scratchOutput->write(reinterpret_cast<const char *>(data.data()), qint64(data.size() * sizeof(float)));
    }
    ScratchBuffer scratch;
    std::unique_ptr<QAudioSink> sink;
    QIODevice *scratchOutput = nullptr;
    QTimer scratchTimer;
    QElapsedTimer gestureClock, fadeClock;
    bool m_scratching = false;
    double mix = 0, targetSpeed = 0;
    int outputRate = 0;
    void clear() { timeout.stop(); values = {}; emit measurementsChanged(); }
    double m_gain = 1;
    bool m_active = false;
    AudioMeasurements values;
    QTimer timeout;
    QPointer<QMediaPlayer> m_player;
};

class LightAudioPlugin : public QQmlExtensionPlugin {
    Q_OBJECT
    Q_PLUGIN_METADATA(IID QQmlExtensionInterface_iid)
public:
    void registerTypes(const char *uri) override {
        qmlRegisterType<AudioTap>(uri, 1, 0, "AudioTap");
        qmlRegisterType<RadioMetadata>(uri, 1, 0, "RadioMetadata");
    }
};
#include "plugin.moc"
