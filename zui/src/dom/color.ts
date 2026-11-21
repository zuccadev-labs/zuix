// Familia ColorPicker sin framework (oleada 7): .z-colorpicker, .z-colorarea, .z-colorslider, .z-colorswatches,
// .z-colorfield y .z-colortrigger dentro de `[data-z-dom]` se pintan con el mismo árbol que el binding de React
// (core/color-widget). Configuración en `data-*` (data-value, data-format, data-formats="hex rgb", data-alpha="false",
// data-swatches="#f00;#0f0", data-channel, data-orientation, data-name…) o en `<script type="application/json" data-props>`.
// Avisos: z:change { value } en cada cambio, z:changeend { value } al terminar y z:formatchange { format }.
// setColorValue(el, valor) cambia el color desde la aplicación.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { chevronUpDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-up-down";
import { eyeDropper } from "@zuccadev-labs/zuix-zicon/icons/eye-dropper";
import {
  colorAreaWidget,
  colorFieldWidget,
  colorPickerWidget,
  colorSliderWidget,
  colorSwatchPickerWidget,
  colorTriggerWidget,
} from "../core/color-widget";
import { registerWidget, setWidgetProps } from "./widgets";

registerIcons([chevronUpDown, eyeDropper]);
for (const widget of [colorPickerWidget, colorAreaWidget, colorSliderWidget, colorSwatchPickerWidget, colorFieldWidget, colorTriggerWidget])
  registerWidget(widget);

/** Cambia el color de una pieza de la familia ColorPicker (cualquier cadena CSS que entienda). */
export function setColorValue(el: HTMLElement, value: string): void {
  setWidgetProps(el, { value });
}

export function setup(): void {}
export function hydrate(): void {}
