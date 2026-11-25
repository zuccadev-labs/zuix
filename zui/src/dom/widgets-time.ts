// Familia de tiempo sin framework: Clock, AnalogClock, WorldClock, Countdown y DurationField se pintan con el mismo
// árbol que el binding de React (core/widget + core/vnode) y avanzan con el temporizador compartido (core/ticker).
// TimeZoneSelect es un Combobox del núcleo con `data-z-tz-select`: aquí se rellenan sus opciones.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { globeAlt } from "@zuccadev-labs/zuix-zicon/icons/globe-alt";
import { moon } from "@zuccadev-labs/zuix-zicon/icons/moon";
import { sun } from "@zuccadev-labs/zuix-zicon/icons/sun";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { analogClockWidget, clockWidget, worldClockWidget } from "../core/clock-widget";
import { countdownWidget } from "../core/countdown-widget";
import { durationFieldWidget } from "../core/duration-widget";
import { zoneOptions } from "../core/timezones";
import { list } from "../core/widget";
import { inDom } from "./forms-popup";
import { setComboboxOptions } from "./forms-listbox";
import type { DomPart } from "./shared";
import { widgetPart } from "./widgets";

registerIcons([globeAlt, moon, sun, xMark]);

export const timeWidgets = /* @__PURE__ */ widgetPart(45.5, [
  clockWidget,
  analogClockWidget,
  worldClockWidget,
  countdownWidget,
  durationFieldWidget,
]);

/**
 * Rellena un TimeZoneSelect del modo DOM (`.z-combobox[data-z-tz-select]`) con las zonas y su desfase y hora de
 * ahora. Atributos: data-zones (lista IANA; por defecto todas), data-show-offset="false", data-show-time="false",
 * data-locale. Repetible: vuelve a calcular desfases y horas.
 */
export function refreshTimeZoneSelect(combo: HTMLElement): void {
  const d = combo.dataset;
  const options = zoneOptions({
    zones: d.zones ? list(d.zones) : undefined,
    locale: d.locale,
    showOffset: d.showOffset !== "false",
    showTime: d.showTime !== "false",
  });
  setComboboxOptions(
    combo,
    options.map((o) => ({ value: o.value, label: o.label })),
  );
}

export const timeZonePart: DomPart = {
  rank: 45.6,
  setup(on) {
    // La hora de cada opción se renueva al desplegar la lista.
    on(document, "focusin", (event) => {
      const combo = event.target instanceof Element ? event.target.closest<HTMLElement>(".z-combobox[data-z-tz-select]") : null;
      if (combo && inDom(combo)) refreshTimeZoneSelect(combo);
    });
  },
  hydrate(root) {
    const found = [...root.querySelectorAll<HTMLElement>(".z-combobox[data-z-tz-select]")];
    if (root instanceof HTMLElement && root.matches(".z-combobox[data-z-tz-select]")) found.unshift(root);
    for (const combo of found) if (inDom(combo)) refreshTimeZoneSelect(combo);
  },
};
