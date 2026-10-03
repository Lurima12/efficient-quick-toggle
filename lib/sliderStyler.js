/**
 * Changes the bar thickness of the volume and brightness sliders in the
 * quick settings menu, and restores the original style on destroy().
 *
 * The shell draws slider bars using the `-barlevel-height` CSS property, so
 * an inline style on the slider is enough; no shell code is patched.
 */
export class SliderStyler {
    /**
     * @param {object} quickSettings Main.panel.statusArea.quickSettings
     * @param {Gio.Settings} settings Extension settings
     */
    constructor(quickSettings, settings) {
        this._settings = settings;
        this._originalStyles = new Map(); // slider -> original inline style

        this._targets = [
            {slider: this._sliderOf(quickSettings._volumeOutput), key: 'volume-slider-thickness'},
            {slider: this._sliderOf(quickSettings._volumeInput), key: 'volume-slider-thickness'},
            {slider: this._sliderOf(quickSettings._brightness), key: 'brightness-slider-thickness'},
        ].filter(target => target.slider);

        this._settingsIds = [
            'slider-thickness-enabled',
            'volume-slider-thickness',
            'brightness-slider-thickness',
        ].map(key => this._settings.connect(`changed::${key}`, () => this.apply()));

        this.apply();
    }

    _sliderOf(indicator) {
        return indicator?.quickSettingsItems?.[0]?.slider ?? null;
    }

    apply() {
        const enabled = this._settings.get_boolean('slider-thickness-enabled');

        for (const {slider, key} of this._targets) {
            if (!this._originalStyles.has(slider))
                this._originalStyles.set(slider, slider.get_style());

            const original = this._originalStyles.get(slider);
            if (enabled) {
                const thickness = this._settings.get_uint(key);
                // Keep the widget tall enough that a thick bar is not clipped.
                const minHeight = Math.max(thickness + 4, 18);
                const base = original ? `${original.trimEnd().replace(/;?$/, ';')} ` : '';
                slider.set_style(
                    `${base}-barlevel-height: ${thickness}px; min-height: ${minHeight}px;`);
            } else {
                slider.set_style(original);
            }
            slider.queue_repaint();
        }
    }

    destroy() {
        for (const id of this._settingsIds)
            this._settings.disconnect(id);
        this._settingsIds = [];

        for (const [slider, original] of this._originalStyles) {
            slider.set_style(original);
            slider.queue_repaint();
        }
        this._originalStyles.clear();
        this._targets = [];
        this._settings = null;
    }
}
