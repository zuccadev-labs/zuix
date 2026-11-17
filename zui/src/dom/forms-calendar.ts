// Calendar y DatePicker sin framework. La rejilla del mes se genera a partir de los atributos de `.z-calendar`
// con el mismo marcado que el binding de React. Fechas ISO `YYYY-MM-DD`, cálculo en UTC, sin librerías.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { addDays, addMonths, daysInMonth, localeWeekStart, monthOf, pad, parse, parseRange, rangeText, safeLocale, todayISO, valid, type DateRange } from "../core/date";
import { all, emit, flag, hidePopup, inDom, isOpen, ownerOf, popupFor, showPopup } from "./forms-popup";
import { logicalKey, setMarkup, type Listen } from "./shared";

registerIcons([chevronLeft, chevronRight]);

export type { DateRange };

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---------- Calendar ---------- */

interface CalState {
  /** Día activo (foco itinerante). */
  focused: string | null;
  /** Día bajo el puntero o el foco mientras se elige el final de un rango. */
  preview: string | null;
}

const states = new WeakMap<HTMLElement, CalState>();
let calSeq = 0;

function stateOf(cal: HTMLElement): CalState {
  let state = states.get(cal);
  if (!state) states.set(cal, (state = { focused: null, preview: null }));
  return state;
}

function config(cal: HTMLElement) {
  const data = cal.dataset;
  const mode = data.mode === "range" ? "range" : "single";
  const locale = safeLocale(data.locale);
  const min = valid(data.min) ? data.min : null;
  const max = valid(data.max) ? data.max : null;
  const weekStart = data.weekStart !== undefined && data.weekStart !== "" && Number.isInteger(Number(data.weekStart)) ? ((Number(data.weekStart) % 7) + 7) % 7 : localeWeekStart(locale);
  const single = mode === "single" && valid(data.value) ? data.value : null;
  const range = mode === "range" ? parseRange(data.value) : { from: null, to: null };
  const offDays = (data.disabledWeekdays ?? "").split(",").filter((d) => d.trim() !== "").map(Number);
  const offDates = new Set((data.disabledDates ?? "").split(",").map((d) => d.trim()));
  const unavailable = (date: string) => (min !== null && date < min) || (max !== null && date > max) || offDays.includes(parse(date).getUTCDay()) || offDates.has(date);
  return { mode, locale, min, max, weekStart, single, range, anchor: single ?? range.from, unavailable, outside: data.outsideDays !== "false" };
}

function visibleMonth(cal: HTMLElement): string {
  if (/^\d{4}-\d{2}$/.test(cal.dataset.month ?? "") && valid(`${cal.dataset.month}-01`)) return cal.dataset.month!;
  const { anchor, min, max } = config(cal);
  const today = todayISO();
  return (cal.dataset.month = monthOf(anchor ?? (min && min > today ? min : max && max < today ? max : today)));
}

function skeleton(cal: HTMLElement): void {
  const previous = cal.dataset.previousLabel ?? "Previous month";
  const next = cal.dataset.nextLabel ?? "Next month";
  const titleId = `${cal.id || `z-calendar-${++calSeq}`}-title`;
  setMarkup(cal, `<div class="z-calendar__header"><button type="button" class="z-calendar__nav" aria-label="${esc(previous)}" title="${esc(previous)}">${iconSvg("chevron-left", { size: 16 })}</button><div class="z-calendar__title" id="${esc(titleId)}" aria-live="polite"></div><button type="button" class="z-calendar__nav" aria-label="${esc(next)}" title="${esc(next)}">${iconSvg("chevron-right", { size: 16 })}</button></div><table class="z-calendar__grid" role="grid" aria-labelledby="${esc(titleId)}"><thead><tr></tr></thead><tbody></tbody></table>`);
}

