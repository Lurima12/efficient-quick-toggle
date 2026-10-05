import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {RoundToggleButton} from './lib/roundToggleButton.js';
import {SliderStyler} from './lib/sliderStyler.js';
import {ToggleHider} from './lib/toggleHider.js';
import {TopRowLayout} from './lib/topRowLayout.js';
import {
    BUTTON_DARK_STYLE,
    BUTTON_DND,
    BUTTON_NIGHT_LIGHT,
    normalizeLayout,
} from './lib/constants.js';

// Icons used by the native toggles; also used to find and hide them.
const DARK_STYLE_ICON = 'dark-mode-symbolic';
const DND_ICON = 'notifications-disabled-symbolic';
const NIGHT_LIGHT_ICON = 'night-light-symbolic';

const NATIVE_ICONS = {
    [BUTTON_DARK_STYLE]: DARK_STYLE_ICON,
    [BUTTON_DND]: DND_ICON,
    [BUTTON_NIGHT_LIGHT]: NIGHT_LIGHT_ICON,
};

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

        this._hider = new ToggleHider(quickSettings.menu._grid, []);
        this._topRowLayout = new TopRowLayout(topRow);

        // Re-apply when the layout or hidden items change, and when the
        // shell adds an item to the row later (for example the battery).
        this._connectSetting(this._settings, 'changed::button-layout',
            () => this._applyLayout());
        this._connectSetting(this._settings, 'changed::hidden-items',
            () => this._applyLayout());
        this._childAddedId = topRow.connect('child-added', () => {
            if (this._applying || this._reapplyId)
                return;
            this._reapplyId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._reapplyId = 0;
                this._applyLayout();
                return GLib.SOURCE_REMOVE;
            });
        });
        this._applyLayout();

        this._sliderStyler = new SliderStyler(quickSettings, this._settings);
    }

    disable() {
        this._sliderStyler?.destroy();
        this._sliderStyler = null;

        if (this._reapplyId) {
            GLib.source_remove(this._reapplyId);
            this._reapplyId = 0;
        }
        if (this._childAddedId) {
            this._topRow.disconnect(this._childAddedId);
            this._childAddedId = 0;
        }

        this._hider?.destroy();
        this._hider = null;

        for (const {settings, id} of this._settingsConnections ?? [])
            settings.disconnect(id);
        this._settingsConnections = null;

        // Our buttons first, then put the built-in items back as they were.
        for (const button of this._buttons?.values() ?? [])
            button.destroy();
        this._buttons = null;
        this._topRowLayout?.destroy();
        this._topRowLayout = null;

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
     * Apply the `button-layout` and `hidden-items` preferences.
     *
     * Our buttons and the built-in items (battery, screenshot, settings,
     * lock, power) share one left-to-right order. A hidden button of ours
     * gives its original toggle back in the quick settings grid, so the
     * feature stays reachable; hidden built-in items are simply hidden.
     */
    _applyLayout() {
        if (!this._buttons || !this._topRowLayout || this._applying)
            return;

        this._applying = true;
        try {
            const layout = normalizeLayout(this._settings.get_strv('button-layout'));
            const hidden = new Set(this._settings.get_strv('hidden-items'));

            const nativeIconsToHide = [];
            for (const [id, button] of this._buttons) {
                button.visible = !hidden.has(id);
                if (button.visible)
                    nativeIconsToHide.push(NATIVE_ICONS[id]);
            }
            this._hider?.setIconNames(nativeIconsToHide);

            this._topRowLayout.apply(layout, this._buttons, hidden);
            this._reportStatus();
        } catch (e) {
            console.error(`${this.metadata.uuid}: applying the layout failed`, e);
            this._setStatus(`Error: ${e.message}`);
        } finally {
            this._applying = false;
        }
    }

    /**
     * Tell the preferences window what the running extension sees, so a
     * layout that does nothing can be diagnosed from there.
     */
    _reportStatus() {
        const {found, missing, spacer, unrecognized, children} = this._topRowLayout.summary();
        const version = this.metadata['version-name'] ?? '?';
        let text = `Running v${version}. Found: ${found.join(', ') || 'none'}. ` +
            `Not found: ${missing.join(', ') || 'none'}. Spacer: ${spacer}. ` +
            `Top row items: ${children}.`;
        if (unrecognized.length > 0)
            text += ` Unrecognized: ${unrecognized.join(', ')}.`;
        this._setStatus(text);
    }

    _setStatus(text) {
        if (this._settings && this._settings.get_string('status') !== text)
            this._settings.set_string('status', text);
    }
}
