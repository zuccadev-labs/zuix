// Calendar y DatePicker sin framework. El calendario se genera a partir de los atributos de `.z-calendar` con el
// mismo marcado que el binding de React y el mismo modelo (`core/calendar`): mismas celdas, mismas teclas, mismos
// valores. Fechas ISO, cálculo en UTC, sin librerías.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { chevronUpDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-up-down";
import { minus } from "@zuccadev-labs/zuix-zicon/icons/minus";
import { plus } from "@zuccadev-labs/zuix-zicon/icons/plus";
import {
  anchorOf,
  buildCalendar,
  captionOptions,
  choose,
  chooseWeek,
  clampUnit,
  clampView,
  dayKeyTarget,
  initialMonth,
  navStep,
  parseValueText,
  rangeNights,
  readSelection,
  revealMonth,
  stepRange,
  selectionText,
  selectionValue,
  shiftMonth,
  unitKeyTarget,
  unitStart,
  valueText,
  VIEWS,
  type CalendarInput,
  type CalendarMode,
  type CalendarModel,
  type CalendarRules,
  type CalendarSelection,
  type CalendarValue,
  type CalendarView,
  type DayCell,
  type UnitCell,
} from "../core/calendar";
import {
  addDays,
  diffDays,
  formatDateRange,
  isoWeekText,
  localeWeekInfo,
  monthOf,
  parse,
  resolvePreset,
  safeLocale,
  todayISO,
  valid,
  validMonth,
  weekNumber,
  weekRangeDays,
  weekRangeOf,
  weekStartOf,
  type DateRange,
} from "../core/date";
import { all, emit, flag, hidePopup, inDom, isOpen, ownerOf, popupFor, showPopup } from "./forms-popup";
import { closeDialog, openDialog } from "./core";
import { logicalKey, setMarkup, type Listen } from "./shared";

registerIcons([chevronLeft, chevronRight, chevronUpDown, minus, plus]);

export type { DateRange };

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (name: string, on: boolean, value = "") => (on ? ` ${name}="${esc(value)}"` : "");
const MODIFIER = /^[a-z][a-z0-9-]*$/;

/** Funciones que no caben en un atributo: se pasan con `setCalendarOptions(cal, …)`. */
export interface CalendarOptions {
  isDateDisabled?: (date: string) => boolean;
  isDateUnavailable?: (date: string) => boolean;
  /** Atributos `data-<nombre>` en el día cuando la función devuelve `true`. */
  modifiers?: Record<string, (date: string) => boolean>;
  /** Texto extra dentro del día (puntos, precios). Se escribe con `textContent`. */
  dayContent?: (date: string) => string | null | undefined;
  /** Texto que se añade al nombre accesible del día. */
  dayDescription?: (date: string) => string | null | undefined;
  /** Estancia: días en que se puede terminar un rango pero no empezarlo. */
  isDateCheckoutOnly?: (date: string) => boolean;
}

/* ---------- Calendar ---------- */

interface CalState {
  /** Día, mes o año activo (foco itinerante). */
  focused: string | null;
  /** Día bajo el puntero o el foco mientras se elige el final de un rango o una semana. */
  preview: string | null;
  /** Clave de la estructura pintada: si no cambia, solo se actualizan los atributos. */
  shape: string;
}

const states = new WeakMap<HTMLElement, CalState>();
const hooks = new WeakMap<HTMLElement, CalendarOptions>();
let calSeq = 0;
let optionsVersion = 0;

function stateOf(cal: HTMLElement): CalState {
  let state = states.get(cal);
  if (!state) {
    state = { focused: null, preview: null, shape: "" };
    states.set(cal, state);
  }
  return state;
}

const yes = (value: string | undefined) => value !== undefined && value !== "false";
const num = (value: string | undefined) =>
  value === undefined || value === "" || !Number.isFinite(Number(value)) ? undefined : Number(value);
const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
function json<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

interface Preset {
  label: string;
  value: string;
}

function config(cal: HTMLElement) {
  const data = cal.dataset;
  const mode: CalendarMode = data.mode === "range" || data.mode === "multiple" ? data.mode : "single";
  const minView = clampView(data.minView);
  const maxView = clampView(data.maxView ?? "year", minView);
  const locale = safeLocale(data.locale);
  const week = localeWeekInfo(locale);
  const weekStart = Number.isInteger(num(data.weekStart)) ? (((num(data.weekStart) as number) % 7) + 7) % 7 : week.firstDay;
  const hook = hooks.get(cal) ?? {};
  const offDays = list(data.disabledWeekdays).map(Number);
  const offDates = new Set(list(data.disabledDates));
  const reserved = new Set(list(data.unavailableDates));
  const checkout = new Set(list(data.checkoutOnlyDates));
  const nights = data.rangeUnit === "nights";
  const rules: CalendarRules = {
    min: data.min ?? null,
    max: data.max ?? null,
    isDateDisabled: (date) => offDays.includes(parse(date).getUTCDay()) || offDates.has(date) || Boolean(hook.isDateDisabled?.(date)),
    isDateUnavailable:
      reserved.size || hook.isDateUnavailable ? (date) => reserved.has(date) || Boolean(hook.isDateUnavailable?.(date)) : undefined,
    minRange: num(data.minRange),
    maxRange: num(data.maxRange),
    rangeCrossesUnavailable: data.rangeCrosses === "allow" ? "allow" : "block",
    allowSingleDayRange: nights ? false : data.singleDayRange !== "false",
    maxSelected: num(data.maxSelected),
    isDateCheckoutOnly:
      checkout.size || hook.isDateCheckoutOnly ? (date) => checkout.has(date) || Boolean(hook.isDateCheckoutOnly?.(date)) : undefined,
    nights,
  };
  const today = valid(data.today) ? data.today : todayISO();
  const n = Math.min(12, Math.max(1, Math.floor(num(data.months) ?? 1)));
  const presets = (json<Preset[]>(data.presets) ?? []).filter((p) => p && typeof p.label === "string" && typeof p.value === "string");
  return {
    mode,
    minView,
    maxView,
    locale,
    week,
    weekStart,
    rules,
    hook,
    today,
    n,
    paged: yes(data.paged),
    selection: parseValueText(mode, data.value, minView),
    caption: (["dropdown", "dropdown-months", "dropdown-years"] as const).find((c) => c === data.caption) ?? "label",
    presets,
    legend: json<Record<string, string>>(data.legend) ?? {},
    labels: {
      previous: data.previousLabel ?? "Previous month",
      next: data.nextLabel ?? "Next month",
      today: data.todayLabel ?? "Today",
      week: data.weekLabel ?? "Week",
      unavailable: data.unavailableLabel ?? "unavailable",
      month: data.monthLabel ?? "Month",
      year: data.yearLabel ?? "Year",
      chooseMonth: data.chooseMonthLabel ?? "Choose month",
      chooseYear: data.chooseYearLabel ?? "Choose year",
      presets: data.presetsLabel ?? "Quick pick",
      apply: data.applyLabel ?? "Apply",
      cancel: data.cancelLabel ?? "Cancel",
      checkoutOnly: data.checkoutOnlyLabel ?? "check-out only",
      minimum: data.minRangeLabel ?? (nights ? "{n}-night minimum" : "{n}-day minimum"),
      length: data.lengthLabel ?? (nights ? "{n} nights" : "{n} days"),
      lengthOne: data.lengthOneLabel ?? (nights ? "1 night" : "1 day"),
      decrease: data.decreaseLabel ?? (nights ? "One night less" : "One day less"),
      increase: data.increaseLabel ?? (nights ? "One night more" : "One day more"),
      flexGroup: data.flexibilityGroupLabel ?? "Date flexibility",
      exact: data.exactDatesLabel ?? "Exact dates",
      flex: data.flexibilityLabel ?? "± {n} days",
      flexOne: data.flexibilityOneLabel ?? "± 1 day",
    },
    nights,
    stepper: yes(data.lengthStepper),
    flexOptions:
      data.flexibilityOptions !== undefined
        ? list(data.flexibilityOptions).map(Number).filter(Number.isFinite)
        : data.flexibility !== undefined
          ? [0, 1, 2, 3, 7]
          : [],
    flexibility: num(data.flexibility) ?? 0,
  };
}
type Config = ReturnType<typeof config>;

