import {ActorHider} from './actorHider.js';

/**
 * Hides native quick settings grid toggles and restores them when they are
 * no longer wanted hidden or on destroy().
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
        this._hider = new ActorHider();

        this._childAddedId = this._grid.connect('child-added',
            (_grid, actor) => this._maybeHide(actor));

        this._scan();
    }

    /**
     * Change which toggles are hidden. Toggles that are no longer in the
     * list are shown again.
     *
     * @param {string[]} iconNames Icon names identifying toggles to hide
     */
    setIconNames(iconNames) {
        this._iconNames = new Set(iconNames);

        for (const actor of this._hider.actors()) {
            if (!this._iconNames.has(this._iconNameOf(actor)))
                this._hider.release(actor);
        }
        this._scan();
    }

    _scan() {
        this._grid.get_children().forEach(actor => this._maybeHide(actor));
    }

    _iconNameOf(actor) {
        return actor.iconName ?? actor.icon_name ?? actor.gicon?.name ?? null;
    }

    _maybeHide(actor) {
        const name = this._iconNameOf(actor);
        if (name && this._iconNames.has(name))
            this._hider.hide(actor);
    }

    destroy() {
        if (this._childAddedId) {
            this._grid.disconnect(this._childAddedId);
            this._childAddedId = 0;
        }
        this._hider.releaseAll();
        this._grid = null;
    }
}
