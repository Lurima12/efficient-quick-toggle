import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    BUTTON_DARK_STYLE,
    BUTTON_DND,
    BUTTON_NIGHT_LIGHT,
    BUTTON_ORDERS,
    SLIDER_THICKNESS_MAX,
    SLIDER_THICKNESS_MIN,
} from './lib/constants.js';

export default class EfficientQuickTogglePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        // Keep the Gio.Settings object alive as long as the window exists.
        window._settings = settings;

        window.add(this._createPositionPage(settings));
        window.add(this._createSliderPage(settings));
    }

    // --- Button position --------------------------------------------------

    _createPositionPage(settings) {
        // Position labels assume the default order of the native buttons:
        // Screenshot, Settings, Lock, Power.
        const slots = new Gtk.StringList();
        [
            _('First (before Screenshot)'),
            _('After Screenshot'),
            _('After Settings'),
            _('After Lock'),
            _('Last (after Power)'),
        ].forEach(label => slots.append(label));

        const names = {
            [BUTTON_DARK_STYLE]: _('Dark Style'),
            [BUTTON_DND]: _('Do Not Disturb'),
            [BUTTON_NIGHT_LIGHT]: _('Night Light'),
        };

        const page = new Adw.PreferencesPage({
            title: _('Buttons'),
            icon_name: 'view-list-symbolic',
        });

        const placement = new Adw.PreferencesGroup({
            title: _('Button position'),
            description: _('Choose where each round button sits among the Screenshot, Settings, Lock and Power buttons.'),
        });
        page.add(placement);
        placement.add(this._createComboRow(settings, 'dark-style-slot',
            _('Dark Style button'), slots));
        placement.add(this._createComboRow(settings, 'dnd-slot',
            _('Do Not Disturb button'), slots));
        placement.add(this._createComboRow(settings, 'night-light-slot',
            _('Night Light button'), slots));

        const orders = new Gtk.StringList();
        BUTTON_ORDERS.forEach(order =>
            orders.append(order.map(id => names[id]).join(' → ')));

        const order = new Adw.PreferencesGroup({
            title: _('Order'),
            description: _('Used when buttons share the same position.'),
        });
        page.add(order);
        order.add(this._createComboRow(settings, 'button-order',
            _('Button order'), orders));

        return page;
    }

    // --- Slider thickness -------------------------------------------------

    _createSliderPage(settings) {
        const page = new Adw.PreferencesPage({
            title: _('Sliders'),
            icon_name: 'audio-volume-high-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: _('Slider thickness'),
            description: _('Change the thickness of the volume and brightness sliders in the quick settings menu.'),
        });
        page.add(group);

        const enabled = new Adw.SwitchRow({
            title: _('Customize slider thickness'),
            subtitle: _('When off, the theme default is used.'),
        });
        settings.bind('slider-thickness-enabled', enabled, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        group.add(enabled);

        const volume = this._createThicknessRow(settings,
            'volume-slider-thickness', _('Volume slider (px)'), enabled);
        const brightness = this._createThicknessRow(settings,
            'brightness-slider-thickness', _('Brightness slider (px)'), enabled);
        group.add(volume);
        group.add(brightness);

        return page;
    }

    // --- Helpers ----------------------------------------------------------

    _createComboRow(settings, key, title, model) {
        const row = new Adw.ComboRow({title, model});
        settings.bind(key, row, 'selected', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _createThicknessRow(settings, key, title, enabledRow) {
        const row = new Adw.SpinRow({
            title,
            adjustment: new Gtk.Adjustment({
                lower: SLIDER_THICKNESS_MIN,
                upper: SLIDER_THICKNESS_MAX,
                step_increment: 1,
                page_increment: 2,
            }),
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        enabledRow.bind_property('active', row, 'sensitive',
            GObject.BindingFlags.SYNC_CREATE);
        return row;
    }
}
