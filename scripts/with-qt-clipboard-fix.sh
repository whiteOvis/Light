#!/usr/bin/env bash
set -euo pipefail
overlay="${LIGHT_QT_OVERLAY:-${XDG_DATA_HOME:-$HOME/.local/share}/light-qt-security}"
(( $# )) || { echo "Usage: $0 COMMAND [ARGUMENTS...]" >&2; exit 2; }
for module in Quick WaylandClient; do
  [[ "$(pkg-config --modversion "Qt6$module")" == 6.11.2 ]] || {
    echo "Qt changed: rebuild a compatible clipboard fix before running this overlay." >&2
    exit 1
  }
  [[ -f "$overlay/lib/libQt6$module.so.6.11.2" ]] || {
    echo "Missing patched Qt library; run scripts/build-qt-clipboard-overlay.sh first." >&2
    exit 1
  }
done
export LD_LIBRARY_PATH="$overlay/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec "$@"
