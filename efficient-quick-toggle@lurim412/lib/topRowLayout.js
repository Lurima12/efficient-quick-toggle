import St from 'gi://St';

import {ActorHider} from './actorHider.js';
import {
    ITEM_BATTERY,
    ITEM_LOCK,
    ITEM_POWER,
    ITEM_SCREENSHOT,
    ITEM_SETTINGS,
    ITEM_SPACER,
    NATIVE_IDS,
} from './constants.js';

// Symbolic icons of the built-in round buttons (any one of them matches).
const NATIVE_ICONS = {
    [ITEM_SCREENSHOT]: [
        'camera-photo-symbolic', 'screenshot-symbolic',
        'applets-screenshooter-symbolic', 'screenshot-recorder-symbolic',
    ],
    [ITEM_SETTINGS]: [
        'emblem-system-symbolic', 'preferences-system-symbolic',
        'org.gnome.Settings-symbolic', 'applications-system-symbolic',
    ],
    [ITEM_LOCK]: ['system-lock-screen-symbolic', 'changes-prevent-symbolic'],
    [ITEM_POWER]: ['system-shutdown-symbolic'],
};

// Order of the round buttons in the shell, used when icons are not enough.
const NATIVE_BUTTON_ORDER = [ITEM_SCREENSHOT, ITEM_SETTINGS, ITEM_LOCK, ITEM_POWER];

/** All icon names used by an actor or anything inside it. */
function iconNamesOf(actor, depth = 4) {
    const names = [];

    const own = actor.iconName ?? actor.icon_name;
    if (own)
        names.push(own);

    const gicon = actor.gicon;
    const giconName = gicon?.get_names?.()?.[0] ?? gicon?.name;
    if (giconName)
        names.push(giconName);

    if (depth > 0) {
        for (const child of actor.get_children?.() ?? [])
            names.push(...iconNamesOf(child, depth - 1));
    }
    return names;
}

/** Which built-in item an actor of the top row is, or null. */
function classify(actor) {
    const names = iconNamesOf(actor);

    for (const [id, icons] of Object.entries(NATIVE_ICONS)) {
        if (names.some(name => icons.includes(name)))
            return id;
    }

    // The battery item's icon changes with the charge level.
    if (names.some(name => name.startsWith('battery-')) ||
        actor.has_style_class_name?.('power-item'))
        return ITEM_BATTERY;

    return null;
}

/** An empty widget that only exists to take up the free space. */
function isExpander(actor) {
    return Boolean(actor.x_expand) &&
        (actor.get_n_children?.() ?? 0) === 0 &&
        iconNamesOf(actor, 0).length === 0;
}

function describe(actor) {
    const names = iconNamesOf(actor);
    return `${actor.constructor?.name ?? 'Actor'}[${names.join('/') || 'no icon'}]`;
}

/**
 * Reorders and hides the items of the quick settings top row (battery,
 * screenshot, settings, lock, power, the flexible space and this
 * extension's own buttons).
 *
 * Items are recognised by their icons, so it works in every language. Round
 * buttons whose icon is not recognised are matched by their position
 * instead. The items are permuted among the positions they already occupy.
 * The flexible space is an item like the others, so the user decides where
 * the row is split into a left and a right part. If the shell has no
 * separate space widget, one is created. destroy() puts the original order,
 * visibility and expansion back.
 */
export class TopRowLayout {
    /** @param {St.Widget} container The row holding the items */
    constructor(container) {
        this._container = container;
        this._original = container.get_children();
        this._known = new Map(); // built-in id -> actor
        this._spacer = null;
        this._spacerKind = 'none'; // 'shell' | 'created' | 'none'
        this._expandRestore = new Set(); // actors whose x_expand we cleared
        this._hider = new ActorHider();
    }

