import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {RoundToggleButton} from './lib/roundToggleButton.js';
import {SliderStyler} from './lib/sliderStyler.js';
import {ToggleHider} from './lib/toggleHider.js';
import {
    BUTTON_DARK_STYLE,
    BUTTON_DND,
    BUTTON_NIGHT_LIGHT,
    BUTTON_ORDERS,
} from './lib/constants.js';

// Icons used by the native toggles; also used to find and hide them.
const DARK_STYLE_ICON = 'dark-mode-symbolic';
const DND_ICON = 'notifications-disabled-symbolic';
const NIGHT_LIGHT_ICON = 'night-light-symbolic';

export default class EfficientQuickToggleExtension extends Extension {
    enable() {
        const quickSettings = Main.panel.statusArea.quickSettings;
        const topRow = quickSettings?._system?._systemItem?.child;
        if (!topRow) {
            console.error(`${this.metadata.uuid}: quick settings top row not found`);
            return;
        }

        this._topRow = topRow;
        this._settings = this.getSettings();
        this._settingsConnections = [];
        this._buttons = new Map(); // button id -> RoundToggleButton

        this._addButton(BUTTON_DARK_STYLE, this._createDarkStyleButton());
        this._addButton(BUTTON_DND, this._createDoNotDisturbButton());
        const nightLight = this._createNightLightButton();
        if (nightLight)
            this._addButton(BUTTON_NIGHT_LIGHT, nightLight);

        // Re-place the buttons whenever a position preference changes.
        for (const key of ['dark-style-slot', 'dnd-slot', 'night-light-slot', 'button-order'])
            this._connectSetting(this._settings, `changed::${key}`, () => this._placeButtons());
        this._placeButtons();

        const hiddenIcons = [DARK_STYLE_ICON, DND_ICON];
        if (nightLight)
            hiddenIcons.push(NIGHT_LIGHT_ICON);
        this._hider = new ToggleHider(quickSettings.menu._grid, hiddenIcons);

        this._sliderStyler = new SliderStyler(quickSettings, this._settings);
    }

    disable() {
        this._sliderStyler?.destroy();
        this._sliderStyler = null;

        this._hider?.destroy();
        this._hider = null;

        for (const {settings, id} of this._settingsConnections ?? [])
            settings.disconnect(id);
        this._settingsConnections = null;

        for (const button of this._buttons?.values() ?? [])
            button.destroy();
        this._buttons = null;

        this._settings = null;
        this._interfaceSettings = null;
        this._notificationSettings = null;
        this._colorSettings = null;
        this._topRow = null;
    }

    // --- Dark Style -------------------------------------------------------

    _createDarkStyleButton() {
        this._interfaceSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });

        const button = new RoundToggleButton(DARK_STYLE_ICON, _('Dark Style'));
        const sync = () => button.setActive(
            this._interfaceSettings.get_string('color-scheme') === 'prefer-dark');

        button.connect('clicked', () => {
            const dark = this._interfaceSettings.get_string('color-scheme') === 'prefer-dark';
            this._interfaceSettings.set_string('color-scheme',
                dark ? 'default' : 'prefer-dark');
        });

        this._connectSetting(this._interfaceSettings, 'changed::color-scheme', sync);
        sync();
        return button;
    }

    // --- Do Not Disturb ---------------------------------------------------

    _createDoNotDisturbButton() {
        this._notificationSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.notifications',
        });

        const button = new RoundToggleButton(DND_ICON, _('Do Not Disturb'));
        // Do Not Disturb is on when notification banners are off.
        const sync = () => button.setActive(
            !this._notificationSettings.get_boolean('show-banners'));

        button.connect('clicked', () => {
            const showBanners = this._notificationSettings.get_boolean('show-banners');
            this._notificationSettings.set_boolean('show-banners', !showBanners);
        });

        this._connectSetting(this._notificationSettings, 'changed::show-banners', sync);
        sync();
        return button;
    }

    // --- Night Light ------------------------------------------------------

    _createNightLightButton() {
        const schemaId = 'org.gnome.settings-daemon.plugins.color';
        // The schema comes from gnome-settings-daemon; skip the button
        // (and keep the native toggle) if it is not installed.
        if (!Gio.SettingsSchemaSource.get_default().lookup(schemaId, true))
            return null;

        this._colorSettings = new Gio.Settings({schema_id: schemaId});

        const button = new RoundToggleButton(NIGHT_LIGHT_ICON, _('Night Light'));
        const sync = () => button.setActive(
            this._colorSettings.get_boolean('night-light-enabled'));

        button.connect('clicked', () => {
            const enabled = this._colorSettings.get_boolean('night-light-enabled');
            this._colorSettings.set_boolean('night-light-enabled', !enabled);
        });

        this._connectSetting(this._colorSettings, 'changed::night-light-enabled', sync);
        sync();
        return button;
    }

    // --- Helpers ----------------------------------------------------------

    _addButton(id, button) {
        this._buttons.set(id, button);
    }

    _connectSetting(settings, signal, callback) {
        const id = settings.connect(signal, callback);
        this._settingsConnections.push({settings, id});
    }

    /**
     * Put the buttons in the top row according to the preferences.
     *
     * A "slot" is the number of native round buttons (by default Screenshot,
     * Settings, Lock, Power) that come before our button, so slot 0 is the
     * very start of the group and the highest slot is the very end. Slots
     * beyond the number of native buttons are clamped to the end.
     */
    _placeButtons() {
        if (!this._topRow || !this._buttons)
            return;

        // Take our buttons out first so only native ones are counted.
        for (const button of this._buttons.values()) {
            if (button.get_parent() === this._topRow)
                this._topRow.remove_child(button);
        }

        const natives = this._topRow.get_children().filter(actor =>
            actor.has_style_class_name?.('icon-button'));
        const count = natives.length;

        // Start from the chosen order; buttons that share a slot keep it.
        const order = BUTTON_ORDERS[this._settings.get_uint('button-order')] ?? BUTTON_ORDERS[0];
        const entries = order
            .filter(id => this._buttons.has(id))
            .map(id => ({
                button: this._buttons.get(id),
                slot: Math.min(this._settings.get_uint(`${id}-slot`), count),
            }))
            .sort((a, b) => a.slot - b.slot); // stable

        let endAnchor = count > 0 ? natives[count - 1] : null;
        for (const {button, slot} of entries) {
            if (slot < count) {
                // Each button goes directly before its native neighbour,
                // which keeps buttons sharing a slot in the chosen order.
                this._topRow.insert_child_below(button, natives[slot]);
            } else if (endAnchor) {
                this._topRow.insert_child_above(button, endAnchor);
                endAnchor = button;
            } else {
                this._topRow.add_child(button);
            }
        }
    }
}