/** Dibuja el mes visible: título, días de la semana y semanas. */
function renderMonth(cal: HTMLElement): void {
  const c = config(cal);
  const month = visibleMonth(cal);
  let title = cal.querySelector<HTMLElement>(".z-calendar__title");
  let head = cal.querySelector<HTMLElement>(".z-calendar__grid > thead > tr");
  let body = cal.querySelector<HTMLElement>(".z-calendar__grid > tbody");
  if (!title || !head || !body || cal.querySelectorAll(".z-calendar__nav").length !== 2) {
    skeleton(cal);
    title = cal.querySelector<HTMLElement>(".z-calendar__title")!;
    head = cal.querySelector<HTMLElement>(".z-calendar__grid > thead > tr")!;
    body = cal.querySelector<HTMLElement>(".z-calendar__grid > tbody")!;
  }
  cal.dataset.mode = c.mode;
  flag(cal.querySelector(".z-calendar__grid")!, "aria-multiselectable", c.mode === "range", "true");

  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const first = `${month}-01`;
  const last = `${month}-${pad(daysInMonth(year, monthIndex))}`;
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(c.locale, { ...options, timeZone: "UTC" });
  const [short, long, day, full] = [fmt({ weekday: "short" }), fmt({ weekday: "long" }), fmt({ day: "numeric" }), fmt({ dateStyle: "full" })];

  title.textContent = fmt({ month: "long", year: "numeric" }).format(parse(first));
  const [back, forward] = cal.querySelectorAll<HTMLButtonElement>(".z-calendar__nav");
  back!.disabled = c.min !== null && addDays(first, -1) < c.min;
  forward!.disabled = c.max !== null && addDays(last, 1) > c.max;

  const lead = (parse(first).getUTCDay() - c.weekStart + 7) % 7;
  const total = Math.ceil((lead + daysInMonth(year, monthIndex)) / 7) * 7;
  const origin = addDays(first, -lead);
  const dates = Array.from({ length: total }, (_, i) => addDays(origin, i));
  setMarkup(head, dates.slice(0, 7).map((date) => `<th scope="col" abbr="${esc(long.format(parse(date)))}" class="z-calendar__weekday">${esc(short.format(parse(date)))}</th>`).join(""));
  let rows = "";
  dates.forEach((date, i) => {
    if (i % 7 === 0) rows += "<tr>";
    const out = date < first || date > last;
    rows += out && !c.outside
      ? '<td class="z-calendar__cell" data-outside=""></td>'
      : `<td class="z-calendar__cell" aria-selected="false"><button type="button" class="z-calendar__day" data-date="${date}"${out ? ' data-outside=""' : ""} aria-label="${esc(full.format(parse(date)))}" tabindex="-1">${esc(day.format(parse(date)))}</button></td>`;
    if (i % 7 === 6) rows += "</tr>";
  });
  setMarkup(body, rows);
  paint(cal);
}

/** Actualiza los atributos de estado de los días: selección, rango, hoy, no elegibles y tabulación. */
function paint(cal: HTMLElement): void {
  const c = config(cal);
  const state = stateOf(cal);
  const month = visibleMonth(cal);
  const today = todayISO();
  const inMonth = (date: string | null): date is string => date !== null && monthOf(date) === month;
  const tabbable = [state.focused, c.anchor, today].find(inMonth) ?? `${month}-01`;
  const { from, to } = c.range;
  const previewing = c.mode === "range" && from && !to && state.preview && state.preview !== from ? state.preview : null;
  const bandFrom = previewing ? (previewing < from! ? previewing : from) : from;
  const bandTo = previewing ? (previewing < from! ? from : previewing) : to;
  for (const button of cal.querySelectorAll<HTMLElement>(".z-calendar__day")) {
    const date = button.dataset.date!;
    const cell = button.parentElement!;
    const selected = c.mode === "range" ? date === from || date === to : date === c.single;
    const inRange = c.mode === "range" && Boolean(from && to && date >= from && date <= to);
    let part: string | undefined;
    if (c.mode === "range" && bandFrom) {
      if (!bandTo || bandFrom === bandTo) part = date === bandFrom ? "single" : undefined;
      else part = date === bandFrom ? "start" : date === bandTo ? "end" : date > bandFrom && date < bandTo ? "middle" : undefined;
    }
    cell.setAttribute("aria-selected", String(selected || inRange));
    flag(cell, "data-range", part !== undefined, part);
    flag(cell, "data-preview", Boolean(part && previewing));
    flag(button, "data-selected", selected);
    flag(button, "data-today", date === today);
    flag(button, "aria-current", date === today, "date");
    flag(button, "aria-disabled", c.unavailable(date), "true");
    button.tabIndex = date === tabbable ? 0 : -1;
  }
}

function showMonth(cal: HTMLElement, month: string): void {
  if (month === visibleMonth(cal)) return;
  cal.dataset.month = month;
  renderMonth(cal);
}

/** Mueve el día activo (acotado a min/max), muestra su mes y le da el foco. */
function focusDate(cal: HTMLElement, date: string): void {
  const { min, max } = config(cal);
  const target = min && date < min ? min : max && date > max ? max : date;
  stateOf(cal).focused = target;
  showMonth(cal, monthOf(target));
  paint(cal);
  cal.querySelector<HTMLElement>(`[data-date="${target}"]`)?.focus();
}

function writeValue(cal: HTMLElement, value: string | DateRange | null): void {
  const text = value === null ? "" : typeof value === "string" ? value : rangeText(value);
  if (text) cal.dataset.value = text;
  else delete cal.dataset.value;
}

