// Shared by extension.js, prefs.js and the lib modules.

export const BUTTON_DARK_STYLE = 'dark-style';
export const BUTTON_DND = 'dnd';
export const BUTTON_NIGHT_LIGHT = 'night-light';

// Buttons added by this extension.
export const BUTTON_IDS = [BUTTON_DARK_STYLE, BUTTON_DND, BUTTON_NIGHT_LIGHT];

// Built-in items of the quick settings top row.
export const ITEM_BATTERY = 'battery';
export const ITEM_SCREENSHOT = 'screenshot';
export const ITEM_SETTINGS = 'settings';
export const ITEM_LOCK = 'lock';
export const ITEM_POWER = 'power';

export const NATIVE_IDS = [
    ITEM_BATTERY,
    ITEM_SCREENSHOT,
    ITEM_SETTINGS,
    ITEM_LOCK,
    ITEM_POWER,
];

// The flexible space of the row: everything after it is right-aligned,
// everything before it is left-aligned. Move it to choose the split.
export const ITEM_SPACER = 'spacer';

export const ALL_IDS = [...BUTTON_IDS, ...NATIVE_IDS, ITEM_SPACER];

// Left-to-right order of the top row. This mirrors the shell's own order
// (battery on the left, a flexible space, then the round buttons) with our
// buttons placed directly in front of the Screenshot button. On a desktop
// without a battery the space simply comes first.
export const DEFAULT_LAYOUT = [
    ITEM_BATTERY,
    ITEM_SPACER,
    ...BUTTON_IDS,
    ITEM_SCREENSHOT,
    ITEM_SETTINGS,
    ITEM_LOCK,
    ITEM_POWER,
];

// Ids used by an earlier version of the layout setting.
const LEGACY_IDS = {
    'native-1': ITEM_SCREENSHOT,
    'native-2': ITEM_SETTINGS,
    'native-3': ITEM_LOCK,
    'native-4': ITEM_POWER,
};

export const SLIDER_THICKNESS_MIN = 2;
export const SLIDER_THICKNESS_MAX = 16;

/**
 * Clean up a stored `button-layout` value: translate legacy ids, drop
 * unknown and duplicate ids, and put any missing id where it sits in the
 * default layout, relative to the ids that are present.
 *
 * @param {string[]} stored Value of the `button-layout` setting
 * @returns {string[]} A layout containing every id exactly once
 */
export function normalizeLayout(stored) {
    const known = new Set(ALL_IDS);
    const layout = [];
    for (const raw of stored) {
        const id = LEGACY_IDS[raw] ?? raw;
        if (known.has(id) && !layout.includes(id))
            layout.push(id);
    }

    DEFAULT_LAYOUT.forEach((id, i) => {
        if (layout.includes(id))
            return;

        let index = 0;
        for (let j = i - 1; j >= 0; j--) {
            const previous = layout.indexOf(DEFAULT_LAYOUT[j]);
            if (previous >= 0) {
                index = previous + 1;
                break;
            }
        }
        layout.splice(index, 0, id);
    });

    return layout;
}
