# Install Light

Install the prerequisites listed below, then copy this complete command into your terminal:

```bash
(omarchy plugin add https://github.com/whiteOvis/Light.git --yes && cd "$HOME/.config/omarchy/plugins/light.bible-reader" && npm ci --prefix service && ./install.sh)
```

For a new installation on Omarchy. Already have Light? Use the [update command](#update-light).

## Before you install

Requires Omarchy/Quickshell, Node.js 22.5+, npm, Qt 6 Multimedia 6.8+, `base-devel`, `pkgconf`, `curl`, `jq`, `wl-clipboard`, and `xdg-utils`.

Bible reading requires a YouVersion account and access to the YouVersion Platform API. Sign in after installation.

The command installs the current GitHub version. You can [review the installer](install.sh) before running it. `--yes` accepts Omarchy's repository confirmation; `&&` stops setup if a step fails.

## What setup does

- Adds Light without enabling it prematurely.
- Installs the service dependencies and builds the native Qt audio module.
- Configures and starts the local Light user service.
- Registers the OAuth callback handler while retaining the previous handler.
- Preserves existing shortcuts and enables Light in the top bar after setup succeeds.

Keep the checkout at `~/.config/omarchy/plugins/light.bible-reader`: the service runs from it. Light stores its data separately in `~/.config/omarchy/light-public/`.

## Start reading

1. Open Light from the top bar.
2. Sign in with YouVersion.
3. Choose a Bible version and start reading.

## Update Light

```bash
(omarchy plugin update light.bible-reader && cd "$HOME/.config/omarchy/plugins/light.bible-reader" && npm ci --prefix service && ./install.sh)
```

If you originally installed from another checkout, update that checkout and run `npm ci --prefix service` followed by `./install.sh` there instead.

## Remove Light

For an installation made using the command above:

```bash
(cd "$HOME/.config/omarchy/plugins/light.bible-reader" && ./uninstall.sh)
```

Your saved user data remains on the device.

[Back to Light](README.md)