function selectDate(cal: HTMLElement, date: string): void {
  const c = config(cal);
  if (c.unavailable(date)) return;
  const state = stateOf(cal);
  state.focused = date;
  let value: string | DateRange = date;
  if (c.mode === "range") {
    const { from, to } = c.range;
    value = !from || to ? { from: date, to: null } : date < from ? { from: date, to: from } : { from, to: date };
    state.preview = null;
  }
  writeValue(cal, value);
  if (monthOf(date) !== visibleMonth(cal)) {
    // Día de un mes vecino: se muestra su mes y el foco sigue al día.
    showMonth(cal, monthOf(date));
    cal.querySelector<HTMLElement>(`[data-date="${date}"]`)?.focus();
  } else paint(cal);
  // Dentro de un DatePicker, el cambio lo anuncia el campo.
  const picker = ownerOf(cal.closest<HTMLElement>("[popover]"));
  if (picker?.matches(PICKER)) pickFromCalendar(picker, value);
  else emit(cal, "change", { value });
}

/** Fija el valor de un Calendar: fecha ISO, `{ from, to }` en modo rango o `null`. Muestra su mes y emite z:change. */
export function setCalendarValue(cal: HTMLElement, value: string | DateRange | null): void {
  writeValue(cal, value);
  const anchor = config(cal).anchor;
  if (anchor) cal.dataset.month = monthOf(anchor);
  stateOf(cal).focused = null;
  renderMonth(cal);
  emit(cal, "change", { value });
}

function onCalendarKey(cal: HTMLElement, date: string, event: KeyboardEvent): void {
  const weekday = (parse(date).getUTCDay() - config(cal).weekStart + 7) % 7;
  const moves: Record<string, () => string> = {
    ArrowLeft: () => addDays(date, -1),
    ArrowRight: () => addDays(date, 1),
    ArrowUp: () => addDays(date, -7),
    ArrowDown: () => addDays(date, 7),
    Home: () => addDays(date, -weekday),
    End: () => addDays(date, 6 - weekday),
    PageUp: () => addMonths(date, event.shiftKey ? -12 : -1),
    PageDown: () => addMonths(date, event.shiftKey ? 12 : 1),
  };
  // En RTL la rejilla se refleja: la flecha izquierda va al día siguiente.
  const move = typeof event.key === "string" ? moves[logicalKey(event.key, cal)] : undefined;
  if (!move) return;
  event.preventDefault();
  focusDate(cal, move());
}

/* ---------- DatePicker ---------- */

const PICKER = ".z-datepicker";
const FORWARDED = ["mode", "min", "max", "locale", "weekStart", "disabledWeekdays", "disabledDates", "outsideDays", "previousLabel", "nextLabel"];

function pickerParts(picker: HTMLElement) {
  const control = picker.querySelector<HTMLButtonElement>("button.z-select__control");
  const panel = popupFor(control);
  return { control, panel, cal: panel?.querySelector<HTMLElement>(".z-calendar") ?? null, hidden: picker.querySelector<HTMLInputElement>('input[type="hidden"]') };
}

const pickerMode = (picker: HTMLElement) => (picker.dataset.mode ?? pickerParts(picker).cal?.dataset.mode) === "range" ? "range" : "single";

function syncPicker(picker: HTMLElement): void {
  const { control, hidden } = pickerParts(picker);
  if (!control) return;
  const range = pickerMode(picker) === "range";
  const raw = picker.dataset.value ?? hidden?.value ?? "";
  const style = (picker.dataset.dateStyle ?? "medium") as Intl.DateTimeFormatOptions["dateStyle"];
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(safeLocale(picker.dataset.locale), { dateStyle: style, timeZone: "UTC" });
  } catch {
    formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });
  }
  const show = (iso: string) => formatter.format(parse(iso));
  const { from, to } = parseRange(raw);
  const text = range ? (from ? `${show(from)} – ${to ? show(to) : "…"}` : "") : valid(raw) ? show(raw) : "";
  const value = range ? rangeText({ from, to }) : valid(raw) ? raw : "";
  const label = control.querySelector<HTMLElement>(".z-select__value");
  if (label) label.textContent = text || (picker.dataset.placeholder ?? (range ? "Select dates" : "Select date"));
  flag(control, "data-placeholder", !text);
  if (value) picker.dataset.value = value;
  else delete picker.dataset.value;
  if (hidden) hidden.value = value;
  if (!control.dataset.state) control.dataset.state = "closed";
}

