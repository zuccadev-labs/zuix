// TimeRangePicker y DateTimeRangePicker sin framework. Los campos de hora son los TimePicker y TimeField de
// ./forms-datefield y el calendario el de ./forms-calendar; aquí solo se juntan, con la lógica de ../core/time-range y
// ../core/datetime-range (la misma que el binding de React).
//
// TimeRangePicker     .z-timerange[role=group] con dos .z-timefield.z-timepicker (inicio y fin, cada uno con su panel),
//                     .z-timerange__meta y un input.z-native-input con el `name` (`inicio/fin`). En .z-timerange:
//                     data-allow-overnight, data-min-duration, data-max-duration (minutos), data-show-duration="false",
//                     data-overnight-label, data-overnight-description y data-msg-order|incomplete|short|long.
//                     z:change { value: { start, end }, info } con `event.target` en el grupo. setTimeRangeValue().
// DateTimeRangePicker .z-select.z-dtrange[data-picker] > button.z-select__control[aria-controls] + .z-dtrange__panel[popover]
//                     vacío (se rellena al abrir). En .z-dtrange: data-value (`inicio/fin`, con zona si la hay),
//                     data-time-zone (selector de zona), data-time-zones="Europe/Madrid,UTC", data-presets (JSON
//                     [{ label, value }]), data-min, data-max, data-locale, data-week-start, data-today, data-months,
//                     data-hour-cycle, data-minute-step, data-default-start-time, data-default-end-time, data-*-label.
//                     z:change { value: { start, end, timeZone } }. setDateTimeRangeValue().
import { formatDuration } from "../core/duration";
import {
  DATE_TIME_RANGE_LABELS,
  DATE_TIME_RANGE_MESSAGES,
  dateTimeRangeError,
  dateTimeRangeText,
  formatDateTimeRange,
  joinDateTime,
  nowIn,
  parseDateTimeRange,
  resolveDateTimePreset,
  splitDateTime,
  type DateTimePreset,
  type DateTimeRange,
} from "../core/datetime-range";
import { todayISO } from "../core/date";
import { trapTab } from "../core/focus";
import {
  TIME_RANGE_LABELS,
  TIME_RANGE_MESSAGES,
  timeRangeInfo,
  timeRangeText,
  type TimeRange,
  type TimeRangeMessages,
} from "../core/time-range";
import { groupZones, zoneOptions } from "../core/timezones";
import { deviceTimeZone, zoneCity } from "../core/zone";
import { resetCalendar } from "./forms-calendar";
import { hydrate as hydrateFields, setTimePickerValue } from "./forms-datefield";
import { all, emit, hidePopup, isOpen, popupFor, showPopup } from "./forms-popup";
import { setMarkup, type DomPart, type Listen } from "./shared";

/* ---------- TimeRangePicker ---------- */

const RANGE = ".z-timerange";
const fieldsOf = (group: HTMLElement) => [...group.querySelectorAll<HTMLElement>(":scope > .z-timefield")];
const timeOf = (field: HTMLElement | undefined) =>
  field?.querySelector<HTMLInputElement>(":scope > input.z-native-input")?.value || field?.dataset.value || null;
const groupNative = (group: HTMLElement) => group.querySelector<HTMLInputElement>(":scope > input.z-native-input");

function rangeRules(group: HTMLElement) {
  const n = (v: string | undefined) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
  return {
    allowOvernight: group.dataset.allowOvernight !== undefined,
    minDuration: n(group.dataset.minDuration),
    maxDuration: n(group.dataset.maxDuration),
  };
}