function visibleMonth(cal: HTMLElement, c = config(cal)): string {
  if (validMonth(cal.dataset.month)) return cal.dataset.month;
  const month = initialMonth(null, anchorOf(c.selection), c.today, c.rules);
  cal.dataset.month = month;
  return month;
}

function viewOf(cal: HTMLElement, c: Config): CalendarView {
  return clampView(cal.dataset.view ?? c.minView, c.minView, c.maxView);
}

function inputOf(cal: HTMLElement, c: Config): CalendarInput {
  const state = stateOf(cal);
  const view = viewOf(cal, c);
  const n = view === "day" ? c.n : 1;
  const data = cal.dataset;
  return {
    mode: c.mode,
    selection: c.selection,
    rules: c.rules,
    month: visibleMonth(cal, c),
    numberOfMonths: n,
    view,
    minView: c.minView,
    weekStart: c.weekStart,
    weekend: c.week.weekend,
    minimalDays: c.week.minimalDays,
    weekNumbering: data.weekNumbering === "locale" ? "locale" : "iso",
    showWeekNumber: yes(data.weekNumbers),
    fixedWeeks: yes(data.fixedWeeks),
    showOutsideDays: data.outsideDays === undefined ? n === 1 : data.outsideDays !== "false",
    outsideDaySelectable: data.outsideSelectable === "false" ? false : undefined,
    unit: data.selectionUnit === "week" ? "week" : "day",
    today: c.today,
    focused: state.focused,
    preview: state.preview,
    locale: c.locale,
    weekdayFormat: data.weekdayFormat === "narrow" || data.weekdayFormat === "long" ? data.weekdayFormat : "short",
    labels: {
      unavailable: c.labels.unavailable,
      week: c.labels.week,
      chooseMonth: c.labels.chooseMonth,
      chooseYear: c.labels.chooseYear,
      checkoutOnly: c.labels.checkoutOnly,
      minimum: c.labels.minimum,
    },
    modifiers: c.hook.modifiers,
    dayDescription: c.hook.dayDescription,
  };
}

/** Valor de un preajuste para el modo (como `presetValue` del binding de React). */
function presetValue(value: string, mode: CalendarMode, today: string, weekStart: number): CalendarValue {
  const range = resolvePreset(value, today, weekStart);
  if (!range) return null;
  if (mode === "single") return range.from;
  if (mode === "range") return range;
  return Array.from({ length: Math.min(366, diffDays(range.from, range.to) + 1) }, (_, i) => addDays(range.from, i));
}

/** Resumen del pie con confirmación: la fecha, el rango o el número de fechas. */
function summaryText(c: Config): string {
  if (c.mode === "range") return formatDateRange(c.selection.range, c.locale, { month: "short", day: "numeric", year: "numeric" });
  if (c.mode === "multiple") return c.selection.multiple.length ? String(c.selection.multiple.length) : "";
  return c.selection.single && valid(c.selection.single) ? formatDateRange({ from: c.selection.single, to: null }, c.locale) : "";
}

function dayMarkup(cell: DayCell, c: Config): string {
  if (cell.hidden) return '<td class="z-calendar__cell" data-outside=""></td>';
  const mods = cell.modifiers
    .filter((m) => MODIFIER.test(m))
    .map((m) => ` data-${m}=""`)
    .join("");
  return `<td class="z-calendar__cell" aria-selected="${cell.inSelection}"${attr("data-range", Boolean(cell.range), cell.range)}${attr("data-preview", cell.preview)}${attr("data-row-start", cell.rowStart)}${attr("data-row-end", cell.rowEnd)}><button type="button" class="z-calendar__day" data-date="${cell.date}"${attr("data-selected", cell.selected)}${attr("data-today", cell.today)}${attr("data-outside", cell.outside)}${attr("data-unavailable", cell.unavailable)}${attr("data-weekend", cell.weekend)}${attr("data-checkout-only", cell.checkoutOnly)}${attr("data-below-minimum", cell.belowMinimum)}${mods}${attr("aria-disabled", cell.disabled, "true")}${attr("aria-current", cell.today, "date")} aria-label="${esc(cell.ariaLabel)}" tabindex="${cell.tabbable ? 0 : -1}">${esc(cell.label)}</button>${c.hook.dayContent?.(cell.date) ? `<span class="z-calendar__day-content" data-for="${cell.date}" aria-hidden="true"></span>` : ""}</td>`;
}

function unitMarkup(cell: UnitCell): string {
  return `<td class="z-calendar__cell" aria-selected="${cell.inSelection}"${attr("data-range", Boolean(cell.range), cell.range)}${attr("data-preview", cell.preview)}><button type="button" class="z-calendar__unit" data-value="${cell.value}"${attr("data-selected", cell.selected)}${attr("data-current", cell.current)}${attr("data-outside", cell.outside)}${attr("aria-disabled", cell.disabled, "true")} aria-label="${esc(cell.ariaLabel)}" tabindex="${cell.tabbable ? 0 : -1}">${esc(cell.label)}</button></td>`;
}

