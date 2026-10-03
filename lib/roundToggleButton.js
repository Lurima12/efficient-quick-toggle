import GObject from 'gi://GObject';
import St from 'gi://St';

/**
 * A round, icon-only button that looks like the native buttons in the
 * top row of the quick settings menu (screenshot, settings, lock, power).
 *
 * It reuses the shell's own `icon-button` style class, so size, shape and
 * hover/focus behaviour follow the current theme. The "on" state is shown
 * through the `checked` pseudo class (see stylesheet.css).
 */
export const RoundToggleButton = GObject.registerClass(
class RoundToggleButton extends St.Button {
    /**
     * @param {string} iconName Symbolic icon name
     * @param {string} accessibleName Name announced by screen readers
     *                                (not drawn on screen)
     */
    _init(iconName, accessibleName) {
        super._init({
            style_class: 'icon-button round-quick-toggle',
            can_focus: true,
            track_hover: true,
            accessible_name: accessibleName,
            child: new St.Icon({icon_name: iconName}),
        });
    }

    /** @param {boolean} active Whether the feature is currently on */
    setActive(active) {
        this.checked = active;
    }
});