function syncRange(group: HTMLElement, announce: boolean): void {
  const [a, b] = fieldsOf(group);
  const range: TimeRange = { start: timeOf(a), end: timeOf(b) };
  const info = timeRangeInfo(range, rangeRules(group));
  const messages: TimeRangeMessages = {
    ...TIME_RANGE_MESSAGES,
    ...Object.fromEntries(
      (Object.keys(TIME_RANGE_MESSAGES) as (keyof TimeRangeMessages)[])
        .filter((k) => group.dataset[`msg${k[0]!.toUpperCase()}${k.slice(1)}`])
        .map((k) => [k, group.dataset[`msg${k[0]!.toUpperCase()}${k.slice(1)}`]!]),
    ),
  };
  if (info.overnight) group.dataset.overnight = "";
  else delete group.dataset.overnight;
  if (info.error) group.dataset.invalid = "";
  else delete group.dataset.invalid;
  for (const field of [a, b]) {
    if (!field) continue;
    if (info.error) field.dataset.invalid = "";
    else delete field.dataset.invalid;
  }
  const native = groupNative(group);
  if (native) {
    native.value = timeRangeText(range);
    native.setCustomValidity(info.error ? messages[info.error] : "");
  }
  const meta = group.querySelector<HTMLElement>(":scope > .z-timerange__meta");
  if (meta) {
    meta.replaceChildren();
    if (info.overnight) {
      const badge = document.createElement("span");
      badge.className = "z-badge z-timerange__overnight";
      badge.dataset.tone = "info";
      badge.dataset.variant = "soft";
      badge.dataset.size = "md";
      const description = group.dataset.overnightDescription ?? TIME_RANGE_LABELS.overnightDescription;
      badge.title = description;
      setMarkup(badge, '<z-icon name="moon" size="12"></z-icon><span aria-hidden="true"></span><span class="z-sr-only"></span>');
      badge.children[1]!.textContent = group.dataset.overnightLabel ?? TIME_RANGE_LABELS.overnight;
      badge.children[2]!.textContent = description;
      meta.append(badge);
    }
    if (info.duration !== null && group.dataset.showDuration !== "false") {
      const duration = document.createElement("span");
      duration.className = "z-timerange__duration";
      duration.textContent = formatDuration(info.duration * 60_000, {
        style: "short",
        smallestUnit: "minutes",
        locale: a?.dataset.locale,
      });
      meta.append(duration);
    }
  }
  if (announce) emit(group, "change", { value: range, info });
}

/** Fija el rango (`{ start, end }` en `HH:mm`). Emite z:change. */
export function setTimeRangeValue(group: HTMLElement, value: TimeRange | null): void {
  const [a, b] = fieldsOf(group);
  if (a) setTimePickerValue(a, value?.start ?? null);
  if (b) setTimePickerValue(b, value?.end ?? null);
  syncRange(group, true);
}

/* ---------- DateTimeRangePicker ---------- */

const DTR = ".z-dtrange";
interface Draft {
  from: string | null;
  to: string | null;
  startTime: string | null;
  endTime: string | null;
  zone: string | null;
}
const drafts = new WeakMap<HTMLElement, Draft>();
/** Etiqueta del marcado (`data-apply-label`…) o la de por defecto, en inglés. */
const label = (picker: HTMLElement, key: keyof typeof DATE_TIME_RANGE_LABELS) =>
  picker.dataset[`${key}Label`] ?? DATE_TIME_RANGE_LABELS[key];
const pickerValue = (picker: HTMLElement): DateTimeRange =>
  parseDateTimeRange(picker.querySelector<HTMLInputElement>(":scope > input.z-native-input")?.value || picker.dataset.value);
const triggerOf = (picker: HTMLElement) => picker.querySelector<HTMLButtonElement>(":scope > button.z-select__control");
const panelOf = (picker: HTMLElement) => popupFor(triggerOf(picker));

function candidateOf(picker: HTMLElement, draft: Draft): DateTimeRange {
  return {
    start: joinDateTime(draft.from, draft.startTime, picker.dataset.defaultStartTime ?? "00:00"),
    end: joinDateTime(draft.to ?? draft.from, draft.endTime, picker.dataset.defaultEndTime ?? "23:59"),
    timeZone: picker.dataset.timeZone !== undefined ? draft.zone : null,
  };
}

function presetsOf(picker: HTMLElement): DateTimePreset[] {
  try {
    const list = JSON.parse(picker.dataset.presets ?? "[]") as unknown;
    return Array.isArray(list) ? (list as DateTimePreset[]).filter((p) => p && typeof p.label === "string") : [];
  } catch {
    return [];
  }
}

const MESSAGES = DATE_TIME_RANGE_MESSAGES;