function markup(cal: HTMLElement, model: CalendarModel, c: Config, input: CalendarInput): string {
  if (!cal.id && !cal.dataset.zId) cal.dataset.zId = `z-calendar-${++calSeq}`;
  const id = cal.id || (cal.dataset.zId as string);
  const titleId = `${id}-title`;
  const presetsId = `${id}-presets`;
  const view = model.view;
  const n = view === "day" ? c.n : 1;
  const dropdown = c.caption !== "label" && view === "day" && n === 1;
  const up = VIEWS[VIEWS.indexOf(view) + 1];
  const canGoUp = Boolean(up) && VIEWS.indexOf(view) < VIEWS.indexOf(c.maxView);
  const multi = c.mode !== "single";
  let html = "";
  if (c.presets.length) {
    html += `<div class="z-calendar__presets" role="group" aria-labelledby="${esc(presetsId)}"><p class="z-calendar__presets-label" id="${esc(presetsId)}">${esc(c.labels.presets)}</p>`;
    c.presets.forEach((preset, i) => {
      html += `<button type="button" class="z-calendar__preset" data-preset="${i}" aria-pressed="false">${esc(preset.label)}</button>`;
    });
    html += "</div>";
  }
  html += `<div class="z-calendar__main"><div class="z-calendar__header"><button type="button" class="z-calendar__nav" data-nav="previous" aria-label="${esc(c.labels.previous)}" title="${esc(c.labels.previous)}">${iconSvg("chevron-left", { size: 16 })}</button>`;
  if (dropdown) {
    const caption = captionOptions(model.firstMonth, c.rules, c.locale);
    html += '<div class="z-calendar__selects">';
    if (c.caption !== "dropdown-years")
      html += `<span class="z-calendar__select-wrap"><select class="z-calendar__select" data-part="month" aria-label="${esc(c.labels.month)}">${caption.months.map((m) => `<option value="${m.value}"${attr("disabled", m.disabled)}>${esc(m.label)}</option>`).join("")}</select>${iconSvg("chevron-up-down", { size: 14 })}</span>`;
    if (c.caption !== "dropdown-months")
      html += `<span class="z-calendar__select-wrap"><select class="z-calendar__select" data-part="year" aria-label="${esc(c.labels.year)}">${caption.years.map((y) => `<option value="${y.value}">${esc(y.label)}</option>`).join("")}</select>${iconSvg("chevron-up-down", { size: 14 })}</span>`;
    html += "</div>";
  }
  html += `<div class="z-calendar__title" id="${esc(titleId)}" aria-live="polite"${attr("data-hidden", dropdown)}>${
    canGoUp && !dropdown
      ? `<button type="button" class="z-calendar__view" title="${esc(view === "day" ? c.labels.chooseMonth : c.labels.chooseYear)}"></button>`
      : ""
  }</div><button type="button" class="z-calendar__nav" data-nav="next" aria-label="${esc(c.labels.next)}" title="${esc(c.labels.next)}">${iconSvg("chevron-right", { size: 16 })}</button></div><div class="z-calendar__months">`;
  if (view === "day") {
    for (const m of model.months) {
      html += `<div class="z-calendar__month" data-month="${m.month}"><table class="z-calendar__grid" role="grid"${n === 1 ? ` aria-labelledby="${esc(titleId)}"` : ` aria-label="${esc(m.title)}"`}${attr("aria-multiselectable", multi, "true")}><thead><tr>`;
      if (input.showWeekNumber)
        html += `<th scope="col" abbr="${esc(c.labels.week)}" class="z-calendar__weekday" data-week-number=""><span class="z-sr-only">${esc(c.labels.week)}</span></th>`;
      for (const w of model.weekdays)
        html += `<th scope="col" abbr="${esc(w.long)}" class="z-calendar__weekday"${attr("data-weekend", w.weekend)}>${esc(w.short)}</th>`;
      html += "</tr></thead><tbody>";
      for (const row of m.weeks) {
        html += "<tr>";
        if (row.number)
          html += yes(cal.dataset.weekSelect)
            ? `<th scope="row" class="z-calendar__week-number"><button type="button" class="z-calendar__week-button" data-week="${esc(row.cells[0]?.date ?? "")}" data-week-value="${row.number.value}" aria-label="${esc(row.number.ariaLabel)}">${esc(row.number.label)}</button></th>`
            : `<th scope="row" class="z-calendar__week-number" aria-label="${esc(row.number.ariaLabel)}">${esc(row.number.label)}</th>`;
        for (const cell of row.cells) html += dayMarkup(cell, c);
        html += "</tr>";
      }
      html += "</tbody></table></div>";
    }
  } else {
    html += `<div class="z-calendar__month"><table class="z-calendar__grid" role="grid" data-view="${view}" aria-label="${esc(model.unitsLabel)}"${attr("aria-multiselectable", multi && view === c.minView, "true")}><tbody>`;
    for (const row of model.units) html += `<tr>${row.map(unitMarkup).join("")}</tr>`;
    html += "</tbody></table></div>";
  }
  html += "</div>";
  if (c.mode === "range" && c.flexOptions.length) {
    html += `<div class="z-calendar__flex" role="group" aria-label="${esc(c.labels.flexGroup)}">`;
    for (const days of c.flexOptions)
      html += `<button type="button" class="z-calendar__flex-chip" data-flexibility-option="${days}" aria-pressed="${days === c.flexibility}">${esc(days === 0 ? c.labels.exact : days === 1 ? c.labels.flexOne : c.labels.flex.replace("{n}", String(days)))}</button>`;
    html += "</div>";
  }
  if (c.mode === "range" && c.stepper)
    html += `<div class="z-calendar__stepper"><button type="button" class="z-calendar__stepper-btn" data-step="-1" aria-label="${esc(c.labels.decrease)}">${iconSvg("minus", { size: 16 })}</button><output class="z-calendar__length" aria-live="polite"></output><button type="button" class="z-calendar__stepper-btn" data-step="1" aria-label="${esc(c.labels.increase)}">${iconSvg("plus", { size: 16 })}</button></div>`;
  const todayButton = yes(cal.dataset.todayButton);
  const confirm = yes(cal.dataset.confirm);
  if (todayButton || confirm) {
    html += '<div class="z-calendar__footer">';
    if (todayButton) html += `<button type="button" class="z-calendar__today">${esc(c.labels.today)}</button>`;
    if (confirm)
      html += `<span class="z-calendar__summary"></span><span class="z-calendar__actions"><button type="button" class="z-btn z-btn--ghost z-calendar__cancel" data-size="sm">${esc(c.labels.cancel)}</button><button type="button" class="z-btn z-btn--primary z-calendar__apply" data-size="sm">${esc(c.labels.apply)}</button></span>`;
    html += "</div>";
  }
  const legend = (["today", "selected", "unavailable"] as const).filter((k) => typeof c.legend[k] === "string" && c.legend[k]);
  if (legend.length)
    html += `<ul class="z-calendar__legend">${legend.map((k) => `<li data-legend="${k}"><span class="z-calendar__swatch" aria-hidden="true"></span>${esc(c.legend[k]!)}</li>`).join("")}</ul>`;
  html += "</div>";
  return html;
}

