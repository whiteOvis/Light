#!/usr/bin/env bash
# Omarchy's graphical session need not inherit the interactive terminal PATH.
set -euo pipefail
service_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mise_data_dir="${MISE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mise}"
node_command="$mise_data_dir/shims/node"
if [[ ! -x "$node_command" ]]; then
  node_command="$(command -v node)" || { echo 'ERROR: Light requires Node.js 22.13 or newer.' >&2; exit 1; }
fi
exec "$node_command" "$service_dir/dist/daemon.mjs" serve --managed
