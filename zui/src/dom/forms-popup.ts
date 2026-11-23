// Contrato sin framework del grupo forms: Select (listbox), Combobox, Calendar, DatePicker, Slider, OTPInput y
// FileUpload. Select, Combobox, Slider, OTPInput, FileUpload y los campos van en ./core; Calendar, DatePicker,
// DateField, TimeField y TimePicker, en la familia de fechas (./families/dates).
// Todo se activa dentro de `[data-z-dom]`. El campo y su popup se enlazan con aria-controls="id".
//
// Select      .z-select > button.z-select__control[aria-controls] + .z-listbox[popover] con .z-listbox__option[data-value].
//             En .z-select: data-value, data-placeholder. z:change { value }.
// Combobox    .z-combobox > input.z-input__control[aria-controls] + .z-listbox[popover]. En .z-combobox: data-value,
//             data-filter="false", data-loading, data-empty-text, data-loading-text. z:input { value } al escribir,
//             z:change { value, label }. setComboboxOptions(), setComboboxLoading().
// Calendar    .z-calendar vacío: data-mode="single|range|multiple", data-value ("YYYY-MM-DD", "desde/hasta" o
//             "a,b,c"), data-month, data-months (varios meses), data-paged, data-view, data-min-view, data-max-view,
//             data-caption="dropdown", data-min, data-max, data-locale, data-week-start, data-disabled-weekdays="0,6",
//             data-disabled-dates, data-unavailable-dates, data-outside-days, data-fixed-weeks, data-week-numbers,
//             data-today, data-today-button, data-presets (JSON), data-legend (JSON), data-cell-size,
//             data-selection-unit="week", data-min-range, data-max-range, data-max-selected y las etiquetas
//             data-*-label. Funciones (deshabilitadas, reservadas, contenido por día): setCalendarOptions().
//             z:change { value }, z:monthchange { month }, z:viewchange { view }.
// DatePicker  .z-select.z-datepicker > button[aria-controls] + .z-popover[popover] con un .z-calendar. Los mismos
//             atributos que Calendar, en .z-datepicker, más data-placeholder, data-date-style, data-confirm,
//             data-close-on-select y data-count-label. z:change { value }.
// Slider      .z-slider: data-min, data-max, data-step, data-value ("60" o "20,80"), data-orientation, data-disabled.
//             z:change { value, index }.
// OTPInput    .z-otp: data-mode="numeric|text", data-value. z:change { value, complete }.
// FileUpload  .z-upload: data-max-size (bytes); accept y multiple, en el input. Lista opcional: ul.z-upload__files.
//             z:change { files, rejected }. Rejilla: data-layout="grid" (con multiple, lo elegido se suma), data-sortable
//             (asa para reordenar con puntero y teclado; z:reorder { files, from, to }), data-cover (la primera es la
//             portada; z:cover { file }) y data-reorder-labels (JSON con los textos de core/reorder).
// DateField   .z-input.z-datefield[role=group] > .z-datefield__input con span.z-datefield__segment[role=spinbutton]
//             [data-segment] y .z-datefield__literal (se rehacen si no siguen el orden del locale), button.z-datefield__clear
//             opcional e input.z-native-input (valor ISO y validez nativa). En .z-datefield: data-locale, data-granularity
//             ="day|hour|minute|second", data-hour-cycle="12|24", data-minute-step, data-second-step, data-min, data-max,
//             data-value, data-placeholder-value, data-leading-zeros="false", data-disabled, data-readonly, data-invalid,
//             data-empty-label, data-incomplete-message, data-invalid-message, data-range-message. z:change { value }
//             (ISO, o null mientras está incompleto). setDateFieldValue(). Otros botones dentro del campo no se tocan.
// TimeField   El mismo marcado con la clase .z-timefield: segmentos de hora, minuto, (segundo) y AM/PM; data-granularity
//             ="minute|second". setTimeFieldValue().
// InputGroup, PasswordInput, NumberInput, CheckboxGroup, Field validate y Form: ver ./forms-fields.
// Listbox en línea y TagsInput: ver ./forms-choice.
// TimePicker  .z-timefield.z-timepicker con button.z-timepicker__trigger[aria-controls] + .z-timepicker__panel[popover]
//             vacío. En el campo: data-variant="columns|list", data-step (minutos de la lista), data-disabled-times
//             ="12:00,12:30", data-show-now, data-now-label, data-hours-label, data-minutes-label, data-seconds-label,
//             data-period-label, data-times-label. z:change { value }. setTimePickerValue().
//
// Piezas compartidas del grupo forms: utilidades y popups anclados (listbox de Select y Combobox, panel de DatePicker).
// Los popups usan `popover="manual"`: capa superior del navegador, y el cierre (Escape, clic o foco fuera) lo decide
// la pila de capas de ../core/layers, igual en todos los navegadores y en el binding de React.
import { pushLayer } from "../core/layers";
import { closePopover, openPopover, place, type Placement } from "./core";
import type { Listen } from "./shared";