    /**
     * @param {string[]} layout Every item id, in the order to show them
     * @param {Map<string, St.Widget>} ours Our buttons by id
     * @param {Set<string>} hiddenIds Built-in item ids to hide
     */
    apply(layout, ours, hiddenIds) {
        const container = this._container;
        const oursSet = new Set(ours.values());

        // Forget items that have gone.
        for (const [id, actor] of [...this._known]) {
            if (actor.get_parent() !== container)
                this._known.delete(id);
        }
        if (this._spacer && this._spacer.get_parent() !== container) {
            this._spacer = null;
            this._spacerKind = 'none';
        }

        const claimed = () => new Set([
            ...this._known.values(),
            ...oursSet,
            ...(this._spacer ? [this._spacer] : []),
        ]);
        const unclaimed = () => {
            const taken = claimed();
            return container.get_children().filter(child => !taken.has(child));
        };

        // 1. Recognise built-in items by their icons.
        for (const child of unclaimed()) {
            const id = classify(child);
            if (id && !this._known.has(id))
                this._known.set(id, child);
        }

        // 2. The shell's own space widget, if it has one.
        if (!this._spacer) {
            const real = unclaimed().find(isExpander);
            if (real) {
                this._spacer = real;
                this._spacerKind = 'shell';
            }
        }

        // 3. Round buttons with unknown icons: match them by position, but
        //    only when the count is unambiguous.
        const missing = NATIVE_BUTTON_ORDER.filter(id => !this._known.has(id));
        const loose = unclaimed()
            .filter(child => child.has_style_class_name?.('icon-button'))
            .sort((a, b) => this._originalIndex(a) - this._originalIndex(b));
        if (missing.length > 0 && loose.length === missing.length)
            loose.forEach((child, i) => this._known.set(missing[i], child));

        // 4. No space widget in the shell: make one. Items that expand by
        //    themselves (such as a battery pill) stop doing so, otherwise the
        //    free space would be shared and the split would not hold.
        if (!this._spacer) {
            this._spacer = new St.Widget({x_expand: true});
            this._spacerKind = 'created';
            container.add_child(this._spacer);
        }
        for (const actor of this._known.values()) {
            if (actor.x_expand && !this._expandRestore.has(actor)) {
                this._expandRestore.add(actor);
                actor.x_expand = false;
            }
        }

        for (const button of oursSet) {
            if (button.get_parent() !== container)
                container.add_child(button);
        }

        // Hand the occupied positions out again in layout order.
        const items = new Map([...this._known, ...ours, [ITEM_SPACER, this._spacer]]);
        const itemActors = new Set(items.values());
        const children = container.get_children();
        const positions = [];
        children.forEach((child, i) => {
            if (itemActors.has(child))
                positions.push(i);
        });

        const ordered = layout.filter(id => items.has(id)).map(id => items.get(id));
        const target = [...children];
        positions.forEach((position, k) => {
            target[position] = ordered[k];
        });
        this._setOrder(target);

        for (const id of NATIVE_IDS) {
            const actor = this._known.get(id);
            if (!actor)
                continue;
            if (hiddenIds.has(id))
                this._hider.hide(actor);
            else
                this._hider.release(actor);
        }
    }

    _originalIndex(actor) {
        const index = this._original.indexOf(actor);
        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    }

    /** What was recognised, for the status line of the preferences. */
    summary() {
        const roles = new Set([...this._known.values(), this._spacer]);
        const unrecognized = this._container.get_children()
            .filter(child => !roles.has(child) &&
                !child.has_style_class_name?.('round-quick-toggle'))
            .map(describe);

        return {
            found: NATIVE_IDS.filter(id => this._known.has(id)),
            missing: NATIVE_IDS.filter(id => !this._known.has(id)),
            spacer: this._spacerKind,
            unrecognized,
            children: this._container.get_n_children(),
        };
    }

    _setOrder(actors) {
        actors.forEach((actor, i) => {
            if (this._container.get_child_at_index(i) !== actor)
                this._container.set_child_at_index(actor, i);
        });
    }

    destroy() {
        this._hider.releaseAll();

        for (const actor of this._expandRestore) {
            try {
                actor.x_expand = true;
            } catch (e) {
                // The shell already destroyed it.
            }
        }
        this._expandRestore.clear();

        if (this._spacerKind === 'created')
            this._spacer.destroy();
        this._spacer = null;

        // Our own buttons are destroyed by the caller before this, so only
        // the shell's original children are left to put back in order.
        const present = this._original.filter(actor =>
            actor.get_parent() === this._container);
        this._setOrder(present);

        this._known.clear();
        this._container = null;
    }
}
