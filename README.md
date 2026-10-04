# Efficient Quick Toggle

GNOME Shell extension that moves **Dark Style**, **Do Not Disturb** and
**Night Light** out of the quick settings grid and into the top row, as round
icon-only buttons next to the screenshot, settings, lock and power buttons.
The original toggles are hidden while the extension is enabled and restored
when it is disabled. You can reorder and show or hide every item of the top
row (including the battery, screenshot, settings, lock and power buttons), and
change the thickness of the volume and brightness sliders.

## Structure

```
efficient-quick-toggle@lurim412/
├── metadata.json          # uuid, name, supported shell versions, settings schema
├── extension.js           # enable()/disable(), settings sync, button placement
├── prefs.js               # preferences window (Adwaita)
├── stylesheet.css         # "on" state colour only
├── schemas/               # GSettings schema (+ compiled copy)
└── lib/
    ├── constants.js           # button ids, layout helpers, slider limits
    ├── roundToggleButton.js   # round icon-only St.Button
    ├── actorHider.js          # keeps actors hidden, restores their real visibility
    ├── toggleHider.js         # hides/restores the native grid toggles
    ├── topRowLayout.js        # reorders/hides top row items (battery, lock, ...)
    └── sliderStyler.js        # volume/brightness slider thickness
```

## Preferences

Open with `gnome-extensions prefs efficient-quick-toggle@lurim412` or from the
Extensions app. Changes apply immediately, no restart needed.

**Buttons page**

- A list shows the whole top row from left to right (top of the list = left
  side): your three buttons, the built-in Battery, Screenshot, Settings, Lock
  and Power items, and a **Flexible space**.
- **Drag** the handle of any row up or down to move that item. Dragging down
  drops it after the row you release on, dragging up drops it before.
- Changes are staged: dragging and the switches only change the list. Press
  **Apply** to save them and update the top row (the button is enabled while
  there are unsaved changes). **Reset** restores the default order, shows every
  item and applies immediately.
- Each row has a **switch** to show or hide it. A hidden Dark Style, Do Not
  Disturb or Night Light button gives its original toggle back in the quick
  settings grid, so the feature stays reachable. Hidden built-in items are
  simply hidden, and come back when you turn them on or disable the extension.

The **Flexible space** is the gap that splits the row: everything above it
in the list stays on the left, everything below it is right-aligned. Drag it
like any other item. By default it comes right after the Battery, as in the
shell. On a desktop without a battery it is simply the first entry, so
everything is right-aligned; drag it to the bottom of the list to left-align
everything instead. If the shell has no separate space widget, the extension
creates one and stops a self-expanding item (such as the battery) from
expanding, then restores both when it is disabled. The space cannot be hidden.

Round buttons whose icon is not recognised are matched by their position
(Screenshot, Settings, Lock, Power in the shell's order) when the count
allows it.

The **Extension status** line at the bottom shows what the running extension
sees (version, which built-in items were found, how the space was handled,
anything it could not recognise, errors). If it says "Not
running", the shell is still running older code (see Install).

Built-in items are recognised by their icons (camera, settings, lock,
shutdown, battery), so it works in every language. An item that is not
present on your system (for example the battery on a desktop) is ignored.

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

**After updating files, log out and back in** (on X11 you can press Alt+F2,
type `r`, Enter). Disabling and re-enabling is not enough: the shell caches
the JavaScript modules it already loaded, so it keeps running the old code,
while the preferences window (a separate process) already uses the new code.

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
- The layout is stored as a list in `button-layout` and hidden items in
  `hidden-items`, both using the ids `dark-style`, `dnd`, `night-light`,
  `battery`, `screenshot`, `settings`, `lock` and `power`.
- All buttons follow those settings live, so changes made elsewhere are
  reflected.
- Native toggles are found by icon name (`dark-mode-symbolic`,
  `notifications-disabled-symbolic`, `night-light-symbolic`), so hiding works
  in any language.
- `disable()` disconnects every signal, destroys the buttons, restores the
  original toggles, the original order and visibility of the top row and the
  slider styles, as the GNOME review guidelines require.
