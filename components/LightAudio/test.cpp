#include "plugin.cpp"
#include <QCoreApplication>
#include <QDataStream>
#include <QTemporaryFile>
#include <QEventLoop>
#include <QTcpServer>
#include <QTcpSocket>
#include <cassert>
#include <iostream>
int main(int argc, char **argv) {
    QCoreApplication app(argc, argv);
    // Exercise fragmented ICY data, live title changes, empty titles and stop.
    {
        QTcpServer server;
        assert(server.listen(QHostAddress::LocalHost));
        RadioMetadata metadata;
        QStringList titles;
        QEventLoop loop;
        auto block = [](const QByteArray &title) {
            QByteArray data = "StreamTitle='" + title + "';";
            data.append(QByteArray((16 - data.size() % 16) % 16, '\0'));
            return QByteArray("abcd") + char(data.size() / 16) + data;
        };
        QObject::connect(&server, &QTcpServer::newConnection, &app, [&]() {
            auto *socket = server.nextPendingConnection();
            QObject::connect(socket, &QTcpSocket::readyRead, socket, [&, socket]() {
                const auto request = socket->readAll();
                if (!request.contains("GET ")) return;
                assert(request.toLower().contains("icy-metadata: 1"));
                socket->write("HTTP/1.1 200 OK\r\nContent-Type: audio/aac\r\nicy-metaint: 4\r\n\r\n");
                const auto first = block("Artist - Song One");
                socket->write(first.left(7));
                QTimer::singleShot(20, socket, [socket, first]() { socket->write(first.mid(7)); });
                QTimer::singleShot(40, socket, [&, socket]() {
                    socket->write(QByteArray("abcd") + char(0) + block("Artist - Song Two"));
                });
                QTimer::singleShot(60, socket, [&, socket]() { socket->write(block("")); });
            });
        });
        QObject::connect(&metadata, &RadioMetadata::titleChanged, &app, [&]() {
            titles.append(metadata.title());
            if (titles.size() == 3) loop.quit();
        });
        metadata.setSource(QUrl(QString("http://127.0.0.1:%1/stream").arg(server.serverPort())));
        metadata.setActive(true);
        QTimer::singleShot(3000, &loop, &QEventLoop::quit);
        loop.exec();
        assert(titles == QStringList({"Artist - Song One", "Artist - Song Two", ""}));
        metadata.setActive(false);
        assert(metadata.title().isEmpty());
        std::cout << "ICY metadata: fragmented blocks, title changes, empty blocks and stop passed.\n";
    }
    QAudioFormat format;
    format.setSampleRate(48000);
    format.setChannelCount(2);
    format.setSampleFormat(QAudioFormat::Float);
    QByteArray data(480 * 2 * sizeof(float), '\0');
    auto *samples = reinterpret_cast<float *>(data.data());
    for (int i = 0; i < 480; ++i) {
        samples[i * 2] = 0.5f;
        samples[i * 2 + 1] = -0.25f;
    }
    QAudioBuffer buffer(data, format);
    auto measured = measureAudio(buffer, 1);
    assert(std::abs(measured.rms[0] - 0.5) < 1e-6);
    assert(std::abs(measured.rms[1] - 0.25) < 1e-6);
    for (double peak : measured.peaks) assert(std::abs(peak - 0.5) < 1e-6);
    measured = measureAudio(buffer, 0.5);
    assert(std::abs(measured.rms[0] - 0.25) < 1e-6);
    measured = measureAudio(buffer, 0);
    assert(measured.rms[0] == 0 && measured.rms[1] == 0);
    for (double peak : measured.peaks) assert(peak == 0);
    data.fill('\0');
    measured = measureAudio(QAudioBuffer(data, format), 1);
    assert(measured.rms[0] == 0 && measured.rms[1] == 0);
    format.setChannelCount(1);
    format.setSampleFormat(QAudioFormat::Int16);
    QByteArray mono(130 * sizeof(qint16), '\0');
    auto *integers = reinterpret_cast<qint16 *>(mono.data());
    for (int i = 0; i < 130; ++i) integers[i] = 16384;
    measured = measureAudio(QAudioBuffer(mono, format), 1);
    assert(std::abs(measured.rms[0] - 0.5) < 0.001);
    assert(measured.rms[0] == measured.rms[1]);
    // Scratch playback reverses decoded PCM, stays bounded, and leaves live
    // capture independent of the frozen record. No audio device is required.
    ScratchBuffer scratch;
    format.setSampleRate(48000);
    format.setChannelCount(2);
    format.setSampleFormat(QAudioFormat::Float);
    QByteArray ramp(48000 * 2 * sizeof(float), '\0');
    auto *rampSamples = reinterpret_cast<float *>(ramp.data());
    for (int i = 0; i < 48000; ++i) {
        rampSamples[i * 2] = float(i) / 48000;
        rampSamples[i * 2 + 1] = -float(i) / 48000;
    }
    assert(!scratch.begin());
    scratch.append(QAudioBuffer(ramp, format));
    assert(scratch.begin());
    auto stationary = scratch.render(480, 0, 48000);
    for (float value : stationary) assert(value == 0);
    scratch.cursor = 24000; scratch.speed = 1;
    auto forward = scratch.render(480, 1, 48000);
    assert(forward[0] > 0 && forward[958] > forward[0]);
    assert(forward[1] == -forward[0]);
    scratch.cursor = 24000; scratch.speed = -1;
    auto reverse = scratch.render(480, -1, 48000);
    assert(reverse[958] < reverse[0]);
    scratch.render(96000, -4, 48000);
    assert(scratch.cursor >= -4 && scratch.cursor <= 48000);
    const auto frozen = scratch.record;
    for (int i = 0; i < 5; ++i) scratch.append(QAudioBuffer(ramp, format));
    assert(scratch.history.size() == 48000 * 3 * 2);
    assert(scratch.record == frozen);
    scratch.clear();
    assert(!scratch.begin());

    // Exercise the actual Qt decoder -> buffer tap path, without network/audio hardware.
    QTemporaryFile wav;
    assert(wav.open());
    QDataStream out(&wav);
    out.setByteOrder(QDataStream::LittleEndian);
    const int count = 48000;
    out.writeRawData("RIFF", 4); out << quint32(36 + count * 4);
    out.writeRawData("WAVEfmt ", 8); out << quint32(16) << quint16(1) << quint16(2)
        << quint32(48000) << quint32(192000) << quint16(4) << quint16(16);
    out.writeRawData("data", 4); out << quint32(count * 4);
    for (int frame = 0; frame < count; ++frame) {
        const double wave = std::sin(frame * 2 * 3.141592653589793 * 440 / 48000);
        out << qint16(wave * 16384) << qint16(wave * 8192);
    }
    wav.flush();
    QMediaPlayer player;
    AudioTap tap;
    tap.setPlayer(&player);
    tap.setActive(true);
    QEventLoop loop;
    bool received = false;
    QObject::connect(&tap, &AudioTap::measurementsChanged, &loop, [&] {
        const auto levels = tap.levels();
        if (levels[0].toDouble() > 0.3 && levels[1].toDouble() > 0.15) {
            received = true;
            loop.quit();
        }
    });
    QTimer::singleShot(5000, &loop, &QEventLoop::quit);
    player.setSource(QUrl::fromLocalFile(wav.fileName()));
    player.play();
    loop.exec();
    assert(received);
    tap.setGain(0);
    assert(tap.levels()[0].toDouble() == 0);
    tap.setActive(false);
    assert(tap.levels()[1].toDouble() == 0);
    player.stop();
    std::cout << "Audio measurements: stereo, mono, waveform, gain and silence passed.\n";
    std::cout << "Qt decoded-audio integration passed.\n";
}
