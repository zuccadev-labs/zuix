// @zuccadev-labs/zuix-zui/dom/color — ColorPicker, ColorArea, ColorSlider, ColorSwatchPicker, ColorField y
// ColorPickerTrigger sin framework. Registro: init(colorModule) o use(colorModule) junto a
// @zuccadev-labs/zuix-zui/dom/core.
import { colorWidgets } from "../color";
import type { DomModule } from "../shared";

export { setColorValue } from "../color";
export { destroyWidget, setWidgetProps } from "../widgets";

export const colorModule: DomModule = { name: "color", parts: [colorWidgets] };
