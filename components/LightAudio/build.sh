#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
for dependency in g++ pkg-config; do
  command -v "$dependency" >/dev/null || { echo "Light audio requires $dependency (Arch: base-devel)." >&2; exit 1; }
done
pkg-config --atleast-version=6.8 Qt6Multimedia
build_dir="$(mktemp -d /tmp/light-audio-build.XXXXXX)"
trap 'rm -rf -- "$build_dir"' EXIT
"$(pkg-config --variable=libexecdir Qt6Core)/moc" $(pkg-config --cflags Qt6Qml Qt6Multimedia Qt6Network) "$source_dir/plugin.cpp" -o "$build_dir/plugin.moc"
g++ -std=c++17 -O2 -Wall -Wextra -Werror -shared -fPIC \
  $(pkg-config --cflags Qt6Qml Qt6Multimedia Qt6Network) -I"$build_dir" \
  "$source_dir/plugin.cpp" -o "$build_dir/liblightaudio.so" \
  $(pkg-config --libs Qt6Qml Qt6Multimedia Qt6Network)
g++ -std=c++17 -O2 -Wall -Wextra -Werror -fPIC \
  $(pkg-config --cflags Qt6Qml Qt6Multimedia Qt6Network) -I"$build_dir" "$source_dir/test.cpp" \
  -o "$build_dir/audio-test" $(pkg-config --libs Qt6Qml Qt6Multimedia Qt6Network)
"$build_dir/audio-test"
install -m 0755 "$build_dir/liblightaudio.so" "$source_dir/liblightaudio.so.new"
mv -f "$source_dir/liblightaudio.so.new" "$source_dir/liblightaudio.so"
