# Upgrading from Light 0.6

Existing installations may still have the old user service. Light can reuse an
already-running backend without replacing its credential, so updating does not
require immediately removing it. To switch completely to the widget-owned
backend, stop the old service once:

```bash
systemctl --user disable --now omarchy-light-public.service
```

Light starts its replacement backend automatically. Your saved data
and existing shortcuts are preserved. New installations never create this
service. Existing global shortcut lines in Hyprland remain yours to keep or
remove; Light does not rewrite them.

For radio enhancements and shortcut behavior, see the [README](../README.md).
