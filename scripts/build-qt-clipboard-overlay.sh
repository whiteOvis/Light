#!/usr/bin/env bash
# Build a reversible, per-command Qt 6.11.2 overlay. Does not replace system packages.
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cache="${LIGHT_QT_BUILD_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/light-qt-security}"
overlay="${LIGHT_QT_OVERLAY:-${XDG_DATA_HOME:-$HOME/.local/share}/light-qt-security}"
jobs="${LIGHT_QT_BUILD_JOBS:-4}"
for dependency in cmake ninja g++ pkg-config python3 curl patch tar timeout; do
  command -v "$dependency" >/dev/null || { echo "Missing build dependency: $dependency" >&2; exit 1; }
done
for module in Qt6Core Qt6Gui Qt6Qml Qt6Quick Qt6WaylandClient; do
  [[ "$(pkg-config --modversion "$module")" == 6.11.2 ]] || {
    echo "This overlay requires matching Qt 6.11.2 development packages ($module differs)." >&2
    exit 1
  }
done
mkdir -p "$cache"
cd "$cache"
fetch() {
  local module="$1" checksum="$2"
  if [[ ! -f "$module.tar.gz" ]]; then
    curl -fL "https://github.com/qt/$module/archive/refs/tags/v6.11.2.tar.gz" -o "$module.tar.gz.part"
    mv "$module.tar.gz.part" "$module.tar.gz"
  fi
  printf '%s  %s\n' "$checksum" "$module.tar.gz" | sha256sum -c -
  if [[ ! -d "$module-6.11.2" ]]; then tar -xzf "$module.tar.gz"; fi
}
fetch qtdeclarative c5a6678e253b20014904187bd261d65907e40849bf6bcdcd9845f3803e5f3cd5
fetch qtbase 06cd7aa6b3ab19cb5a1664a2891ef0df960f78c97fa31b80b1d6d7ee70688414
# The installed Qt was built with Vulkan. Supply headers locally when the SDK
# development package is absent, preserving that backend in the overlay.
if [[ ! -f vulkan-headers.tar.gz ]]; then
  curl -fL https://github.com/KhronosGroup/Vulkan-Headers/archive/refs/tags/v1.4.328.tar.gz \
    -o vulkan-headers.tar.gz.part
  mv vulkan-headers.tar.gz.part vulkan-headers.tar.gz
fi
printf '%s  %s\n' 3ad56d387179b47dd632432ccf989bbb69773e1d732692b7bbad9c4d36aa1304 \
  vulkan-headers.tar.gz | sha256sum -c -
if [[ ! -d Vulkan-Headers-1.4.328 ]]; then tar -xzf vulkan-headers.tar.gz; fi
apply_fix() {
  local directory="$1" fix="$2"
  if patch --dry-run --forward -d "$directory" -p1 < "$fix" >/dev/null 2>&1; then
    patch --forward -d "$directory" -p1 < "$fix"
  else
    # Accept only an already-applied patch, not a different or stale source tree.
    patch --dry-run --reverse -d "$directory" -p1 < "$fix" >/dev/null
  fi
}
apply_fix qtdeclarative-6.11.2 "$root/security/qt/qtquick-clipboard-metadata-only.patch"
apply_fix qtbase-6.11.2 "$root/security/qt/qtwayland-bounded-read-6.11.2.patch"
for module in declarative base; do
  options=()
  if [[ "$module" == declarative ]]; then target=Quick; else
    target=WaylandClient
    options+=(-DFEATURE_vulkan=ON)
  fi
  cmake -S "qt$module-6.11.2" -B "$module-build" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release -DQT_BUILD_TESTS=OFF -DQT_BUILD_EXAMPLES=OFF \
    -DQT_BUILD_BENCHMARKS=OFF -DCMAKE_INSTALL_PREFIX="$overlay" \
    -DVulkan_INCLUDE_DIR="$cache/Vulkan-Headers-1.4.328/include" "${options[@]}"
  cmake --build "$module-build" --target "$target" -j "$jobs"
done
stage="$(mktemp -d "$cache/overlay.XXXXXX")"
trap 'rm -rf -- "$stage"' EXIT
mkdir -p "$stage/lib"
for module in Quick WaylandClient; do
  if [[ "$module" == Quick ]]; then build=declarative-build; else build=base-build; fi
  install -m 0755 "$build/lib/libQt6$module.so.6.11.2" "$stage/lib/"
  ln -s "libQt6$module.so.6.11.2" "$stage/lib/libQt6$module.so.6"
done
LD_LIBRARY_PATH="$stage/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" \
  bash "$root/scripts/validate-qt-clipboard.sh" "$cache/qtbase-6.11.2"
# Publish only after the regression checks pass. Keep the previous overlay for rollback.
if [[ -e "$overlay.previous" ]]; then
  echo "Remove or move $overlay.previous before replacing another overlay." >&2
  exit 1
fi
mkdir -p "$(dirname -- "$overlay")"
if [[ -e "$overlay" ]]; then mv "$overlay" "$overlay.previous"; fi
mv "$stage" "$overlay"
trap - EXIT
echo "Built and checked: $overlay"
echo "Use scripts/with-qt-clipboard-fix.sh COMMAND [ARGUMENTS...] to run with this overlay."