/** Actualiza en sitio lo que cambia sin cambiar de estructura: estado de celdas, título, flechas, selects. */
function patch(cal: HTMLElement, model: CalendarModel, c: Config): void {
  const titleEl = cal.querySelector<HTMLElement>(".z-calendar__title");
  const viewButton = titleEl?.querySelector<HTMLElement>(".z-calendar__view");
  const titleTarget = viewButton ?? titleEl;
  if (titleTarget && titleTarget.textContent !== model.title) titleTarget.textContent = model.title;
  const prev = cal.querySelector<HTMLButtonElement>('.z-calendar__nav[data-nav="previous"]');
  const next = cal.querySelector<HTMLButtonElement>('.z-calendar__nav[data-nav="next"]');
  if (prev) prev.disabled = !model.canPrevious;
  if (next) next.disabled = !model.canNext;
  const monthSelect = cal.querySelector<HTMLSelectElement>('.z-calendar__select[data-part="month"]');
  const yearSelect = cal.querySelector<HTMLSelectElement>('.z-calendar__select[data-part="year"]');
  if (monthSelect) monthSelect.value = model.firstMonth;
  if (yearSelect) yearSelect.value = model.firstMonth.slice(0, 4);
  const current = valueText(c.mode, c.selection);
  cal.querySelectorAll<HTMLElement>(".z-calendar__preset").forEach((button) => {
    const preset = c.presets[Number(button.dataset.preset)];
    const value = preset ? presetValue(preset.value, c.mode, c.today, c.weekStart) : null;
    button.setAttribute("aria-pressed", String(current !== "" && valueText(c.mode, readSelection(c.mode, value, c.minView)) === current));
  });
  const summary = cal.querySelector<HTMLElement>(".z-calendar__summary");
  if (summary) summary.textContent = summaryText(c);
  const length = cal.querySelector<HTMLElement>(".z-calendar__length");
  if (length) {
    const n = rangeNights(c.selection.range);
    const value = n === null ? null : n + (c.nights ? 0 : 1);
    const text = value === null ? "" : value === 1 ? c.labels.lengthOne : c.labels.length.replace("{n}", String(value));
    if (length.textContent !== text) length.textContent = text;
    for (const button of cal.querySelectorAll<HTMLElement>(".z-calendar__stepper-btn"))
      flag(button, "aria-disabled", !stepRange(c.selection.range, Number(button.dataset.step), c.rules), "true");
  }
  const cells = [...cal.querySelectorAll<HTMLElement>(".z-calendar__months .z-calendar__cell")];
  if (model.view === "day") {
    const flat = model.months.flatMap((m) => m.weeks.flatMap((w) => w.cells));
    flat.forEach((cell, i) => {
      const td = cells[i];
      const button = td?.firstElementChild as HTMLElement | null;
      if (!td || !button || cell.hidden) return;
      td.setAttribute("aria-selected", String(cell.inSelection));
      flag(td, "data-range", Boolean(cell.range), cell.range);
      flag(td, "data-preview", cell.preview);
      flag(td, "data-row-start", cell.rowStart);
      flag(td, "data-row-end", cell.rowEnd);
      flag(button, "data-selected", cell.selected);
      flag(button, "data-today", cell.today);
      flag(button, "aria-current", cell.today, "date");
      flag(button, "aria-disabled", cell.disabled, "true");
      flag(button, "data-below-minimum", cell.belowMinimum);
      if (button.getAttribute("aria-label") !== cell.ariaLabel) button.setAttribute("aria-label", cell.ariaLabel);
      button.tabIndex = cell.tabbable ? 0 : -1;
      // Aviso visible del mínimo en el día bajo el puntero o el foco.
      const hint = td.querySelector<HTMLElement>(".z-calendar__hint");
      if (cell.hint && !hint) {
        const span = document.createElement("span");
        span.className = "z-calendar__hint";
        span.setAttribute("aria-hidden", "true");
        span.textContent = cell.hint;
        td.append(span);
      } else if (!cell.hint && hint) hint.remove();
    });
  } else {
    model.units.flat().forEach((cell, i) => {
      const td = cells[i];
      const button = td?.firstElementChild as HTMLElement | null;
      if (!td || !button) return;
      td.setAttribute("aria-selected", String(cell.inSelection));
      flag(td, "data-range", Boolean(cell.range), cell.range);
      flag(td, "data-preview", cell.preview);
      flag(button, "data-selected", cell.selected);
      flag(button, "aria-disabled", cell.disabled, "true");
      button.tabIndex = cell.tabbable ? 0 : -1;
    });
  }
}

/** Pinta el calendario: estructura nueva si cambió el mes, la vista o la configuración; si no, solo atributos. */
function render(cal: HTMLElement): void {
  const c = config(cal);
  const input = inputOf(cal, c);
  const model = buildCalendar(input);
  const state = stateOf(cal);
  const months = model.view === "day" ? c.n : 1;
  // Atributos normalizados antes de calcular la forma: así no provocan otra reconstrucción en el siguiente pintado.
  cal.dataset.mode = c.mode;
  cal.dataset.view = model.view;
  if (!cal.dataset.cellSize) cal.dataset.cellSize = "md";
  // `data-presets` (JSON) ya marca la variante en la hoja; no se reescribe.
  flag(cal, "data-week-numbers", Boolean(input.showWeekNumber));
  flag(cal, "data-caption", c.caption !== "label" && model.view === "day" && months === 1, c.caption);
  if (months > 1) cal.style.setProperty("--z-calendar-months", String(months));
  else cal.style.removeProperty("--z-calendar-months");
  const { value: _value, zId: _id, ...rest } = cal.dataset;
  const shape = JSON.stringify([model.view, model.firstMonth, rest, optionsVersion, hooks.has(cal)]);
  if (state.shape !== shape || !cal.querySelector(".z-calendar__main")) {
    state.shape = shape;
    // La estructura se rehace: el foco vuelve a la pieza equivalente (flecha, select, preajuste, día…).
    const active = document.activeElement;
    const restore = active instanceof HTMLElement && cal.contains(active) ? focusSelector(active) : null;
    setMarkup(cal, markup(cal, model, c, input));
    if (restore) cal.querySelector<HTMLElement>(restore)?.focus({ preventScroll: true });
    if (c.hook.dayContent)
      for (const content of cal.querySelectorAll<HTMLElement>(".z-calendar__day-content")) {
        const date = content.dataset.for;
        content.textContent = date ? (c.hook.dayContent(date) ?? "") : "";
      }
  }
  patch(cal, model, c);
}

/** Selector que encuentra, tras rehacer el marcado, la pieza equivalente a `el`. */
function focusSelector(el: HTMLElement): string | null {
  if (el.dataset.nav) return `.z-calendar__nav[data-nav="${el.dataset.nav}"]`;
  if (el.dataset.part) return `.z-calendar__select[data-part="${el.dataset.part}"]`;
  if (el.dataset.preset) return `.z-calendar__preset[data-preset="${el.dataset.preset}"]`;
  if (el.dataset.week) return `.z-calendar__week-button[data-week="${el.dataset.week}"]`;
  if (el.dataset.date) return `.z-calendar__day[data-date="${el.dataset.date}"]`;
  if (el.dataset.value) return `.z-calendar__unit[data-value="${el.dataset.value}"]`;
  for (const name of ["z-calendar__view", "z-calendar__today", "z-calendar__apply", "z-calendar__cancel"])
    if (el.classList.contains(name)) return `.${name}`;
  return null;
}