/** Escribe el valor en el campo: texto del botón, campo nativo y validez. */
function showValue(picker: HTMLElement, value: DateTimeRange): void {
  const native = picker.querySelector<HTMLInputElement>(":scope > input.z-native-input");
  const text = formatDateTimeRange(
    value,
    picker.dataset.locale,
    picker.dataset.hourCycle ? picker.dataset.hourCycle === "12" : undefined,
    Number((picker.dataset.today ?? todayISO()).slice(0, 4)),
  );
  const shown = text && value.timeZone ? `${text} (${zoneCity(value.timeZone)})` : text;
  const valueEl = picker.querySelector<HTMLElement>(".z-select__value");
  if (valueEl) valueEl.textContent = shown || label(picker, "placeholder");
  const trigger = triggerOf(picker);
  if (trigger) {
    if (shown) trigger.removeAttribute("data-placeholder");
    else trigger.setAttribute("data-placeholder", "");
  }
  const error = dateTimeRangeError(value);
  if (native) {
    native.value = dateTimeRangeText(value);
    native.setCustomValidity(
      error && error !== "incomplete" ? (picker.dataset[`msg${error[0]!.toUpperCase()}${error.slice(1)}`] ?? MESSAGES[error]) : "",
    );
  }
}

function buildPanel(picker: HTMLElement, panel: HTMLElement, draft: Draft): void {
  const presets = presetsOf(picker);
  const zone = picker.dataset.timeZone !== undefined;
  setMarkup(
    panel,
    `<div class="z-dtrange__body"${presets.length ? " data-presets" : ""}>${
      presets.length
        ? `<div class="z-calendar__presets z-dtrange__presets" role="group"><p class="z-calendar__presets-label"></p>${presets
            .map((_, i) => `<button type="button" class="z-calendar__preset" data-preset="${i}"></button>`)
            .join("")}</div>`
        : ""
    }<div class="z-calendar" data-mode="range"></div></div><div class="z-calendar__footer z-dtrange__footer"><span class="z-dtrange__time"><span class="z-datetimepicker__time-label" data-part="start"></span><div class="z-input z-datefield z-timefield" role="group" data-size="sm" data-granularity="minute" data-part="start"></div></span><span class="z-dtrange__time"><span class="z-datetimepicker__time-label" data-part="end"></span><div class="z-input z-datefield z-timefield" role="group" data-size="sm" data-granularity="minute" data-part="end"></div></span>${
      zone
        ? '<span class="z-dtrange__time z-dtrange__zone"><span class="z-datetimepicker__time-label" data-part="zone"></span><span class="z-select" data-size="sm"><select class="z-select__control" data-part="zone"></select></span></span>'
        : ""
    }<span class="z-dtrange__error" role="status"></span><span class="z-calendar__actions"><button type="button" class="z-btn z-btn--ghost z-calendar__cancel" data-size="sm"></button><button type="button" class="z-btn z-btn--primary z-calendar__apply" data-size="sm"></button></span></div>`,
  );
  const id = panel.id || `${picker.id || "dtrange"}-panel`;
  const presetsGroup = panel.querySelector<HTMLElement>(".z-dtrange__presets");
  if (presetsGroup) {
    const title = presetsGroup.querySelector<HTMLElement>(".z-calendar__presets-label")!;
    title.id = `${id}-presets`;
    title.textContent = label(picker, "presets");
    presetsGroup.setAttribute("aria-labelledby", title.id);
    presetsGroup.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button, i) => {
      button.textContent = presets[i]!.label;
    });
  }
  for (const part of ["start", "end", "zone"] as const) {
    const text = panel.querySelector<HTMLElement>(`.z-datetimepicker__time-label[data-part="${part}"]`);
    if (!text) continue;
    text.id = `${id}-${part}`;
    text.textContent = label(picker, part === "zone" ? "timeZone" : part);
    const control = panel.querySelector<HTMLElement>(`[data-part="${part}"]:not(.z-datetimepicker__time-label)`);
    control?.setAttribute("aria-labelledby", text.id);
    if (control && part !== "zone") {
      for (const key of ["locale", "hourCycle", "minuteStep"]) if (picker.dataset[key]) control.dataset[key] = picker.dataset[key];
      const time = part === "start" ? draft.startTime : draft.endTime;
      if (time) control.dataset.value = time;
    }
  }
  const select = panel.querySelector<HTMLSelectElement>('select[data-part="zone"]');
  if (select) {
    const zones = (picker.dataset.timeZones ?? "").split(",").filter(Boolean);
    for (const group of groupZones(zoneOptions({ zones, showTime: false, locale: picker.dataset.locale }), "region")) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      for (const o of group.options) optgroup.append(new Option(o.label, o.value, false, o.value === draft.zone));
      select.append(optgroup);
    }
    select.value = draft.zone ?? "";
  }
  panel.querySelector(".z-calendar__cancel")!.textContent = label(picker, "cancel");
  panel.querySelector(".z-calendar__apply")!.textContent = label(picker, "apply");
  const cal = panel.querySelector<HTMLElement>(".z-calendar")!;
  for (const key of ["locale", "weekStart", "today", "min", "max"]) if (picker.dataset[key]) cal.dataset[key] = picker.dataset[key];
  cal.dataset.months = picker.dataset.months ?? "2";
  calendarDraft(cal, draft);
  hydrateFields(panel);
}

