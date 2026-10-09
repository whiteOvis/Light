#pragma once
#include <QAudioBuffer>
#include <vector>
#include <cmath>
#include <algorithm>

// A bounded, decoded PCM history. Scratching uses a frozen copy while the
// original decoder keeps receiving live audio, so release never seeks a stream.
class ScratchBuffer {
public:
    int sampleRate = 0;
    std::vector<float> history;
    std::vector<float> record;
    double cursor = 0;
    double speed = 0;
    void clear() { history.clear(); record.clear(); sampleRate = 0; cursor = speed = 0; }
    void append(const QAudioBuffer &buffer) {
        const auto format = buffer.format();
        if (!buffer.isValid() || format.channelCount() < 1) return;
        if (sampleRate != format.sampleRate()) { clear(); sampleRate = format.sampleRate(); }
        const auto *data = buffer.constData<char>();
        for (int frame = 0; frame < buffer.frameCount(); ++frame) {
            for (int channel = 0; channel < 2; ++channel) {
                float value = format.normalizedSampleValue(data + frame * format.bytesPerFrame()
                    + std::min(channel, format.channelCount() - 1) * format.bytesPerSample());
                history.push_back(std::isfinite(value) ? std::clamp(value, -1.f, 1.f) : 0.f);
            }
        }
        const size_t limit = size_t(sampleRate) * 3 * 2;
        if (history.size() > limit) history.erase(history.begin(), history.end() - limit);
    }
    bool begin() {
        if (sampleRate <= 0 || history.size() < size_t(sampleRate / 10 * 2)) return false;
        record = history;
        cursor = std::max(0.0, double(record.size() / 2) - sampleRate * 0.15);
        speed = 0;
        return true;
    }
    std::vector<float> render(int frames, double targetSpeed, int outputRate) {
        std::vector<float> output(size_t(frames) * 2, 0.f);
        if (record.size() < 4 || outputRate <= 0) return output;
        const int count = int(record.size() / 2);
        for (int frame = 0; frame < frames; ++frame) {
            // Smooth velocity changes, especially at a forward/reverse boundary.
            speed += (targetSpeed - speed) * (1 - std::exp(-1.0 / (outputRate * 0.004)));
            cursor = std::clamp(cursor, 0.0, double(count - 2));
            const int index = int(cursor);
            const double fraction = cursor - index;
            const double edge = std::min({1.0, cursor / 64, (count - 2 - cursor) / 64});
            const double movement = std::min(1.0, std::abs(speed) * 25);
            for (int channel = 0; channel < 2; ++channel)
                output[size_t(frame) * 2 + channel] = float((record[index * 2 + channel] * (1 - fraction)
                    + record[(index + 1) * 2 + channel] * fraction) * edge * movement);
            cursor += speed * sampleRate / outputRate;
        }
        return output;
    }
};