/** Celda de un valor (día, mes o año); con varios meses, la del propio mes antes que la de fuera. */
function cellFor(cal: HTMLElement, value: string): HTMLElement | null {
  if (value.length === 10)
    return (
      cal.querySelector<HTMLElement>(`.z-calendar__day[data-date="${value}"]:not([data-outside])`) ??
      cal.querySelector<HTMLElement>(`.z-calendar__day[data-date="${value}"]`)
    );
  return cal.querySelector<HTMLElement>(`.z-calendar__unit[data-value="${value}"]`);
}

function showMonth(cal: HTMLElement, month: string): void {
  if (month === cal.dataset.month) return;
  cal.dataset.month = month;
  emit(cal, "monthchange", { month });
}

/** Mueve el foco a un día, mes o año (acotado a los límites), muestra su mes y lo enfoca. */
function focusTarget(cal: HTMLElement, target: string): void {
  const c = config(cal);
  const view = viewOf(cal, c);
  const value = clampUnit(target, c.rules);
  stateOf(cal).focused = value;
  showMonth(cal, view === "day" ? revealMonth(visibleMonth(cal, c), c.n, value, c.paged) : monthOf(unitStart(value)));
  render(cal);
  cellFor(cal, value)?.focus();
}

function setView(cal: HTMLElement, view: CalendarView): void {
  const c = config(cal);
  const next = clampView(view, c.minView, c.maxView);
  if (next === viewOf(cal, c)) return;
  cal.dataset.view = next;
  emit(cal, "viewchange", { view: next });
}

function writeValue(cal: HTMLElement, text: string): void {
  if (text) cal.dataset.value = text;
  else delete cal.dataset.value;
}

/** Aplica un valor nuevo del calendario y lo comunica (al DatePicker que lo contiene o con z:change). */
function commit(cal: HTMLElement, value: CalendarValue, c: Config): void {
  const selection = readSelection(c.mode, value, c.minView);
  writeValue(cal, valueText(c.mode, selection));
  stateOf(cal).preview = null;
  render(cal);
  // Dentro de un DatePicker, el cambio lo anuncia el campo.
  const picker = pickerOf(cal);
  if (picker?.matches(PICKER)) pickFromCalendar(picker, selection, c);
  else emit(cal, "change", { value: selectionValue(c.mode, selection) });
}

function pick(cal: HTMLElement, value: string): void {
  const c = config(cal);
  const next = choose(c.mode, c.selection, value, c.rules, {
    unit: cal.dataset.selectionUnit === "week" ? "week" : "day",
    weekStart: c.weekStart,
  });
  stateOf(cal).focused = value;
  if (value.length === 10 && viewOf(cal, c) === "day") showMonth(cal, revealMonth(visibleMonth(cal, c), c.n, value, c.paged));
  if (next === undefined) {
    render(cal);
    cellFor(cal, value)?.focus();
    return;
  }
  commit(cal, next, c);
  cellFor(cal, value)?.focus();
}

function onUnit(cal: HTMLElement, value: string): void {
  const c = config(cal);
  const view = viewOf(cal, c);
  if (view === c.minView) {
    pick(cal, value);
    return;
  }
  const lower = VIEWS[VIEWS.indexOf(view) - 1]!;
  const month = view === "year" ? `${value}-${visibleMonth(cal, c).slice(5, 7)}` : value;
  showMonth(cal, month);
  setView(cal, lower);
  const anchor = anchorOf(c.selection);
  const target = lower === "day" ? (anchor && monthOf(unitStart(anchor)) === month ? unitStart(anchor) : `${month}-01`) : month;
  focusTarget(cal, target);
}

function goToday(cal: HTMLElement): void {
  const c = config(cal);
  const target = c.minView === "day" ? c.today : c.minView === "month" ? c.today.slice(0, 7) : c.today.slice(0, 4);
  setView(cal, c.minView);
  stateOf(cal).focused = target;
  showMonth(cal, revealMonth(visibleMonth(cal, c), c.minView === "day" ? c.n : 1, unitStart(target), c.paged));
  const next = choose(c.mode, c.selection, target, c.rules, {
    unit: cal.dataset.selectionUnit === "week" ? "week" : "day",
    weekStart: c.weekStart,
  });
  if (next !== undefined && c.mode !== "multiple") commit(cal, next, config(cal));
  else render(cal);
  cellFor(cal, target)?.focus();
}

/** Fija el valor de un Calendar: fecha ISO, `{ from, to }`, lista de fechas o `null`. Muestra su mes y emite z:change. */
export function setCalendarValue(cal: HTMLElement, value: CalendarValue | DateRange): void {
  const c = config(cal);
  const selection = readSelection(c.mode, value, c.minView);
  writeValue(cal, valueText(c.mode, selection));
  const anchor = anchorOf(selection);
  if (anchor) cal.dataset.month = monthOf(unitStart(anchor));
  stateOf(cal).focused = null;
  render(cal);
  emit(cal, "change", { value: selectionValue(c.mode, selection) });
}

/** Funciones de un Calendar (fechas deshabilitadas o reservadas, modificadores, contenido por día) y lo vuelve a pintar. */
export function setCalendarOptions(cal: HTMLElement, options: CalendarOptions): void {
  hooks.set(cal, options);
  optionsVersion++;
  if (cal.querySelector(".z-calendar__main") || calendarAt(cal)) render(cal);
}

function onCalendarKey(cal: HTMLElement, target: HTMLElement, event: KeyboardEvent): void {
  const c = config(cal);
  const view = viewOf(cal, c);
  const key = logicalKey(event.key, cal);
  if (view === "day") {
    const date = target.closest<HTMLElement>(".z-calendar__day")?.dataset.date;
    const next = date
      ? dayKeyTarget({ key, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey }, date, c.weekStart)
      : null;
    if (!next) return;
    event.preventDefault();
    focusTarget(cal, next);
    return;
  }
  const value = target.closest<HTMLElement>(".z-calendar__unit")?.dataset.value;
  if (!value) return;
  if (event.key === "Escape" && view !== c.minView) {
    // Vuelve a la vista de elección sin cambiar el valor (y sin cerrar el DatePicker).
    event.preventDefault();
    event.stopPropagation();
    setView(cal, c.minView);
    const anchor = anchorOf(c.selection);
    const month = visibleMonth(cal, c);
    focusTarget(cal, c.minView === "day" ? (anchor && monthOf(unitStart(anchor)) === month ? unitStart(anchor) : `${month}-01`) : value);
    return;
  }
  const next = unitKeyTarget(
    view as "month" | "year",
    { key, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey },
    value,
  );
  if (!next) return;
  event.preventDefault();
  focusTarget(cal, next);
}

