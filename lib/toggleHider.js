/**
 * Hides native quick settings toggles and keeps them hidden, then restores
 * them on destroy().
 *
 * Toggles are matched by their symbolic icon name rather than their label,
 * so this keeps working in every language.
 */
export class ToggleHider {
    /**
     * @param {St.Widget} grid The quick settings grid
     * @param {string[]} iconNames Icon names identifying toggles to hide
     */
    constructor(grid, iconNames) {
        this._grid = grid;
        this._iconNames = new Set(iconNames);
        this._hidden = new Map(); // actor -> notify::visible handler id

        this._childAddedId = this._grid.connect('child-added',
            (_grid, actor) => this._maybeHide(actor));

        this._grid.get_children().forEach(actor => this._maybeHide(actor));
    }

    _iconNameOf(actor) {
        return actor.iconName ?? actor.icon_name ?? actor.gicon?.name ?? null;
    }

    _maybeHide(actor) {
        if (this._hidden.has(actor))
            return;

        const name = this._iconNameOf(actor);
        if (!name || !this._iconNames.has(name))
            return;

        // Some toggles re-show themselves; keep them hidden while enabled.
        const id = actor.connect('notify::visible', () => {
            if (actor.visible)
                actor.hide();
        });
        this._hidden.set(actor, id);
        actor.hide();

        actor.connect('destroy', () => this._hidden.delete(actor));
    }

    destroy() {
        if (this._childAddedId) {
            this._grid.disconnect(this._childAddedId);
            this._childAddedId = 0;
        }

        for (const [actor, id] of this._hidden) {
            actor.disconnect(id);
            actor.show();
        }
        this._hidden.clear();
        this._grid = null;
    }
}
