#!/usr/bin/env bash

set -euo pipefail

installer_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$installer_dir/manifest.json" && -d "$installer_dir/service" ]]; then
  project_dir="$installer_dir"
else
  project_dir="$(cd -- "$installer_dir/.." && pwd)"
fi

manifest_path="${installer_dir}/manifest.json"
if [[ ! -f "$manifest_path" ]]; then
  manifest_path="$installer_dir/light/manifest.json"
fi
plugin_id="$(jq -er '.id' "$manifest_path")"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}"
data_dir="${XDG_DATA_HOME:-$HOME/.local/share}"
applications_dir="$data_dir/applications"
service_path="$config_dir/systemd/user/omarchy-light-public.service"
desktop_path="$applications_dir/omarchy-light-public-oauth.desktop"
bindings_path="$config_dir/hypr/bindings.lua"

if systemctl --user is-enabled omarchy-light-public.service >/dev/null 2>&1; then
  systemctl --user disable --now omarchy-light-public.service
else
  systemctl --user stop omarchy-light-public.service >/dev/null 2>&1 || true
fi
rm -f -- "$service_path"
systemctl --user daemon-reload

if [[ "$(xdg-mime query default x-scheme-handler/omarchy)" == "omarchy-light-public-oauth.desktop" ]]; then
  fallback_path="$config_dir/omarchy/light-public/oauth-fallback.json"
  previous_handler="$(jq -r '.desktop // empty' "$fallback_path" 2>/dev/null || true)"
  if [[ -n "$previous_handler" ]]; then
    xdg-mime default "$previous_handler" x-scheme-handler/omarchy
  fi
fi
rm -f -- "$desktop_path"
if command -v update-desktop-database >/dev/null 2>&1 && [[ -d "$applications_dir" ]]; then
  update-desktop-database "$applications_dir"
fi

if [[ -f "$bindings_path" ]]; then
  node "$project_dir/service/src/shortcut-uninstaller.js" "$bindings_path"
  hyprctl reload
  config_errors="$(hyprctl configerrors)"
  if [[ -n "$config_errors" ]]; then
    echo "Hyprland reported configuration errors after removing Light's managed shortcuts:" >&2
    printf '%s\n' "$config_errors" >&2
    exit 1
  fi
fi

omarchy plugin disable "$plugin_id" >/dev/null 2>&1 || true

echo "Removed Light's user service, OAuth handler, and managed shortcuts."
echo "Your Bible cache, preferences, highlights, notes, and downloads remain in $config_dir/omarchy/light-public/."
echo "Finish removing the plugin checkout with: omarchy plugin remove $plugin_id"