/* ---------- DatePicker ---------- */

const PICKER = ".z-datepicker";
/** Atributos del DatePicker que pasan a su calendario al abrir. */
const FORWARDED = [
  "mode",
  "min",
  "max",
  "locale",
  "weekStart",
  "disabledWeekdays",
  "disabledDates",
  "unavailableDates",
  "outsideDays",
  "outsideSelectable",
  "previousLabel",
  "nextLabel",
  "months",
  "paged",
  "caption",
  "minView",
  "maxView",
  "fixedWeeks",
  "weekNumbers",
  "weekNumbering",
  "weekSelect",
  "weekdayFormat",
  "today",
  "todayButton",
  "todayLabel",
  "presets",
  "presetsLabel",
  "presetsPlacement",
  "cellSize",
  "selectionUnit",
  "minRange",
  "maxRange",
  "rangeCrosses",
  "singleDayRange",
  "maxSelected",
  "weekLabel",
  "unavailableLabel",
  "monthLabel",
  "yearLabel",
  "chooseMonthLabel",
  "chooseYearLabel",
  "legend",
  "rangeUnit",
  "checkoutOnlyDates",
  "checkoutOnlyLabel",
  "minRangeLabel",
  "lengthStepper",
  "lengthLabel",
  "lengthOneLabel",
  "decreaseLabel",
  "increaseLabel",
  "flexibility",
  "flexibilityOptions",
  "flexibilityGroupLabel",
  "exactDatesLabel",
  "flexibilityLabel",
  "flexibilityOneLabel",
  "confirm",
  "applyLabel",
  "cancelLabel",
];

/* Hoja inferior (`data-drawer="auto|always"`): el calendario pasa del popover a un `<dialog class="z-drawer">` modal. */
const DRAWER_QUERY = "(pointer: coarse), (max-width: 640px)";
const drawerOf = new WeakMap<HTMLElement, HTMLDialogElement>();
const drawerOwner = new WeakMap<HTMLDialogElement, HTMLElement>();
const wantsDrawer = (picker: HTMLElement) =>
  picker.dataset.drawer === "always" || (picker.dataset.drawer === "auto" && matchMedia(DRAWER_QUERY).matches);

/** DatePicker dueño de un calendario: el del popover abierto o el de la hoja inferior. */
function pickerOf(cal: HTMLElement): HTMLElement | undefined {
  const dialog = cal.closest<HTMLDialogElement>("dialog.z-datepicker__drawer");
  return dialog ? drawerOwner.get(dialog) : ownerOf(cal.closest<HTMLElement>("[popover]"));
}

function ensureDrawer(picker: HTMLElement, panel: HTMLElement): HTMLDialogElement {
  let dialog = drawerOf.get(picker);
  if (dialog?.isConnected) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "z-liquid z-drawer z-datepicker__drawer";
  dialog.dataset.side = "bottom";
  dialog.dataset.size = "sm";
  dialog.setAttribute("aria-label", panel.getAttribute("aria-label") ?? "Choose date");
  const body = document.createElement("div");
  body.className = "z-drawer__body";
  dialog.append(body);
  picker.after(dialog);
  drawerOf.set(picker, dialog);
  drawerOwner.set(dialog, picker);
  dialog.addEventListener("close", () => {
    const control = picker.querySelector<HTMLButtonElement>("button.z-select__control");
    control?.setAttribute("aria-expanded", "false");
    if (control) control.dataset.state = "closed";
    // El calendario vuelve a su popover: la próxima apertura en una ventana ancha lo encuentra allí.
    const cal = dialog!.querySelector<HTMLElement>(".z-calendar");
    if (cal) panel.prepend(cal);
  });
  return dialog;
}

function pickerParts(picker: HTMLElement) {
  const control = picker.querySelector<HTMLButtonElement>("button.z-select__control");
  const panel = popupFor(control);
  return {
    control,
    panel,
    cal: panel?.querySelector<HTMLElement>(".z-calendar") ?? drawerOf.get(picker)?.querySelector<HTMLElement>(".z-calendar") ?? null,
    hidden: picker.querySelector<HTMLInputElement>('input[type="hidden"]:not([data-z-extra])'),
  };
}

const pickerMode = (picker: HTMLElement): CalendarMode => {
  const mode = picker.dataset.mode ?? pickerParts(picker).cal?.dataset.mode;
  return mode === "range" || mode === "multiple" ? mode : "single";
};

/** Texto del campo para un valor: fecha, mes o año según `data-min-view`; rango con guion; varias, contadas. */
function pickerText(picker: HTMLElement, selection: CalendarSelection, mode: CalendarMode): string {
  const style = (picker.dataset.dateStyle ?? "medium") as Intl.DateTimeFormatOptions["dateStyle"];
  const template = picker.dataset.countLabel ?? "{count} dates";
  return selectionText(mode, selection, {
    locale: picker.dataset.locale,
    format: { dateStyle: style },
    unit: clampView(picker.dataset.minView),
    count: (n) => template.replace("{count}", String(n)),
  });
}

/** WeekPicker: el valor del campo es una semana ISO `YYYY-Www`; el calendario trabaja con su lunes. */
const weekly = (picker: HTMLElement) => picker.dataset.selectionUnit === "week" && pickerMode(picker) === "single";
/** WeekPicker de rango: el valor es `YYYY-Www/YYYY-Www`; el calendario trabaja con el lunes y el domingo. */
const weeklyRange = (picker: HTMLElement) => picker.dataset.selectionUnit === "week" && pickerMode(picker) === "range";
const weeksToDays = (text: string | undefined) => {
  const [from, to] = (text ?? "").split("/");
  return weekRangeDays({ from, to });
};
const daysToWeeks = (range: DateRange) => {
  const weeks = weekRangeOf(range);
  return weeks.from ? `${weeks.from}/${weeks.to ?? ""}` : "";
};
/** Texto del campo de un rango de semanas: «Week 47–49, 2026». */
function weekRangeLabel(picker: HTMLElement, range: DateRange): string {
  if (!range.from) return "";
  const number = new Intl.NumberFormat(safeLocale(picker.dataset.locale), { useGrouping: false });
  const label = picker.dataset.weekLabel ?? "Week";
  const a = weekNumber(range.from, 1, 4);
  if (!range.to) return `${label} ${number.format(a.week)}, ${number.format(a.year)}`;
  const b = weekNumber(range.to, 1, 4);
  return a.year === b.year
    ? `${label} ${number.format(a.week)}–${number.format(b.week)}, ${number.format(a.year)}`
    : `${label} ${number.format(a.week)}, ${number.format(a.year)} – ${number.format(b.week)}, ${number.format(b.year)}`;
}

