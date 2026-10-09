#!/usr/bin/env bash

set -euo pipefail

installer_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$installer_dir/manifest.json" && -d "$installer_dir/service" ]]; then
  project_dir="$installer_dir"
  shell_plugin_source="$installer_dir"
  template_dir="$installer_dir"
else
  project_dir="$(cd -- "$installer_dir/.." && pwd)"
  shell_plugin_source="$installer_dir/light"
  template_dir="$installer_dir"
fi
manifest_path="$shell_plugin_source/manifest.json"
plugin_id="$(jq -er '.id' "$manifest_path")"
daemon_path="$project_dir/service/src/daemon.js"
environment_path="$project_dir/service/.env"
callback_path="$project_dir/service/src/oauth-dispatch.js"
node_path="$(command -v node)"
# mise installations are versioned and can disappear on a tool update. Its
# stable shim follows the configured Node version without reinstalling Light.
mise_data_dir="${MISE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mise}"
case "$node_path" in
  "$mise_data_dir"/installs/node/*)
    if [[ -x "$mise_data_dir/shims/node" ]]; then
      node_path="$mise_data_dir/shims/node"
    fi
    ;;
esac
applications_dir="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}"
systemd_user_dir="$config_dir/systemd/user"
hypr_bindings_path="$config_dir/hypr/bindings.lua"
shell_plugin_dir="$config_dir/omarchy/plugins/$plugin_id"
desktop_name="omarchy-light-public-oauth.desktop"
desktop_path="$applications_dir/$desktop_name"
service_name="omarchy-light-public.service"
service_path="$systemd_user_dir/$service_name"

# Fail before touching installed files if an update changed the contract.
for dependency in curl jq wl-copy gio xdg-open xdg-mime omarchy quickshell; do
  command -v "$dependency" >/dev/null || {
    echo "Missing Light dependency: $dependency" >&2
    exit 1
  }
done
"$node_path" "$project_dir/scripts/validate.mjs" --static-only

install -d -m 0755 -- "$applications_dir" "$systemd_user_dir"
mkdir -p -m 0700 -- "$config_dir"
temporary_path="$(mktemp "$applications_dir/.omarchy-light-oauth.XXXXXX")"
temporary_service_path="$(mktemp "$systemd_user_dir/.omarchy-light-service.XXXXXX")"

cleanup() {
  if [[ -e "$temporary_path" ]]; then
    rm -f -- "$temporary_path"
  fi
  if [[ -e "$temporary_service_path" ]]; then
    rm -f -- "$temporary_service_path"
  fi
}
trap cleanup EXIT

sed \
  -e "s|@NODE@|$node_path|g" \
  -e "s|@CALLBACK@|$callback_path|g" \
  "$template_dir/omarchy-light-oauth.desktop.in" > "$temporary_path"
chmod 0644 "$temporary_path"
mv -- "$temporary_path" "$desktop_path"

sed \
  -e "s|@NODE@|$node_path|g" \
  -e "s|@DAEMON@|$daemon_path|g" \
  -e "s|@ENV_FILE@|$environment_path|g" \
  "$template_dir/omarchy-light.service.in" > "$temporary_service_path"
chmod 0644 "$temporary_service_path"
mv -- "$temporary_service_path" "$service_path"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$applications_dir"
fi
# Retain the previous handler so callbacks for other plugins still reach it.
previous_handler="$(xdg-mime query default x-scheme-handler/omarchy)"
state_dir="$config_dir/omarchy/light-public"
install -d -m 0700 -- "$state_dir"
if [[ "$previous_handler" != "$desktop_name" ]]; then
  jq -n --arg desktop "$previous_handler" '{desktop: $desktop}' > "$state_dir/oauth-fallback.json"
  chmod 0600 "$state_dir/oauth-fallback.json"
fi
xdg-mime default "$desktop_name" x-scheme-handler/omarchy

systemctl --user daemon-reload
systemctl --user enable "$service_name"
# The daemon executes JavaScript directly from this checkout. `enable --now`
# leaves an already-running process untouched, so restart explicitly to load
# new routes and service behavior after every install or update.
systemctl --user restart "$service_name"

# Keep the Light panel available without reaching for its bar icon. Respect an
# existing user binding rather than replacing it.
if [[ -f "$hypr_bindings_path" ]]; then
  # Preserve a current managed binding (including a user-customized key),
  # migrate only the obsolete Super+B+V form, and reject malformed markers
  # rather than deleting an ambiguous section of the user's config.
  "$node_path" "$project_dir/service/src/shortcut-installer.js" \
    "$hypr_bindings_path" "$plugin_id"
  hyprctl reload
  [[ -z "$(hyprctl configerrors)" ]] || { echo "Hyprland reported configuration errors." >&2; exit 1; }
else
  echo "Could not add SUPER+B: $hypr_bindings_path does not exist." >&2
fi

if [[ "$(realpath -m -- "$shell_plugin_source")" != "$(realpath -m -- "$shell_plugin_dir")" ]]; then
  install -d -m 0755 -- "$shell_plugin_dir/components"
  install -m 0644 -- \
    "$shell_plugin_source/manifest.json" \
    "$shell_plugin_source/qmldir" \
    "$shell_plugin_source/BarWidget.qml" \
    "$shell_plugin_source/Panel.qml" \
    "$shell_plugin_source/LightSession.qml" \
    "$shell_plugin_source/LightView.qml" \
    "$shell_plugin_dir/"
  install -m 0644 -- \
    "$shell_plugin_source/components/ApplicationContainer.qml" \
    "$shell_plugin_source/components/LightPalette.qml" \
    "$shell_plugin_source/components/qmldir" \
    "$shell_plugin_source/components/BackupControls.qml" \
    "$shell_plugin_source/components/BibleData.js" \
    "$shell_plugin_source/components/BibleSelector.qml" \
    "$shell_plugin_source/components/ElideButton.qml" \
    "$shell_plugin_source/components/I18n.js" \
    "$shell_plugin_source/components/InlineOptionPopup.qml" \
    "$shell_plugin_source/components/LightApi.qml" \
    "$shell_plugin_source/components/LightTextField.qml" \
    "$shell_plugin_source/components/LightTypography.qml" \
    "$shell_plugin_source/components/OmarchyScrollBar.qml" \
    "$shell_plugin_source/components/PassageFormat.js" \
    "$shell_plugin_source/components/PassageReader.qml" \
    "$shell_plugin_source/components/PixelButton.qml" \
    "$shell_plugin_source/components/PixelIcon.qml" \
    "$shell_plugin_source/components/PixelIconButton.qml" \
    "$shell_plugin_source/components/PixelKnob.qml" \
    "$shell_plugin_source/components/PixelNeedleMeter.qml" \
    "$shell_plugin_source/components/PixelSectionHeader.qml" \
    "$shell_plugin_source/components/PixelSlider.qml" \
    "$shell_plugin_source/components/PreferenceUtils.js" \
    "$shell_plugin_source/components/RadioPlayer.qml" \
    "$shell_plugin_source/components/RadioSkins.js" \
    "$shell_plugin_source/components/RadioStations.js" \
    "$shell_plugin_source/components/ReelDeckArt.qml" \
    "$shell_plugin_source/components/RomanCrossIcon.qml" \
    "$shell_plugin_source/components/SettingsModal.qml" \
    "$shell_plugin_source/components/SettingsControlButton.qml" \
    "$shell_plugin_source/components/SettingsToggleRow.qml" \
    "$shell_plugin_source/components/ShortcutUtils.js" \
    "$shell_plugin_source/components/StudyPanel.qml" \
    "$shell_plugin_source/components/TransientScrollBar.qml" \
    "$shell_plugin_source/components/VerseOfTheDayPopup.qml" \
    "$shell_plugin_dir/components/"
  install -d -m 0755 "$shell_plugin_dir/components/LightAudio"
  install -m 0644 "$shell_plugin_source/components/LightAudio/qmldir" \
    "$shell_plugin_source/components/LightAudio/plugins.qmltypes" \
    "$shell_plugin_dir/components/LightAudio/"
  install -m 0755 "$shell_plugin_source/components/LightAudio/liblightaudio.so" \
    "$shell_plugin_dir/components/LightAudio/liblightaudio.so.new"
  mv -f "$shell_plugin_dir/components/LightAudio/liblightaudio.so.new" \
    "$shell_plugin_dir/components/LightAudio/liblightaudio.so"
fi
# Remove the pre-0.3 process-wide panel singleton. It can outlive its bar
# widget during a shell reload and leave a full-screen input surface orphaned.
rm -f -- "$shell_plugin_dir/LightController.qml"
rm -f -- "$shell_plugin_dir/FocusDismissPanel.qml"
rm -f -- "$shell_plugin_dir/components/StrongsPopup.qml"

registered_handler="$(xdg-mime query default x-scheme-handler/omarchy)"
if [[ "$registered_handler" != "$desktop_name" ]]; then
  echo "Scheme registration did not verify successfully." >&2
  exit 1
fi

echo "Registered omarchy:// OAuth callbacks with $desktop_path"
echo "Installed and started $service_name"
echo "Installed the Omarchy shell plugin at $shell_plugin_dir"
omarchy-shell shell rescanPlugins
# A newly copied plugin must be discovered before it can be enabled.
plugin_discovered=false
for attempt in {1..25}; do
  if omarchy-shell shell listPlugins | jq -e --arg id "$plugin_id" 'any(.[]; .id == $id)' >/dev/null; then
    plugin_discovered=true
    break
  fi
  sleep 0.2
done
[[ "$plugin_discovered" == true ]] || { echo "Light was not discovered by the shell." >&2; exit 1; }
omarchy plugin enable "$plugin_id"
echo "Light is enabled in the top bar."
