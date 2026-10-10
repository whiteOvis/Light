# Install Light

On current Omarchy Quattro, copy this command into your terminal:

```bash
omarchy plugin add https://github.com/whiteOvis/Light.git --enable
```

Open Light from the top bar, choose Sign in, and use your YouVersion account.
The backend and required JavaScript dependencies are ready to run. No npm
installation, native build, service installation, or extra setup command is
required on a standard current Omarchy installation.

Omarchy provides Node.js (22.13+ required), Quickshell, Qt Multimedia (6.10+),
`curl`, `wl-clipboard`, and `xdg-utils`. Bible reading requires a YouVersion
account and access to the YouVersion Platform API.

The command installs the current upstream branch. Marketplace verification
applies to an exact recorded commit; the standard install button will become
available only after the marketplace approves this installation path.

## Update Light

```bash
omarchy plugin update light.bible-reader
```

## Remove Light

```bash
omarchy plugin remove light.bible-reader
```

Your notes, bookmarks, permitted downloads and account data remain on the device.

## Upgrading from Light 0.6

New installations require no service setup. If you previously ran Light 0.6's
installer, see the [legacy upgrade notes](docs/UPGRADE.md) to retire its old
service while preserving your data and existing shortcuts.