function syncPicker(picker: HTMLElement): void {
  const { control, hidden } = pickerParts(picker);
  if (!control) return;
  const mode = pickerMode(picker);
  const unit = clampView(picker.dataset.minView);
  const raw = picker.dataset.value ?? hidden?.value ?? "";
  const week = weekly(picker) ? weekStartOf(raw) : null;
  const selection = weekly(picker)
    ? readSelection("single", week, "day")
    : weeklyRange(picker)
      ? readSelection("range", weeksToDays(raw), "day")
      : parseValueText(mode, raw, unit);
  let text = pickerText(picker, selection, mode);
  let value = valueText(mode, selection);
  if (weeklyRange(picker)) {
    text = weekRangeLabel(picker, selection.range);
    value = daysToWeeks(selection.range);
  }
  if (weekly(picker)) {
    const n = week ? weekNumber(week, 1, 4) : null;
    const number = new Intl.NumberFormat(safeLocale(picker.dataset.locale), { useGrouping: false });
    text = n ? `${picker.dataset.weekLabel ?? "Week"} ${number.format(n.week)}, ${number.format(n.year)}` : "";
    value = week ? isoWeekText(week) : "";
  }
  const label = control.querySelector<HTMLElement>(".z-select__value");
  if (label) label.textContent = text || (picker.dataset.placeholder ?? (mode === "single" ? "Select date" : "Select dates"));
  flag(control, "data-placeholder", !text);
  if (value) picker.dataset.value = value;
  else delete picker.dataset.value;
  // Varias fechas: un campo por fecha con el mismo nombre, como un <select multiple>.
  for (const extra of picker.querySelectorAll('input[type="hidden"][data-z-extra]')) extra.remove();
  if (hidden) {
    if (mode === "multiple") {
      hidden.value = selection.multiple[0] ?? "";
      for (const date of selection.multiple.slice(1)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = hidden.name;
        input.value = date;
        input.dataset.zExtra = "";
        picker.append(input);
      }
    } else hidden.value = value;
  }
  if (!control.dataset.state) control.dataset.state = "closed";
}

function openPicker(picker: HTMLElement): void {
  const { control, panel, cal } = pickerParts(picker);
  if (!control || !panel || !cal || control.disabled || isOpen(panel)) return;
  // El calendario hereda la configuración del campo y abre en el mes del valor, en la vista de elección.
  for (const key of FORWARDED) {
    if (picker.dataset[key] !== undefined) cal.dataset[key] = picker.dataset[key];
    else delete cal.dataset[key];
  }
  const start = weekly(picker)
    ? weekStartOf(picker.dataset.value)
    : weeklyRange(picker)
      ? valueText("range", readSelection("range", weeksToDays(picker.dataset.value), "day"))
      : picker.dataset.value;
  if (start) cal.dataset.value = start;
  else delete cal.dataset.value;
  delete cal.dataset.month;
  delete cal.dataset.view;
  states.delete(cal);
  if (wantsDrawer(picker)) {
    const dialog = ensureDrawer(picker, panel);
    if (dialog.open) return;
    dialog.querySelector(".z-drawer__body")!.append(cal);
    render(cal);
    openDialog(dialog);
    control.setAttribute("aria-expanded", "true");
    control.dataset.state = "open";
    cal.querySelector<HTMLElement>('.z-calendar__grid [tabindex="0"]')?.focus({ preventScroll: true });
    return;
  }
  if (!panel.contains(cal)) panel.prepend(cal);
  render(cal);
  showPopup(panel, picker, control, () => (control.dataset.state = "closed"));
  control.dataset.state = "open";
  // El foco inicial lo toma el día activo, no el primer botón.
  cal.querySelector<HTMLElement>('.z-calendar__grid [tabindex="0"]')?.focus({ preventScroll: true });
}

function closePicker(picker: HTMLElement): void {
  const dialog = drawerOf.get(picker);
  if (dialog?.open) {
    closeDialog(dialog);
    return;
  }
  const { control, panel } = pickerParts(picker);
  if (!panel || !isOpen(panel)) return;
  const inside = panel.contains(document.activeElement);
  hidePopup(panel);
  if (inside) control?.focus({ preventScroll: true });
}

function applyToPicker(picker: HTMLElement, selection: CalendarSelection, mode: CalendarMode): void {
  const week = weekly(picker) && selection.single ? isoWeekText(selection.single) : null;
  const weeks = weeklyRange(picker) ? weekRangeOf(selection.range) : null;
  picker.dataset.value = weekly(picker) ? (week ?? "") : weeks ? daysToWeeks(selection.range) : valueText(mode, selection);
  if (!picker.dataset.value) delete picker.dataset.value;
  syncPicker(picker);
  emit(picker, "change", { value: weekly(picker) ? week : (weeks ?? selectionValue(mode, selection)) });
}

function pickFromCalendar(picker: HTMLElement, selection: CalendarSelection, c: Config): void {
  // Con confirmación, el calendario guarda el borrador hasta «Aplicar».
  if (yes(picker.dataset.confirm)) return;
  applyToPicker(picker, selection, c.mode);
  const done = c.mode === "single" || (c.mode === "range" && selection.range.from && selection.range.to);
  const close = picker.dataset.closeOnSelect === undefined ? c.mode !== "multiple" && done : yes(picker.dataset.closeOnSelect) && done;
  if (close) closePicker(picker);
}

/** Fija el valor de un DatePicker: fecha ISO, `{ from, to }`, lista o `null`. Emite z:change. */
export function setDatePickerValue(picker: HTMLElement, value: CalendarValue | DateRange): void {
  if (weekly(picker)) {
    const start = typeof value === "string" ? (weekStartOf(value) ?? (valid(value) ? value : null)) : null;
    const week = start ? isoWeekText(start) : null;
    if (week) picker.dataset.value = week;
    else delete picker.dataset.value;
    syncPicker(picker);
    emit(picker, "change", { value: week });
    return;
  }
  const mode = pickerMode(picker);
  if (weeklyRange(picker)) {
    // Rango de semanas: `{ from: "YYYY-Www", to }` o `YYYY-Www/YYYY-Www`.
    const raw = typeof value === "string" ? value : value && !Array.isArray(value) ? `${value.from ?? ""}/${value.to ?? ""}` : "";
    const range = readSelection("range", weeksToDays(raw), "day").range;
    const text = daysToWeeks(range);
    if (text) picker.dataset.value = text;
    else delete picker.dataset.value;
    syncPicker(picker);
    emit(picker, "change", { value: weekRangeOf(range) });
    return;
  }
  const selection = readSelection(mode, value, clampView(picker.dataset.minView));
  const text = valueText(mode, selection);
  if (text) picker.dataset.value = text;
  else delete picker.dataset.value;
  const hidden = pickerParts(picker).hidden;
  if (hidden) hidden.value = text;
  syncPicker(picker);
  emit(picker, "change", { value: selectionValue(mode, selection) });
}

/* ---------- Delegación ---------- */

