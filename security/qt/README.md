# Clipboard transfer hardening

Light's book-search field at `bc6621ace6e96408b2990547af19ce0bbceca66a`
uses Qt Quick's `TextInput`. Qt 6.11.2 and Qt 6.12.0 release sources fetch
clipboard text in both the automatic `q_canPasteChanged()` handler and the
lazy `canPaste()` getter. The field's 100-character limit applies after a
transfer and does not limit the transfer itself. These Qt versions also have
a Wayland clipboard reader without a byte cap or overall transfer deadline.

This is a Qt dependency issue shared by other editable controls in the shell.
Replacing the field with `TextField`, limiting input length, or intercepting
paste shortcuts does not remove the automatic read.

## Fixes

Light now uses `ClipboardTextEdit`, based on plain-text `TextEdit`, for its
editable fields. Qt checks MIME metadata for this control without retrieving
clipboard text. Explicit paste runs `wl-paste` through the authenticated local
service with a 64 KiB cap and a 1.5-second overall deadline. Failed transfers
return no partial text. This ships with ordinary marketplace installations.
The native patches below additionally protect other Qt inputs in the shell.

- `qtquick-clipboard-metadata-only.patch` removes text retrieval from both
  clipboard-availability checks. Nonempty text offers remain pasteable;
  an empty text offer may report `canPaste: true`. Explicit paste keeps Qt's
  existing behavior, including replacing selected text.
  Applies to the Qt 6.11.2 and Qt 6.12.0 release sources. The moving Qt 6.12
  branch already has the equivalent fix; do not use a branch name as proof
  that a distribution's installed release is patched.
- `qtwayland-bounded-read-6.11.2.patch` limits each native transfer to 16 MiB
  and two seconds overall, retaining the existing one-second idle timeout.
  The deadline is checked even when a producer keeps the pipe readable.
  Oversized or expired transfers fail instead of supplying partial content.
- `qtwayland-bounded-read-6.12.0.patch` ports the same limits to Qt 6.12.0's
  updated optional-returning reader. The executable regression/build workflow
  below targets the locally installed Qt 6.11.2; this forward port still needs
  validation in a matching Qt 6.12.0 build.

The native cap applies to all MIME types handled by this reader, including
large images and drag-and-drop payloads. Transfers over 16 MiB or taking over
two seconds are deliberately rejected. A distribution may choose different
finite limits after reviewing its compatibility requirements.

## Build and verify on Qt 6.11.2

Build dependencies include matching Qt development packages and private
headers, CMake, Ninja, a C++ compiler, pkg-config, Python, curl, patch and tar.
Qt's own configure checks identify any missing platform development libraries.

```bash
bash scripts/build-qt-clipboard-overlay.sh
bash scripts/with-qt-clipboard-fix.sh node scripts/validate-qml-runtime.mjs
```

The builder downloads checksummed Qt 6.11.2 source archives, applies the
patches, builds `Quick` and `WaylandClient`, and publishes only those two
libraries to `~/.local/share/light-qt-security` after regression checks pass.
It does not overwrite distribution libraries or restart the desktop.
`LIGHT_QT_BUILD_DIR`, `LIGHT_QT_OVERLAY`, and `LIGHT_QT_BUILD_JOBS` can override
the build directory, overlay destination and parallel job count.

The regression suite uses an offscreen Qt clipboard to verify that clipboard
changes fetch no text, while explicit paste still obeys `maximumLength: 100`.
Pipe tests compile the actual patched Qt 6.11.2 `readData()` implementation
and check empty/normal data, the exact byte cap, oversized and continuous
streams, idle timeout, and an overall deadline for a slow producer. They do
not modify the desktop clipboard or exercise a live compositor.

To check an existing build:

```bash
bash scripts/with-qt-clipboard-fix.sh bash scripts/validate-qt-clipboard.sh \
  ~/.cache/light-qt-security/qtbase-6.11.2
```

## Deployment

The preferred durable fix is for the distribution to rebuild its Qt packages
with both patches, then restart every affected process. Version strings alone
cannot identify backports; retain the regression result with the package build.

The local overlay protects only commands explicitly launched through
`scripts/with-qt-clipboard-fix.sh`. It does not protect an already-running shell
or ordinary marketplace installations. A shell restart must launch Quickshell
through that wrapper, or use patched distribution packages. Preserve Omarchy's
launcher supervision and lock-session checks when integrating the wrapper.
The wrapper refuses to mix this overlay with a different installed Qt version.

Rollback the overlay by launching normally without the wrapper. Keep the
patches and tests until the installed distribution packages provide both
protections. Light's input and service changes avoid the affected paths in
Light; other applications still need the native dependency fixes.