function calendarDraft(cal: HTMLElement, draft: Draft): void {
  if (draft.from) cal.dataset.value = `${draft.from}/${draft.to ?? ""}`;
  else delete cal.dataset.value;
}

function refreshDraft(picker: HTMLElement, panel: HTMLElement): void {
  const draft = drafts.get(picker);
  if (!draft) return;
  const error = draft.from ? dateTimeRangeError(candidateOf(picker, draft)) : "incomplete";
  const status = panel.querySelector<HTMLElement>(".z-dtrange__error");
  if (status)
    status.textContent =
      draft.from && error && error !== "incomplete"
        ? (picker.dataset[`msg${error[0]!.toUpperCase()}${error.slice(1)}`] ?? MESSAGES[error])
        : "";
  const apply = panel.querySelector<HTMLElement>(".z-calendar__apply");
  if (apply) {
    if (error) apply.setAttribute("aria-disabled", "true");
    else apply.removeAttribute("aria-disabled");
  }
}

function openRange(picker: HTMLElement): void {
  const trigger = triggerOf(picker);
  const panel = panelOf(picker);
  if (!trigger || !panel || trigger.disabled || isOpen(panel)) return;
  const value = pickerValue(picker);
  const a = splitDateTime(value.start);
  const b = splitDateTime(value.end);
  const zoneDefault = picker.dataset.defaultTimeZone ?? (picker.dataset.timeZone !== undefined ? deviceTimeZone() : null);
  const draft: Draft = { from: a.date, to: b.date, startTime: a.time, endTime: b.time, zone: value.timeZone ?? zoneDefault };
  drafts.set(picker, draft);
  buildPanel(picker, panel, draft);
  showPopup(panel, picker, trigger, () => {});
  const cal = panel.querySelector<HTMLElement>(".z-calendar")!;
  resetCalendar(cal);
  refreshDraft(picker, panel);
  cal.querySelector<HTMLElement>('.z-calendar__grid [tabindex="0"]')?.focus({ preventScroll: true });
}

function closeRange(picker: HTMLElement, refocus: boolean): void {
  const panel = panelOf(picker);
  if (!panel || !isOpen(panel)) return;
  const inside = panel.contains(document.activeElement);
  hidePopup(panel);
  if (refocus || inside) triggerOf(picker)?.focus({ preventScroll: true });
}

function applyRange(picker: HTMLElement): void {
  const draft = drafts.get(picker);
  if (!draft?.from) return;
  const value = candidateOf(picker, draft);
  if (dateTimeRangeError(value)) return;
  showValue(picker, value);
  closeRange(picker, true);
  emit(picker, "change", { value });
}

/** Fija el valor (`{ start, end, timeZone? }`). Emite z:change. */
export function setDateTimeRangeValue(picker: HTMLElement, value: DateTimeRange | null): void {
  const next = value ?? { start: null, end: null };
  showValue(picker, next);
  emit(picker, "change", { value: next });
}