function openPicker(picker: HTMLElement): void {
  const { control, panel, cal } = pickerParts(picker);
  if (!control || !panel || !cal || control.disabled || isOpen(panel)) return;
  // El calendario hereda la configuración del campo y abre en el mes del valor.
  for (const key of FORWARDED) if (picker.dataset[key] !== undefined) cal.dataset[key] = picker.dataset[key];
  if (picker.dataset.value) cal.dataset.value = picker.dataset.value;
  else delete cal.dataset.value;
  delete cal.dataset.month;
  states.delete(cal);
  renderMonth(cal);
  showPopup(panel, picker, control, () => (control.dataset.state = "closed"));
  control.dataset.state = "open";
  // El foco inicial lo toma el día activo, no el primer botón.
  cal.querySelector<HTMLElement>('.z-calendar__day[tabindex="0"]')?.focus({ preventScroll: true });
}

function closePicker(picker: HTMLElement): void {
  const { control, panel } = pickerParts(picker);
  if (!panel || !isOpen(panel)) return;
  const inside = panel.contains(document.activeElement);
  hidePopup(panel);
  if (inside) control?.focus({ preventScroll: true });
}

function pickFromCalendar(picker: HTMLElement, value: string | DateRange): void {
  picker.dataset.value = typeof value === "string" ? value : rangeText(value);
  syncPicker(picker);
  // Fecha única o rango completo: se cierra y el foco vuelve al campo.
  if (typeof value === "string" || (value.from && value.to)) closePicker(picker);
  emit(picker, "change", { value });
}

/** Fija el valor de un DatePicker: fecha ISO, `{ from, to }` en modo rango o `null`. Emite z:change. */
export function setDatePickerValue(picker: HTMLElement, value: string | DateRange | null): void {
  const text = value === null ? "" : typeof value === "string" ? value : rangeText(value);
  if (text) picker.dataset.value = text;
  else delete picker.dataset.value;
  const hidden = pickerParts(picker).hidden;
  if (hidden) hidden.value = text;
  syncPicker(picker);
  emit(picker, "change", { value });
}

/* ---------- Delegación ---------- */

/** Calendario activo: dentro de `[data-z-dom]` o en el panel abierto de un DatePicker. */
function calendarAt(target: Element): HTMLElement | null {
  const cal = target.closest<HTMLElement>(".z-calendar");
  return cal && (inDom(cal) || isOpen(cal.closest<HTMLElement>("[popover]"))) ? cal : null;
}

function onClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const cal = calendarAt(target);
  if (cal) {
    const nav = target.closest<HTMLButtonElement>(".z-calendar__nav");
    const day = target.closest<HTMLElement>(".z-calendar__day");
    if (nav && !nav.disabled) {
      const back = nav === cal.querySelector(".z-calendar__nav");
      stateOf(cal).focused = null;
      showMonth(cal, monthOf(addMonths(`${visibleMonth(cal)}-01`, back ? -1 : 1)));
    } else if (day?.dataset.date) selectDate(cal, day.dataset.date);
    return;
  }
  const control = target.closest<HTMLElement>(`${PICKER} > button.z-select__control`);
  if (!control || !inDom(control)) return;
  const picker = control.parentElement!;
  if (isOpen(popupFor(control))) closePicker(picker);
  else openPicker(picker);
}

function previewAt(target: EventTarget | null, leaving = false): void {
  if (!(target instanceof Element)) return;
  const day = target.closest<HTMLElement>(".z-calendar__day");
  const cal = calendarAt(target);
  if (!cal || cal.dataset.mode !== "range") return;
  const state = stateOf(cal);
  const next = leaving ? null : (day?.dataset.date ?? state.preview);
  if (next === state.preview) return;
  state.preview = next;
  paint(cal);
}

export function setup(on: Listen): void {
  on(document, "click", onClick);
  on(document, "keydown", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || event.defaultPrevented) return;
    const day = target.closest<HTMLElement>(".z-calendar__grid .z-calendar__day");
    const cal = day && calendarAt(day);
    if (cal && day.dataset.date) onCalendarKey(cal, day.dataset.date, event);
  });
  on(document, "focusin", (event) => {
    const day = (event.target as Element).closest?.<HTMLElement>(".z-calendar__day");
    const cal = day && calendarAt(day);
    if (!cal || !day.dataset.date) return;
    const state = stateOf(cal);
    state.focused = day.dataset.date;
    if (cal.dataset.mode === "range") state.preview = day.dataset.date;
    paint(cal);
  });
  on(document, "pointerover", (event) => previewAt(event.target));
  on(document, "pointerout", (event) => {
    const grid = (event.target as Element).closest?.(".z-calendar__grid");
    if (grid && !grid.contains(event.relatedTarget as Node | null)) previewAt(event.target, true);
  });
}

export function hydrate(root: ParentNode): void {
  for (const picker of all(root, PICKER)) syncPicker(picker);
  for (const cal of root.querySelectorAll<HTMLElement>(".z-calendar")) if (calendarAt(cal)) renderMonth(cal);
  if (root instanceof HTMLElement && root.matches(".z-calendar") && calendarAt(root)) renderMonth(root);
}
