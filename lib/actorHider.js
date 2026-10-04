/**
 * Keeps actors hidden and gives them back exactly as they were.
 *
 * While an actor is hidden, anything that tries to show it is overruled.
 * The visibility the shell wanted is remembered, so releasing the actor
 * restores that (for example a lock button the shell itself keeps hidden
 * stays hidden) instead of blindly showing it.
 */
export class ActorHider {
    constructor() {
        this._entries = new Map(); // actor -> {desired, visibleId, destroyId, busy}
    }

    actors() {
        return [...this._entries.keys()];
    }

    has(actor) {
        return this._entries.has(actor);
    }

    hide(actor) {
        if (this._entries.has(actor))
            return;

        const entry = {desired: actor.visible, busy: false};

        entry.visibleId = actor.connect('notify::visible', () => {
            if (entry.busy)
                return;
            entry.desired = actor.visible;
            if (actor.visible) {
                entry.busy = true;
                actor.hide();
                entry.busy = false;
            }
        });
        entry.destroyId = actor.connect('destroy', () => this._entries.delete(actor));
        this._entries.set(actor, entry);

        entry.busy = true;
        actor.hide();
        entry.busy = false;
    }

    release(actor) {
        const entry = this._entries.get(actor);
        if (!entry)
            return;

        actor.disconnect(entry.visibleId);
        actor.disconnect(entry.destroyId);
        this._entries.delete(actor);
        actor.visible = entry.desired;
    }

    releaseAll() {
        for (const actor of this.actors())
            this.release(actor);
    }
}
