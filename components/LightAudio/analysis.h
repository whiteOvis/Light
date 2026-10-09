#pragma once
#include <QAudioBuffer>
#include <QVariantList>
#include <algorithm>
#include <array>
#include <cmath>

struct AudioMeasurements {
    std::array<double, 2> rms{};
    std::array<double, 65> peaks{};
};

inline AudioMeasurements measureAudio(const QAudioBuffer &buffer, double gain) {
    AudioMeasurements result;
    const auto format = buffer.format();
    const int frames = buffer.frameCount();
    const int channels = format.channelCount();
    if (!buffer.isValid() || frames <= 0 || channels <= 0 || format.bytesPerSample() <= 0)
        return result;
    gain = std::clamp(gain, 0.0, 1.0);
    const auto *data = buffer.constData<char>();
    for (int frame = 0; frame < frames; ++frame) {
        double peak = 0;
        for (int channel = 0; channel < channels; ++channel) {
            double sample = format.normalizedSampleValue(data
                + frame * format.bytesPerFrame() + channel * format.bytesPerSample());
            if (!std::isfinite(sample)) sample = 0;
            sample = std::clamp(sample, -1.0, 1.0) * gain;
            if (channel < 2) result.rms[channel] += sample * sample;
            peak = std::max(peak, std::abs(sample));
        }
        const int bucket = std::min(64, frame * 65 / frames);
        result.peaks[bucket] = std::max(result.peaks[bucket], peak);
    }
    for (double &rms : result.rms) rms = std::sqrt(rms / frames);
    if (channels == 1) result.rms[1] = result.rms[0];
    return result;
}
