// Includes the actual patched Qt readData function, extracted by the runner.
#include <QtCore/QByteArray>
#include <QtCore/QDeadlineTimer>
#include <QtCore/QDebug>
#include <QtCore/private/qcore_unix_p.h>
#include <chrono>
#include <csignal>
#include <cstdio>
#include <functional>
#include <thread>
#include <unistd.h>

using namespace std::chrono;
class QWaylandMimeData {
public:
    int readData(int fd, QByteArray &data) const;
};
#include "reader.inc"

static bool transfer(const char *name, std::function<void(int)> produce,
                     int expectedResult, qsizetype expectedSize, bool deadline = false) {
    int fds[2];
    if (pipe(fds) != 0) return false;
    std::thread writer([&] { produce(fds[1]); close(fds[1]); });
    QByteArray data;
    const auto start = steady_clock::now();
    const int result = QWaylandMimeData().readData(fds[0], data);
    const auto elapsed = duration_cast<milliseconds>(steady_clock::now() - start).count();
    close(fds[0]);
    writer.join();
    const bool sizeOk = expectedSize >= 0 ? data.size() == expectedSize
        : data.size() > 0 && data.size() <= 11;
    const bool ok = result == expectedResult && sizeOk
        && elapsed < 3000 && (!deadline || elapsed >= 1800);
    std::fprintf(stderr, "%s: %s result=%d bytes=%lld elapsed=%lldms\n",
                 ok ? "PASS" : "FAIL", name, result,
                 static_cast<long long>(data.size()), static_cast<long long>(elapsed));
    return ok;
}

int main() {
    signal(SIGPIPE, SIG_IGN);
    constexpr qsizetype cap = 16 * 1024 * 1024;
    const auto bytes = [](qsizetype size) {
        return [=](int fd) {
            QByteArray chunk(4096, 'x');
            for (qsizetype sent = 0; sent < size;) {
                const auto n = write(fd, chunk.constData(), qMin<qsizetype>(chunk.size(), size - sent));
                if (n <= 0) break;
                sent += n;
            }
        };
    };
    bool ok = transfer("empty", bytes(0), 0, 0);
    ok &= transfer("normal", bytes(100), 0, 100);
    ok &= transfer("exact cap", bytes(cap), 0, cap);
    ok &= transfer("over cap", bytes(cap + 1), -1, cap);
    ok &= transfer("continuous stream", bytes(cap * 10), -1, cap);
    ok &= transfer("idle producer", [](int) { std::this_thread::sleep_for(1200ms); }, -1, 0);
    // Data arrives faster than the idle timeout, but never reaches EOF.
    ok &= transfer("slow producer", [](int fd) {
        while (write(fd, "x", 1) == 1) std::this_thread::sleep_for(200ms);
    }, -1, -1, true);
    return ok ? 0 : 1;
}