export const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;

export function emit(el: Element, name: string, detail?: unknown): boolean {
  return el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, cancelable: true, detail }));
}

/** Elementos de `root` que cumplen el selector, incluido el propio `root`, dentro de `[data-z-dom]`. */
export function all<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T[] {
  const list = [...root.querySelectorAll<T>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root as T);
  return list.filter(inDom);
}

/** Pone o quita un atributo según `on`. */
export function flag(el: Element, name: string, on: boolean, value = ""): void {
  if (!on) el.removeAttribute(name);
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** Sin mayúsculas ni acentos, para comparar texto. */
export { fold } from "../core/search";

/** Popup que controla un disparador: su `aria-controls` apunta al popup o a un elemento dentro de él. */
export function popupFor(trigger: Element | null | undefined): HTMLElement | null {
  const id = trigger?.getAttribute("aria-controls");
  const target = id ? document.getElementById(id) : null;
  return target?.closest<HTMLElement>("[popover], .z-listbox") ?? null;
}

interface Entry {
  /** Envoltura del campo: fija la posición y el ancho mínimo del popup. */
  owner: HTMLElement;
  trigger: HTMLElement;
  placement: Placement;
  onClose: () => void;
  /** Retira el popup de la pila de capas (core/layers). */
  release: () => void;
}

const GAP = 4;
const open = new Map<HTMLElement, Entry>();

export const isOpen = (popup: HTMLElement | null | undefined) => Boolean(popup && open.has(popup));
export const ownerOf = (popup: HTMLElement | null | undefined) => (popup ? open.get(popup)?.owner : undefined);

/** Recalcula ancho mínimo, alto disponible y posición respecto al campo. */
export function reposition(popup: HTMLElement): void {
  const entry = open.get(popup);
  if (!entry) return;
  const rect = entry.owner.getBoundingClientRect();
  // Ancho del campo (ancho mínimo de la lista); `place` escribe además el hueco disponible. Las mismas variables
  // que el binding de React.
  popup.style.setProperty("--z-anchor-width", `${rect.width}px`);
  place(popup, rect, entry.placement, GAP);
}

/**
 * Abre `popup` bajo `owner`. `trigger` lleva aria-expanded. Con `returnFocus`, el foco vuelve a `trigger` cuando el
 * popup se cierra con el foco dentro o sin destino (Select, DatePicker); un Combobox nunca pierde el foco del campo.
 */
export function showPopup(popup: HTMLElement, owner: HTMLElement, trigger: HTMLElement, onClose: () => void, returnFocus = true): void {
  if (open.has(popup)) return;
  if (popup.getAttribute("popover") !== "manual") popup.setAttribute("popover", "manual");
  // Capa descartable, la misma pila que usa el binding de React: Escape cierra solo la de arriba (antes de que llegue
  // a un diálogo que la contenga) y una pulsación o un foco fuera del campo y de su popup la cierran.
  const release = pushLayer({
    contains: (target) => popup.contains(target) || owner.contains(target),
    onEscape: () => {
      const inside = popup.contains(document.activeElement);
      hidePopup(popup);
      if (inside) trigger.focus({ preventScroll: true });
    },
    onPointerOutside: () => hidePopup(popup),
    onFocusOutside: () => hidePopup(popup),
  });
  open.set(popup, {
    owner,
    trigger,
    placement: (trigger.getAttribute("data-z-placement") as Placement) ?? "bottom-start",
    onClose,
    release,
  });
  const rect = owner.getBoundingClientRect();
  popup.style.setProperty("--z-anchor-width", `${rect.width}px`);
  // La posición la lleva este módulo (reposition): el popup sigue al campo, no al disparador.
  openPopover(popup, returnFocus ? trigger : { x: rect.left, y: rect.bottom }, "bottom-start", { follow: false });
  trigger.setAttribute("aria-expanded", "true");
  reposition(popup);
}

function forget(popup: HTMLElement): boolean {
  const entry = open.get(popup);
  if (!entry) return false;
  open.delete(popup);
  entry.release();
  entry.trigger.setAttribute("aria-expanded", "false");
  entry.onClose();
  return true;
}

export function hidePopup(popup: HTMLElement): void {
  if (forget(popup)) closePopover(popup);
}

export function setup(on: Listen): void {
  // Cerrado desde fuera (closePopover, hidePopover): se limpia igual.
  on(document, "z:close", (event) => {
    forget(event.target as HTMLElement);
  });
  const follow = (event: Event) => {
    if (!open.size || (event.target instanceof Element && event.target.closest(".z-listbox, [popover]"))) return;
    for (const popup of open.keys()) reposition(popup);
  };
  on(document, "scroll", follow, { capture: true, passive: true });
  on(window, "resize", follow);
}
