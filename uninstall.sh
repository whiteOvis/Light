#!/usr/bin/env bash
# Saved Light data is preserved by the standard plugin removal command.
set -euo pipefail
exec omarchy plugin remove light.bible-reader "$@"
