import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    ALL_IDS,
    BUTTON_DARK_STYLE,
    BUTTON_DND,
    BUTTON_NIGHT_LIGHT,
    ITEM_BATTERY,
    ITEM_LOCK,
    ITEM_POWER,
    ITEM_SCREENSHOT,
    ITEM_SETTINGS,
    ITEM_SPACER,
    SLIDER_THICKNESS_MAX,
    SLIDER_THICKNESS_MIN,
    normalizeLayout,
} from './lib/constants.js';

export default class EfficientQuickTogglePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        // Keep the Gio.Settings object alive as long as the window exists.
        window._settings = settings;

        window.add(this._createButtonsPage(window, settings));
        window.add(this._createSliderPage(settings));
    }

    // --- Top row: drag to reorder, switch to show/hide, Apply/Reset --------

    _createButtonsPage(window, settings) {
        this._titles = {
            [BUTTON_DARK_STYLE]: _('Dark Style'),
            [BUTTON_DND]: _('Do Not Disturb'),
            [BUTTON_NIGHT_LIGHT]: _('Night Light'),
            [ITEM_BATTERY]: _('Battery'),
            [ITEM_SCREENSHOT]: _('Screenshot'),
            [ITEM_SETTINGS]: _('Settings'),
            [ITEM_LOCK]: _('Lock'),
            [ITEM_POWER]: _('Power'),
            [ITEM_SPACER]: _('Flexible space'),
        };
        this._customButtons = new Set([
            BUTTON_DARK_STYLE, BUTTON_DND, BUTTON_NIGHT_LIGHT,
        ]);

        const readStored = () => ({
            layout: normalizeLayout(settings.get_strv('button-layout')),
            hidden: new Set(settings.get_strv('hidden-items')),
        });
        // `base` mirrors what is saved; `pending` is what the list shows.
        // Edits only change `pending` until Apply is pressed.
        this._base = readStored();
        this._pending = this._clone(this._base);
        this._selfChange = false;

        const page = new Adw.PreferencesPage({
            title: _('Buttons'),
            icon_name: 'view-list-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: _('Top row layout'),
            description: _('Drag the handle of a row up or down to move that item. The top of the list is the left side of the row. Use the switch to show or hide an item, then press Apply.'),
        });
        page.add(group);

        const resetButton = new Gtk.Button({
            label: _('Reset'),
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Restore the default order and show every item'),
        });
        const applyButton = new Gtk.Button({
            label: _('Apply'),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
            tooltip_text: _('Save the changes and update the top row'),
        });
        const buttonBox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6});
        buttonBox.append(resetButton);
        buttonBox.append(applyButton);
        group.header_suffix = buttonBox;

        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });
        group.add(listBox);

        // Apply is only useful while there are unsaved changes.
        const updateApply = () => {
            applyButton.sensitive = !this._same(this._pending, this._base);
        };
        this._updateApply = updateApply;

        let idleId = 0;
        const rebuild = () => this._rebuildList(listBox);
        this._scheduleRebuild = () => {
            if (idleId)
                return;
            // After the drop has finished, so no drag is still running.
            idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                idleId = 0;
                rebuild();
                return GLib.SOURCE_REMOVE;
            });
        };
        this._listBox = listBox;

        applyButton.connect('clicked', () => {
            this._selfChange = true;
            settings.set_strv('button-layout', this._pending.layout);
            settings.set_strv('hidden-items', [...this._pending.hidden]);
            this._selfChange = false;
            Gio.Settings.sync();
            this._base = readStored();
            updateApply();
        });
        resetButton.connect('clicked', () => {
            this._selfChange = true;
            settings.reset('button-layout');
            settings.reset('hidden-items');
            this._selfChange = false;
            Gio.Settings.sync();
            this._base = readStored();
            this._pending = this._clone(this._base);
            rebuild();
            updateApply();
        });

        // The settings can also change from elsewhere (dconf-editor).
        const onExternalChange = () => {
            if (this._selfChange)
                return;
            const wasClean = this._same(this._pending, this._base);
            this._base = readStored();
            if (wasClean) {
                this._pending = this._clone(this._base);
                this._scheduleRebuild();
            }
            updateApply();
        };
        const layoutId = settings.connect('changed::button-layout', onExternalChange);
        const hiddenId = settings.connect('changed::hidden-items', onExternalChange);

        rebuild();
        updateApply();

        // What the running extension reports, to diagnose a layout that
        // does nothing.
        const status = new Adw.PreferencesGroup({title: _('Extension status')});
        page.add(status);
        const statusRow = new Adw.ActionRow({
            title: _('Shell'),
            use_markup: false,
            subtitle_lines: 0,
        });
        status.add(statusRow);
        const updateStatus = () => {
            const text = settings.get_string('status');
            statusRow.subtitle = text !== '' ? text
                : _('Not running. If the extension is enabled, the shell is probably still running older code: log out and back in, then reopen these preferences.');
        };
        const statusId = settings.connect('changed::status', updateStatus);
        updateStatus();

        window.connect('close-request', () => {
            settings.disconnect(layoutId);
            settings.disconnect(hiddenId);
            settings.disconnect(statusId);
            if (idleId)
                GLib.source_remove(idleId);
            idleId = 0;
            return false;
        });

        return page;
    }

    _clone(state) {
        return {layout: [...state.layout], hidden: new Set(state.hidden)};
    }

    _same(a, b) {
        return a.layout.join() === b.layout.join() &&
            [...a.hidden].sort().join() === [...b.hidden].sort().join();
    }

    _rebuildList(listBox) {
        let child;
        while ((child = listBox.get_first_child()))
            listBox.remove(child);

        for (const id of this._pending.layout)
            listBox.append(this._createRow(id, !this._pending.hidden.has(id)));
    }

    _createRow(id, shown) {
        const row = new Adw.ActionRow({title: this._titles[id]});
        if (id === ITEM_SPACER)
            row.subtitle = _('Pushes everything below it to the right');
        else if (!this._customButtons.has(id))
            row.subtitle = _('Built-in');

        const handle = new Gtk.Image({
            icon_name: 'list-drag-handle-symbolic',
            tooltip_text: _('Drag to move'),
            margin_start: 4,
            margin_end: 4,
        });
        handle.set_cursor_from_name('grab');
        row.add_prefix(handle);
        this._addDragSource(handle, row, id);

        // The flexible space can be moved but not hidden.
        if (id !== ITEM_SPACER) {
            const toggle = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                active: shown,
                tooltip_text: _('Show'),
            });
            toggle.connect('notify::active', () => {
                if (toggle.active)
                    this._pending.hidden.delete(id);
                else
                    this._pending.hidden.add(id);
                this._updateApply();
            });
            row.add_suffix(toggle);
            row.activatable_widget = toggle;
        }

        // Every row accepts drops: the dragged item takes the position of
        // the row it is dropped on.
        this._addDropTarget(row, id);
        return row;
    }

    _addDragSource(handle, row, id) {
        const source = new Gtk.DragSource({actions: Gdk.DragAction.MOVE});

        source.connect('prepare', () => {
            const value = new GObject.Value();
            value.init(GObject.TYPE_STRING);
            value.set_string(id);
            return Gdk.ContentProvider.new_for_value(value);
        });
        source.connect('drag-begin', src => {
            const paintable = new Gtk.WidgetPaintable({widget: row});
            src.set_icon(paintable, 24, row.get_height() / 2);
        });

        handle.add_controller(source);
    }

    _addDropTarget(row, id) {
        const target = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE);

        target.connect('enter', () => {
            this._listBox.drag_highlight_row(row);
            return Gdk.DragAction.MOVE;
        });
        target.connect('leave', () => this._listBox.drag_unhighlight_row());
        target.connect('drop', (_target, draggedId) => {
            this._listBox.drag_unhighlight_row();
            this._moveItem(draggedId, id);
            return true;
        });

        row.add_controller(target);
    }

    /**
     * Move `draggedId` to the position of `targetId` in the pending layout.
     * Dragging down lands after the target row, dragging up lands before it.
     */
    _moveItem(draggedId, targetId) {
        if (draggedId === targetId || !ALL_IDS.includes(draggedId))
            return;

        const layout = this._pending.layout;
        const from = layout.indexOf(draggedId);
        const to = layout.indexOf(targetId);
        if (from < 0 || to < 0)
            return;

        layout.splice(from, 1);
        layout.splice(to, 0, draggedId);
        this._updateApply();
        this._scheduleRebuild();
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

        group.add(this._createThicknessRow(settings,
            'volume-slider-thickness', _('Volume slider (px)'), enabled));
        group.add(this._createThicknessRow(settings,
            'brightness-slider-thickness', _('Brightness slider (px)'), enabled));

        return page;
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
