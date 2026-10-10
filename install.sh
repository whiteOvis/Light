#!/usr/bin/env bash
# Compatibility helper. Standard installation performs all required setup.
set -euo pipefail
checkout="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
plugin_path="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/plugins/light.bible-reader"
if [[ "$checkout" == "$plugin_path" ]]; then
  exec omarchy plugin enable light.bible-reader
fi
exec omarchy plugin add https://github.com/whiteOvis/Light.git --enable "$@"