/** Calendario activo: dentro de `[data-z-dom]` o en el panel abierto de un DatePicker. */
function calendarAt(target: Element): HTMLElement | null {
  const cal = target.closest<HTMLElement>(".z-calendar");
  // `data-widget`: la rejilla la pinta y la mueve otra pieza (la de QuarterPicker), con el aspecto del calendario.
  return cal &&
    !cal.hasAttribute("data-widget") &&
    (inDom(cal) ||
      isOpen(cal.closest<HTMLElement>("[popover]")) ||
      Boolean(cal.closest<HTMLDialogElement>("dialog.z-datepicker__drawer")?.open))
    ? cal
    : null;
}

function onClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const cal = calendarAt(target);
  if (cal) {
    const c = config(cal);
    const nav = target.closest<HTMLButtonElement>(".z-calendar__nav");
    const day = target.closest<HTMLElement>(".z-calendar__day");
    const unit = target.closest<HTMLElement>(".z-calendar__unit");
    const preset = target.closest<HTMLElement>(".z-calendar__preset");
    const weekButton = target.closest<HTMLElement>(".z-calendar__week-button");
    if (weekButton?.dataset.week) {
      const start = weekButton.dataset.week;
      emit(cal, "week", { week: Number(weekButton.dataset.weekValue), from: start, to: addDays(start, 6) });
      const next = chooseWeek(c.mode, c.selection, start, c.rules);
      if (next === undefined) return;
      const first = anchorOf(readSelection(c.mode, next, c.minView));
      if (first) stateOf(cal).focused = first;
      commit(cal, next, c);
      cal.querySelector<HTMLElement>(`.z-calendar__week-button[data-week="${start}"]`)?.focus();
    } else if (nav && !nav.disabled) {
      const view = viewOf(cal, c);
      stateOf(cal).focused = null;
      showMonth(cal, shiftMonth(visibleMonth(cal, c), (nav.dataset.nav === "previous" ? -1 : 1) * navStep(view, c.n, c.paged)));
      render(cal);
    } else if (target.closest(".z-calendar__view")) {
      setView(cal, VIEWS[VIEWS.indexOf(viewOf(cal, c)) + 1] ?? "year");
      stateOf(cal).focused = null;
      render(cal);
      cal.querySelector<HTMLElement>('.z-calendar__grid [tabindex="0"]')?.focus();
    } else if (day?.dataset.date && day.getAttribute("aria-disabled") !== "true") pick(cal, day.dataset.date);
    else if (unit?.dataset.value && unit.getAttribute("aria-disabled") !== "true") onUnit(cal, unit.dataset.value);
    else if (preset) {
      const p = c.presets[Number(preset.dataset.preset)];
      if (!p) return;
      const value = presetValue(p.value, c.mode, c.today, c.weekStart);
      const first = anchorOf(readSelection(c.mode, value, c.minView));
      if (first) {
        stateOf(cal).focused = first;
        showMonth(cal, revealMonth(visibleMonth(cal, c), c.n, first, c.paged));
      }
      commit(cal, value, c);
    } else if (target.closest(".z-calendar__today")) goToday(cal);
    else if (target.closest<HTMLElement>(".z-calendar__flex-chip")) {
      const days = Number(target.closest<HTMLElement>(".z-calendar__flex-chip")!.dataset.flexibilityOption);
      if (days === c.flexibility) return;
      cal.dataset.flexibility = String(days);
      render(cal);
      cal.querySelector<HTMLElement>(`.z-calendar__flex-chip[data-flexibility-option="${days}"]`)?.focus();
      emit(cal, "flexibilitychange", { flexibility: days });
    } else if (target.closest<HTMLElement>(".z-calendar__stepper-btn")) {
      const next = stepRange(c.selection.range, Number(target.closest<HTMLElement>(".z-calendar__stepper-btn")!.dataset.step), c.rules);
      if (next) commit(cal, next, c);
    } else if (target.closest(".z-calendar__apply, .z-calendar__cancel")) {
      const picker = pickerOf(cal);
      if (!picker?.matches(PICKER)) return;
      if (target.closest(".z-calendar__apply")) applyToPicker(picker, c.selection, c.mode);
      closePicker(picker);
    }
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
  const cell = target.closest<HTMLElement>(".z-calendar__day, .z-calendar__unit");
  const cal = calendarAt(target);
  if (!cal || (cal.dataset.mode !== "range" && cal.dataset.selectionUnit !== "week")) return;
  const state = stateOf(cal);
  const next = leaving ? null : (cell?.dataset.date ?? cell?.dataset.value ?? state.preview);
  if (next === state.preview) return;
  state.preview = next;
  render(cal);
}

export function setup(on: Listen): void {
  on(document, "click", onClick);
  on(document, "change", (event) => {
    const select = (event.target as Element).closest?.<HTMLSelectElement>(".z-calendar__select");
    const cal = select && calendarAt(select);
    if (!cal) return;
    const month = visibleMonth(cal);
    showMonth(cal, select.dataset.part === "year" ? `${select.value}-${month.slice(5, 7)}` : select.value);
    stateOf(cal).focused = null;
    render(cal);
  });
  // En captura: Escape en las vistas de mes y año vuelve a los días antes de que la capa cierre el DatePicker.
  on(
    document,
    "keydown",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || event.defaultPrevented) return;
      const cell = target.closest<HTMLElement>(".z-calendar__grid .z-calendar__day, .z-calendar__grid .z-calendar__unit");
      const cal = cell && calendarAt(cell);
      if (cal) onCalendarKey(cal, cell, event);
    },
    true,
  );
  on(document, "focusin", (event) => {
    const cell = (event.target as Element).closest?.<HTMLElement>(".z-calendar__day, .z-calendar__unit");
    const cal = cell && calendarAt(cell);
    if (!cal) return;
    const value = cell.dataset.date ?? cell.dataset.value;
    if (!value) return;
    const state = stateOf(cal);
    const previewing = cal.dataset.mode === "range" || cal.dataset.selectionUnit === "week";
    if (state.focused === value && (!previewing || state.preview === value)) return;
    state.focused = value;
    if (previewing) state.preview = value;
    render(cal);
  });
  on(document, "pointerover", (event) => previewAt(event.target));
  on(document, "pointerout", (event) => {
    const grid = (event.target as Element).closest?.(".z-calendar__months");
    if (grid && !grid.contains(event.relatedTarget as Node | null)) previewAt(event.target, true);
  });
}

export function hydrate(root: ParentNode): void {
  for (const picker of all(root, PICKER)) syncPicker(picker);
  for (const cal of root.querySelectorAll<HTMLElement>(".z-calendar")) if (calendarAt(cal)) render(cal);
  if (root instanceof HTMLElement && root.matches(".z-calendar") && calendarAt(root)) render(root);
}

/** Calendario de un panel propio (DateTimePicker): estado nuevo, mes del valor y pintado. */
export function resetCalendar(cal: HTMLElement): void {
  delete cal.dataset.month;
  delete cal.dataset.view;
  states.delete(cal);
  render(cal);
}
