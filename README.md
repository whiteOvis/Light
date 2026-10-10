# Light

A Bible reader and Christian radio player for the Omarchy top bar.

## [Install Light →](INSTALL.md)

On current Omarchy Quattro, install and enable Light with:

```bash
omarchy plugin add https://github.com/whiteOvis/Light.git --enable
```

Open Light and sign in with YouVersion to start reading. Bible reading requires
a YouVersion account and access permitted by YouVersion’s API requirements.
No Bible text or concordance data is bundled.

Light 0.7 starts its local backend automatically while its widget is loaded.
It ships the JavaScript dependencies needed at runtime. A new installation
requires no `npm ci`, native compilation, systemd service, or setup script.
Omarchy supplies Node.js (22.13+ required), Quickshell, Qt Multimedia (6.10+),
`curl`, `wl-clipboard`, and `xdg-utils`.

## Reading and radio

Read and study with tabs, highlights, notes, bookmarks, history, and permitted
offline downloads. Optional Christian radio uses standard Qt Multimedia and
retains the seven player layouts, station management, playback and volume controls.

Decoded audio meters, waveforms, record scratching, and enhanced ICY stream titles
use the optional native audio module. These enhancements are not part of the
standard installation; Qt-provided track metadata still works without it.
Advanced users can build the enhancement with
`bash components/LightAudio/build.sh` after installing `base-devel`, `pkgconf`,
and matching Qt 6 Multimedia development libraries, then reload the plugin.
A native module that cannot load does not prevent ordinary radio playback.

## Keyboard shortcuts

Global toggle defaults to **Super+B** and Verse of the Day to **Super+Alt+V**.
Light registers these for the current desktop session and removes its own
bindings when disabled. It restores them after a compositor configuration
reload without editing Hyprland configuration files. Existing bindings take
priority: if another app uses a key, choose a free key in Light's Settings.
Existing user-configured Light bindings remain untouched. All in-app shortcuts
remain available and customizable.

## Account and local data

The backend listens on loopback port 8788. Every HTTP endpoint requires a random
local client credential, rotated on backend startup and stored in the owner-only
`~/.config/omarchy/light-public/client-auth-header` file (0600 in a 0700 directory).
The widget reads the header file directly; the secret is not placed in process
arguments. The backend stops when the last widget unloads or the shell exits.
Interrupted downloads can be resumed on the next launch.

Choosing Sign in registers the `omarchy://` callback handler automatically and
preserves the previous handler for other applications. A small callback bridge
stays in the user data directory so it can forward unrelated callbacks even
after Light is removed. Light data lives in
`~/.config/omarchy/light-public/`. If you override `LIGHT_CONFIG_DIR`, use the same
value for the widget and backend. Disabling or removing the plugin preserves
saved data.

## Update and remove

```bash
omarchy plugin update light.bible-reader
```

```bash
omarchy plugin remove light.bible-reader
```

Keep the checkout at `~/.config/omarchy/plugins/light.bible-reader`; Light runs
from that directory. The marketplace verifies exact commits, while Omarchy's
Git commands follow the upstream branch. Marketplace availability of the
standard install button requires a separate maintainer approval.

For installations made using Light 0.6's setup script, see the
[upgrade notes](INSTALL.md#upgrading-from-light-06).

## Screenshots

[Open the screenshot gallery](docs/SCREENSHOTS.md).

## Development

Install development dependencies with `npm ci --prefix service`, then build the
shipped JavaScript runtime with `npm run build --prefix service`. Commit the
resulting `service/dist/` files with their source changes. CI rebuilds and checks
that they match. Run `node --test test/*.test.mjs service/test/*.test.js` and,
on Omarchy, `node scripts/validate.mjs`. The native audio build is optional:
pass `--native-audio` to validate that enhancement separately.

## License and third-party terms

Light is MIT licensed. See [LICENSE](LICENSE),
[third-party notices](THIRD_PARTY_NOTICES.md), and [security notes](SECURITY.md).
Bible text, online services and radio content have their own terms.
