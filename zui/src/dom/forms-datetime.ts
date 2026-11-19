// DateTimePicker (y DatePicker con campo tecleable) sin framework: un `.z-datefield.z-datetimepicker` con su botón
// `.z-datetimepicker__trigger[aria-controls]` y un panel `[popover]` con un `.z-calendar` y, con hora, un pie con
// un TimeField y «Apply». El campo es el DateField de forms-datefield; aquí solo se abre, se cierra y se junta.
import { clampDateTime, dayTimeBounds } from "../core/time";
import { resetCalendar } from "./forms-calendar";
import { hydrate as hydrateFields, setDateFieldValue } from "./forms-datefield";
import { hidePopup, inDom, isOpen, ownerOf, popupFor, showPopup } from "./forms-popup";
import { setMarkup, type Listen } from "./shared";

const PICKER = ".z-datetimepicker";
const drafts = new WeakMap<HTMLElement, { date: string | null; time: string | null }>();
/** Atributos del campo que pasan al calendario del panel. */
const FORWARDED = ["locale", "weekStart", "today", "months", "unavailableDates", "disabledDates", "disabledWeekdays", "unavailableLabel"];

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function parts(field: HTMLElement) {
  const trigger = field.querySelector<HTMLButtonElement>("button.z-datetimepicker__trigger");
  const panel = popupFor(trigger);
  return { trigger, panel, cal: panel?.querySelector<HTMLElement>(".z-calendar") ?? null };
}
const fieldValue = (field: HTMLElement) =>
  field.querySelector<HTMLInputElement>("input.z-native-input")?.value || field.dataset.value || "";
const withTime = (field: HTMLElement) => (field.dataset.granularity ?? "minute") !== "day";

/** El pie con la hora y «Apply», si el panel aún no lo tiene. */
function ensureFooter(field: HTMLElement, panel: HTMLElement, time: string | null): void {
  let footer = panel.querySelector<HTMLElement>(".z-datetimepicker__footer");
  if (!footer) {
    footer = document.createElement("div");
    footer.className = "z-calendar__footer z-datetimepicker__footer";
    const label = field.dataset.timeLabel ?? "Time";
    const seconds = field.dataset.granularity === "second";
    setMarkup(
      footer,
      `<span class="z-datetimepicker__time"><span class="z-datetimepicker__time-label"></span><div class="z-input z-datefield z-timefield" data-size="sm" data-granularity="${seconds ? "second" : "minute"}" aria-label="${esc(label)}"></div></span><button type="button" class="z-btn z-btn--primary z-calendar__apply" data-size="sm"></button>`,
    );
    footer.querySelector(".z-datetimepicker__time-label")!.textContent = label;
    footer.querySelector(".z-calendar__apply")!.textContent = field.dataset.applyLabel ?? "Apply";
    for (const key of ["locale", "hourCycle", "minuteStep", "secondStep"])
      if (field.dataset[key] !== undefined) footer.querySelector<HTMLElement>(".z-timefield")!.dataset[key] = field.dataset[key];
    panel.append(footer);
  }
  const timefield = footer.querySelector<HTMLElement>(".z-timefield")!;
  if (time) timefield.dataset.value = time;
  else delete timefield.dataset.value;
  limitTime(field, footer, drafts.get(field)?.date ?? null);
}

/** El día de `min` o de `max` limita la hora del TimeField del pie. */
function limitTime(field: HTMLElement, footer: HTMLElement, date: string | null): void {
  const timefield = footer.querySelector<HTMLElement>(".z-timefield");
  if (!timefield) return;
  const bounds = dayTimeBounds(date, field.dataset.min, field.dataset.max);
  for (const key of ["min", "max"] as const) {
    const bound = bounds[key];
    if (bound) timefield.dataset[key] = bound;
    else delete timefield.dataset[key];
  }
  hydrateFields(footer);
}