const pickerOfPanel = (el: Element) => {
  const panel = el.closest<HTMLElement>(".z-dtrange__panel");
  if (!panel?.id) return null;
  return document.querySelector<HTMLElement>(`${DTR} > button[aria-controls="${CSS.escape(panel.id)}"]`)?.parentElement ?? null;
};

function setup(on: Listen): void {
  on(document, "z:change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    // Un campo de hora del rango.
    const group = target.matches(".z-timefield") ? target.parentElement?.closest<HTMLElement>(RANGE) : null;
    if (group && target.parentElement === group) {
      syncRange(group, true);
      return;
    }
    const picker = pickerOfPanel(target);
    const draft = picker ? drafts.get(picker) : undefined;
    if (!picker || !draft) return;
    const value = (event as CustomEvent<{ value: unknown }>).detail?.value;
    if (target.matches(".z-calendar")) {
      const range = value as { from?: string | null; to?: string | null } | null;
      draft.from = range?.from ?? null;
      draft.to = range?.to ?? null;
    } else if (target.matches('.z-timefield[data-part="start"]')) draft.startTime = typeof value === "string" ? value : null;
    else if (target.matches('.z-timefield[data-part="end"]')) draft.endTime = typeof value === "string" ? value : null;
    // Los cambios del panel son un borrador: el valor solo cambia (y se anuncia en el campo) con «Apply».
    refreshDraft(picker, target.closest<HTMLElement>(".z-dtrange__panel")!);
  });
  on(document, "change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.matches('select[data-part="zone"]')) return;
    const picker = pickerOfPanel(select);
    const draft = picker ? drafts.get(picker) : undefined;
    if (!picker || !draft) return;
    draft.zone = select.value || null;
    refreshDraft(picker, select.closest<HTMLElement>(".z-dtrange__panel")!);
  });
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest<HTMLElement>(`${DTR} > button.z-select__control`);
    if (trigger) {
      const picker = trigger.parentElement!;
      if (isOpen(panelOf(picker))) closeRange(picker, true);
      else openRange(picker);
      return;
    }
    const picker = pickerOfPanel(target);
    if (!picker) return;
    if (target.closest(".z-calendar__cancel")) closeRange(picker, true);
    else if (target.closest(".z-calendar__apply")) applyRange(picker);
    else {
      const preset = target.closest<HTMLElement>("[data-preset]");
      const draft = drafts.get(picker);
      if (!preset || !draft) return;
      const chosen = presetsOf(picker)[Number(preset.dataset.preset)];
      const range = chosen ? resolveDateTimePreset(chosen.value, nowIn(draft.zone), Number(picker.dataset.weekStart ?? 1)) : null;
      if (!range) return;
      const a = splitDateTime(range.start);
      const b = splitDateTime(range.end);
      Object.assign(draft, { from: a.date, to: b.date, startTime: a.time, endTime: b.time });
      const panel = panelOf(picker)!;
      const cal = panel.querySelector<HTMLElement>(".z-calendar")!;
      calendarDraft(cal, draft);
      delete cal.dataset.month;
      resetCalendar(cal);
      for (const part of ["start", "end"] as const) {
        const field = panel.querySelector<HTMLElement>(`.z-timefield[data-part="${part}"]`);
        if (field) setTimePickerValue(field, part === "start" ? draft.startTime : draft.endTime);
      }
      refreshDraft(picker, panel);
    }
  });
  // El navegador enfoca el campo nativo oculto al informar de un error: el foco pasa al control visible.
  on(document, "focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches(".z-native-input")) return;
    const owner = target.parentElement;
    if (owner?.matches(RANGE)) owner.querySelector<HTMLElement>('[role="spinbutton"]')?.focus();
    else if (owner?.matches(DTR)) triggerOf(owner)?.focus();
  });
  on(document, "keydown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const panel = target.closest<HTMLElement>(".z-dtrange__panel");
    if (panel && isOpen(panel) && trapTab(panel, event)) event.preventDefault();
  });
}

function hydrate(root: ParentNode): void {
  for (const group of all(root, RANGE)) syncRange(group, false);
  for (const picker of all(root, DTR)) showValue(picker, pickerValue(picker));
}

export const rangesPart: DomPart = { rank: 26, setup, hydrate };
