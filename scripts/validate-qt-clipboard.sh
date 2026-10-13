#!/usr/bin/env bash
# Usage: validate-qt-clipboard.sh /path/to/patched/qtbase [--reader-only]
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${1:?Supply the patched Qt 6.11.2 qtbase source directory}"
stage="$(mktemp -d /tmp/light-clipboard-test.XXXXXX)"
trap 'rm -rf -- "$stage"' EXIT
python3 - "$source_dir/src/plugins/platforms/wayland/qwaylanddataoffer.cpp" "$stage/reader.inc" <<'PY'
import pathlib, sys
source = pathlib.Path(sys.argv[1]).read_text()
start = source.index('int QWaylandMimeData::readData(int fd, QByteArray &data) const')
end = source.index('\n}\n', start) + 3
pathlib.Path(sys.argv[2]).write_text(source[start:end])
PY
qt_include="$(pkg-config --variable=includedir Qt6Core)"
qt_version="$(pkg-config --modversion Qt6Core)"
g++ -std=c++17 -O2 -Wall -Wextra -fPIC -pthread \
  $(pkg-config --cflags Qt6Core) -I"$qt_include/QtCore/$qt_version" \
  -I"$qt_include/QtCore/$qt_version/QtCore" -I"$stage" \
  "$root/test/clipboard/wayland.cpp" -o "$stage/reader-test" $(pkg-config --libs Qt6Core)
timeout 10s "$stage/reader-test"
if [[ "${2:-}" != --reader-only ]]; then
  g++ -std=c++17 -O2 -Wall -Wextra -fPIC \
    $(pkg-config --cflags Qt6Quick Qt6Qml) "$root/test/clipboard/qtquick.cpp" \
    -o "$stage/quick-test" $(pkg-config --libs Qt6Quick Qt6Qml)
  QT_QPA_PLATFORM=offscreen QT_QPA_PLATFORMTHEME=none timeout 10s "$stage/quick-test"
fi