function openPicker(field: HTMLElement): void {
  const { trigger, panel } = parts(field);
  if (!trigger || !panel || trigger.disabled || isOpen(panel)) return;
  let cal = panel.querySelector<HTMLElement>(".z-calendar");
  if (!cal) {
    cal = document.createElement("div");
    cal.className = "z-calendar";
    panel.prepend(cal);
  }
  const value = fieldValue(field);
  const date = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
  const time = value.length > 10 ? value.slice(11) : null;
  drafts.set(field, { date, time });
  for (const key of FORWARDED) {
    if (field.dataset[key] !== undefined) cal.dataset[key] = field.dataset[key];
    else delete cal.dataset[key];
  }
  for (const key of ["min", "max"] as const) {
    const bound = field.dataset[key];
    if (bound) cal.dataset[key] = bound.slice(0, 10);
    else delete cal.dataset[key];
  }
  if (date) cal.dataset.value = date;
  else delete cal.dataset.value;
  if (withTime(field)) ensureFooter(field, panel, time);
  showPopup(panel, field, trigger, () => {});
  resetCalendar(cal);
  cal.querySelector<HTMLElement>('.z-calendar__grid [tabindex="0"]')?.focus({ preventScroll: true });
}

function closePicker(field: HTMLElement): void {
  const { trigger, panel } = parts(field);
  if (!panel || !isOpen(panel)) return;
  const inside = panel.contains(document.activeElement);
  hidePopup(panel);
  if (inside) trigger?.focus({ preventScroll: true });
}

function apply(field: HTMLElement): void {
  const draft = drafts.get(field);
  if (!draft?.date) return;
  const seconds = field.dataset.granularity === "second";
  const time = draft.time ?? field.dataset.defaultTime ?? "00:00";
  setDateFieldValue(field, clampDateTime(draft.date, time, field.dataset.min, field.dataset.max, seconds));
  closePicker(field);
}

/** Campo del panel abierto que contiene `el`. */
const ownerField = (el: Element) => {
  const owner = ownerOf(el.closest<HTMLElement>(".z-datetimepicker__panel"));
  return owner?.matches(PICKER) ? owner : null;
};

export function setup(on: Listen): void {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest<HTMLElement>(`${PICKER} > button.z-datetimepicker__trigger`);
    if (trigger && inDom(trigger)) {
      const field = trigger.closest<HTMLElement>(PICKER)!;
      if (isOpen(popupFor(trigger))) closePicker(field);
      else openPicker(field);
      return;
    }
    if (target.closest(".z-datetimepicker__footer .z-calendar__apply")) {
      const field = ownerField(target);
      if (field) apply(field);
    }
  });
  on(document, "keydown", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || event.defaultPrevented || !event.altKey || event.key !== "ArrowDown") return;
    const field = target.closest<HTMLElement>(PICKER);
    if (!field || !inDom(field)) return;
    event.preventDefault();
    openPicker(field);
  });
  on(document, "z:change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const field = ownerField(target);
    if (!field) return;
    const draft = drafts.get(field) ?? { date: null, time: null };
    const value = (event as CustomEvent<{ value: unknown }>).detail?.value;
    // El calendario y la hora del panel son un borrador: el valor lo anuncia el campo (z:change) al aplicar.
    if (target.matches(".z-calendar")) {
      draft.date = typeof value === "string" ? value : null;
      drafts.set(field, draft);
      if (!withTime(field) && draft.date) {
        setDateFieldValue(field, draft.date);
        closePicker(field);
      } else {
        const footer = parts(field).panel?.querySelector<HTMLElement>(".z-datetimepicker__footer");
        if (footer) limitTime(field, footer, draft.date);
      }
    } else if (target.matches(".z-timefield")) {
      draft.time = typeof value === "string" ? value : null;
      drafts.set(field, draft);
    }
  });
}

export function hydrate(_root: ParentNode): void {
  // Nada que preparar: el campo lo pinta forms-datefield y el panel se rellena al abrir.
}
