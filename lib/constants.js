// Shared by extension.js and prefs.js.

export const BUTTON_DARK_STYLE = 'dark-style';
export const BUTTON_DND = 'dnd';
export const BUTTON_NIGHT_LIGHT = 'night-light';

// Order in which buttons that share a position are shown. The index is
// stored in the `button-order` setting, so only ever append to this list.
export const BUTTON_ORDERS = [
    [BUTTON_DARK_STYLE, BUTTON_DND, BUTTON_NIGHT_LIGHT],
    [BUTTON_DARK_STYLE, BUTTON_NIGHT_LIGHT, BUTTON_DND],
    [BUTTON_DND, BUTTON_DARK_STYLE, BUTTON_NIGHT_LIGHT],
    [BUTTON_DND, BUTTON_NIGHT_LIGHT, BUTTON_DARK_STYLE],
    [BUTTON_NIGHT_LIGHT, BUTTON_DARK_STYLE, BUTTON_DND],
    [BUTTON_NIGHT_LIGHT, BUTTON_DND, BUTTON_DARK_STYLE],
];

export const SLIDER_THICKNESS_MIN = 2;
export const SLIDER_THICKNESS_MAX = 16;
