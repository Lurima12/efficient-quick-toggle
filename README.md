# Efficient Quick Toggle

GNOME Shell extension that moves **Dark Style**, **Do Not Disturb** and
**Night Light** out of the quick settings grid and into the top row, as round
icon-only buttons next to the screenshot, settings, lock and power buttons.
The original toggles are hidden while the extension is enabled and restored
when it is disabled. It can also change the thickness of the volume and
brightness sliders.

## Structure

```
efficient-quick-toggle@lurim412/
├── metadata.json          # uuid, name, supported shell versions, settings schema
├── extension.js           # enable()/disable(), settings sync, button placement
├── prefs.js               # preferences window (Adwaita)
├── stylesheet.css         # "on" state colour only
├── schemas/               # GSettings schema (+ compiled copy)
└── lib/
    ├── constants.js           # button ids, orderings, slider limits
    ├── roundToggleButton.js   # round icon-only St.Button
    ├── toggleHider.js         # hides/restores the native toggles
    └── sliderStyler.js        # volume/brightness slider thickness
```

## Preferences

Open with `gnome-extensions prefs efficient-quick-toggle@lurim412` or from the
Extensions app. Changes apply immediately, no restart needed.

**Buttons page**

- **Dark Style / Do Not Disturb / Night Light button**: each can go first,
  after Screenshot, after Settings, after Lock, or last (after Power).
- **Button order**: decides the order of buttons that share a position.

Positions count native round buttons, so labels assume the default order
(Screenshot, Settings, Lock, Power); a position past the last native button is
treated as "last".

**Sliders page**

- **Customize slider thickness**: master switch. Off keeps the theme default.
- **Volume slider (px)**: thickness of the output and input volume sliders.
- **Brightness slider (px)**: thickness of the brightness slider.

Thickness is applied as an inline `-barlevel-height` style on the slider, so
it works with any theme that uses the shell's standard slider drawing.

## Install

```sh
cp -r efficient-quick-toggle@lurim412 ~/.local/share/gnome-shell/extensions/
gnome-extensions enable efficient-quick-toggle@lurim412
```

On Wayland, log out and back in the first time so the shell discovers it.
If you update an enabled copy, disable and re-enable it so the new schema loads.

## Test without touching your session

```sh
dbus-run-session -- gnome-shell --devkit      # GNOME 49+
dbus-run-session -- gnome-shell --nested --wayland   # GNOME 45-48
```

Watch logs with `journalctl -f -o cat /usr/bin/gnome-shell`.

## Package for extensions.gnome.org

```sh
gnome-extensions pack efficient-quick-toggle@lurim412 --extra-source=lib
```

Before publishing, fill in the `url` field in `metadata.json`.

## How it works

- **Dark Style** reads and writes `org.gnome.desktop.interface color-scheme`
  (`prefer-dark` / `default`).
- **Do Not Disturb** reads and writes `org.gnome.desktop.notifications
  show-banners` (DND is on when banners are off).
- **Night Light** reads and writes `org.gnome.settings-daemon.plugins.color
  night-light-enabled`. If that schema is missing, the button is skipped and
  the native toggle stays visible. Night Light schedule and temperature are
  still configured in Settings → Displays.
- All buttons follow those settings live, so changes made elsewhere are
  reflected.
- Native toggles are found by icon name (`dark-mode-symbolic`,
  `notifications-disabled-symbolic`, `night-light-symbolic`), so hiding works
  in any language.
- `disable()` disconnects every signal, destroys the buttons, restores the
  original toggles and slider styles, as the GNOME review guidelines require.
