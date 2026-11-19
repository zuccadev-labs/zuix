// DateField, TimeField y TimePicker sin framework. El modelo (orden de segmentos, teclado APG de spinbutton, pegado,
// validez, columnas y franjas) es el de ../core/segments y ../core/time, el mismo que usa el binding de React; aquí se
// leen los atributos `data-*`, se pintan los segmentos y se conectan los eventos delegados.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { clock } from "@zuccadev-labs/zuix-zicon/icons/clock";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { step as stepTo } from "../core/roving";
import {
  bounds,
  FIELD_TEXTS,
  fieldConfig,
  firstEditable,
  isEmpty,
  parsePasted,
  SEGMENT_LABELS,
  SEGMENT_PLACEHOLDERS,
  segmentKey,
  segmentText,
  segmentValueText,
  validity,
  fieldValue,
  valuesFrom,
  type FieldConfig,
  type FieldOptions,
  type FieldState,
  type SegmentType,
} from "../core/segments";
import { nowTime, pickColumn, revealOption, slotMatches, timeColumns, timeLabel, timeSlots, type ColumnType } from "../core/time";
import { all, emit, flag, hidePopup, inDom, isOpen, ownerOf, popupFor, showPopup } from "./forms-popup";
import { logicalKey, type Listen } from "./shared";

// Iconos que el contrato usa con `<z-icon>` (borrar, abrir el panel de hora).
registerIcons([xMark, clock]);

const FIELD = ".z-datefield";
const SEGMENT = ".z-datefield__segment";

interface Entry {
  state: FieldState;
  /** Valor ISO emitido por última vez. */
  emitted: string | null;
  /** Valor con el que se hidrató: `form.reset()` vuelve a él. */
  initial: string | null;
  edited: boolean;
  userInvalid: boolean;
  /** `data-invalid` puesto por la aplicación: el campo es inválido siempre. */
  forced: boolean;
}

const entries = new WeakMap<HTMLElement, Entry>();

const isTime = (field: HTMLElement) => field.classList.contains("z-timefield");

function options(field: HTMLElement): FieldOptions {
  const data = field.dataset;
  const number = (raw: string | undefined) => (raw === undefined || raw === "" ? undefined : Number(raw));
  const granularity = data.granularity;
  return {
    locale: data.locale,
    time: isTime(field),
    granularity:
      granularity === "day" || granularity === "hour" || granularity === "minute" || granularity === "second" ? granularity : undefined,
    hourCycle: data.hourCycle === "12" ? 12 : data.hourCycle === "24" ? 24 : undefined,
    minuteStep: number(data.minuteStep),
    secondStep: number(data.secondStep),
    min: data.min,
    max: data.max,
    placeholderValue: data.placeholderValue,
    forceLeadingZeros: data.leadingZeros !== "false",
  };
}

const configOf = (field: HTMLElement) => fieldConfig(options(field));
const nativeOf = (field: HTMLElement) => field.querySelector<HTMLInputElement>("input.z-native-input");
const segmentsOf = (field: HTMLElement) => [...field.querySelectorAll<HTMLElement>(`${SEGMENT}[data-segment]`)];

function entryOf(field: HTMLElement): Entry {
  let entry = entries.get(field);
  if (!entry) {
    const config = configOf(field);
    const raw = field.dataset.value ?? nativeOf(field)?.value ?? null;
    const values = valuesFrom(raw, config);
    const value = fieldValue(values, config);
    entry = {
      state: { values, typed: null },
      emitted: value,
      initial: value,
      edited: false,
      userInvalid: false,
      forced: field.hasAttribute("data-invalid"),
    };
    entries.set(field, entry);
  }
  return entry;
}

/** Segmentos en el orden del locale. Si el marcado no coincide con la configuración, se rehacen con sus mismos nombres. */
function ensureSegments(field: HTMLElement, config: FieldConfig): HTMLElement[] {
  const existing = segmentsOf(field);
  const types = existing.map((s) => s.dataset.segment);
  // Un segmento que llega vacío trae en su texto el marcador propio de la aplicación.
  for (const segment of existing)
    if (segment.hasAttribute("data-placeholder") && segment.dataset.placeholderText === undefined)
      segment.dataset.placeholderText = segment.textContent ?? "";
  if (types.length === config.types.length && types.every((t, i) => t === config.types[i])) return existing;
  const labels = new Map(existing.map((s) => [s.dataset.segment, s.getAttribute("aria-label")]));
  const placeholders = new Map(existing.map((s) => [s.dataset.segment, s.dataset.placeholderText]));
  let input = field.querySelector<HTMLElement>(".z-datefield__input");
  if (!input) {
    input = document.createElement("span");
    input.className = "z-datefield__input";
    field.prepend(input);
  }
  const nodes = config.parts.map((part) => {
    const node = document.createElement("span");
    if (part.type === "literal") {
      node.className = "z-datefield__literal";
      node.setAttribute("aria-hidden", "true");
      node.textContent = part.text;
      return node;
    }
    node.className = "z-datefield__segment";
    node.setAttribute("role", "spinbutton");
    node.dataset.segment = part.type;
    node.setAttribute("aria-label", labels.get(part.type) ?? SEGMENT_LABELS[part.type]);
    const placeholder = placeholders.get(part.type);
    if (placeholder !== undefined) node.dataset.placeholderText = placeholder;
    node.setAttribute("inputmode", part.type === "dayPeriod" ? "text" : "numeric");
    for (const [name, value] of [
      ["spellcheck", "false"],
      ["autocorrect", "off"],
      ["autocapitalize", "off"],
      ["enterkeyhint", "next"],
    ])
      node.setAttribute(name!, value!);
    return node;
  });
  input.replaceChildren(...nodes);
  return segmentsOf(field);
}

/** Pinta el estado del campo: texto y ARIA de cada segmento, botón de borrar, campo nativo y validez. */
function render(field: HTMLElement): void {
  const config = configOf(field);
  const entry = entryOf(field);
  const { state } = entry;
  const segments = ensureSegments(field, config);
  const disabled = field.hasAttribute("data-disabled");
  const readOnly = field.hasAttribute("data-readonly");
  const editable = !disabled && !readOnly;
  const invalid = entry.forced || entry.userInvalid;
  const empty = field.dataset.emptyLabel ?? "Empty";
  const native = nativeOf(field);
  // Una sola parada de Tab: la que ya tenía el 0 (o la primera).
  const roving = Math.max(
    0,
    segments.findIndex((s) => s.getAttribute("tabindex") === "0"),
  );
  segments.forEach((segment, index) => {
    const type = segment.dataset.segment as SegmentType;
    const text = segmentText(type, state, config);
    const [lo, hi] = bounds(type, state.values, config);
    const shown = text ?? segment.dataset.placeholderText ?? SEGMENT_PLACEHOLDERS[type];
    if (segment.textContent !== shown) segment.textContent = shown;
    flag(segment, "data-placeholder", text === null);
    segment.setAttribute("aria-valuemin", String(lo));
    segment.setAttribute("aria-valuemax", String(hi));
    const now = state.values[type];
    if (now === undefined) segment.removeAttribute("aria-valuenow");
    else segment.setAttribute("aria-valuenow", String(now));
    segment.setAttribute("aria-valuetext", segmentValueText(type, state, config) ?? empty);
    flag(segment, "aria-invalid", invalid, "true");
    flag(segment, "aria-readonly", readOnly, "true");
    flag(segment, "aria-disabled", disabled, "true");
    flag(segment, "aria-required", Boolean(native?.required), "true");
    flag(segment, "contenteditable", editable, "true");
    if (disabled) segment.removeAttribute("tabindex");
    else segment.tabIndex = index === roving ? 0 : -1;
  });
  flag(field, "data-invalid", invalid);
  const iso = fieldValue(state.values, config);
  if (iso) field.dataset.value = iso;
  else delete field.dataset.value;
  const clear = field.querySelector<HTMLButtonElement>(".z-datefield__clear");
  if (clear) clear.hidden = isEmpty(state.values) || !editable;
  if (native) {
    native.value = iso ?? "";
    const texts = FIELD_TEXTS[config.kind === "time" ? "time" : "date"];
    const status = validity(state.values, config);
    const data = field.dataset;
    native.setCustomValidity(
      status === "incomplete"
        ? (data.incompleteMessage ?? texts.incomplete)
        : status === "invalid"
          ? (data.invalidMessage ?? texts.invalid)
          : status === "outOfRange"
            ? (data.rangeMessage ?? texts.range)
            : "",
    );
  }
}

function commit(field: HTMLElement, next: FieldState, edited = true): void {
  const entry = entryOf(field);
  const config = configOf(field);
  entry.state = next;
  if (edited) entry.edited = true;
  const status = validity(next.values, config);
  if (entry.userInvalid && (status === "valid" || status === "empty")) entry.userInvalid = false;
  render(field);
  const value = fieldValue(next.values, config);
  if (value !== entry.emitted) {
    entry.emitted = value;
    emit(field, "change", { value });
    refreshPanel(field);
  }
}

function focusSegment(field: HTMLElement, index: number): void {
  const segments = segmentsOf(field);
  const target = segments[index];
  if (!target || field.hasAttribute("data-disabled")) return;
  for (const segment of segments) segment.tabIndex = segment === target ? 0 : -1;
  target.focus();
}

/** Una tecla (o un carácter de `beforeinput`) en un segmento. Devuelve si el campo la atendió. */
function apply(field: HTMLElement, segment: HTMLElement, key: string): boolean {
  const config = configOf(field);
  const entry = entryOf(field);
  const index = segmentsOf(field).indexOf(segment);
  const type = segment.dataset.segment as SegmentType;
  const editable = !field.hasAttribute("data-disabled") && !field.hasAttribute("data-readonly");
  const outcome = segmentKey(entry.state, type, key, config, !editable);
  if (!outcome.handled) return false;
  if (outcome.state !== entry.state) commit(field, outcome.state);
  if (outcome.focus) focusSegment(field, index + (outcome.focus === "next" ? 1 : -1));
  return true;
}

function setValue(field: HTMLElement, value: string | null): void {
  const config = configOf(field);
  const entry = entryOf(field);
  entry.state = { values: valuesFrom(value, config), typed: null };
  entry.userInvalid = false;
  entry.emitted = fieldValue(entry.state.values, config);
  render(field);
  refreshPanel(field);
  emit(field, "change", { value: entry.emitted });
}

/** Fija el valor de un DateField (`YYYY-MM-DD` o `YYYY-MM-DDTHH:mm[:ss]`, o `null`). Emite z:change. */
export function setDateFieldValue(field: HTMLElement, value: string | null): void {
  setValue(field, value);
}

/** Fija el valor de un TimeField (`HH:mm` o `HH:mm:ss`, o `null`). Emite z:change. */
export function setTimeFieldValue(field: HTMLElement, value: string | null): void {
  setValue(field, value);
}

/** Fija el valor de un TimePicker (`HH:mm` o `HH:mm:ss`, o `null`); el panel abierto se actualiza. Emite z:change. */
export function setTimePickerValue(field: HTMLElement, value: string | null): void {
  setValue(field, value);
}

/* ---------- TimePicker ---------- */

const PICKER = ".z-timepicker";
const panelQueries = new WeakMap<HTMLElement, string>();

const triggerOf = (field: HTMLElement) => field.querySelector<HTMLButtonElement>("button.z-timepicker__trigger");

function pickerSettings(field: HTMLElement) {
  const config = configOf(field);
  const data = field.dataset;
  const disabledTimes = new Set((data.disabledTimes ?? "").split(",").map((t) => t.trim()));
  const seconds = config.granularity === "second";
  return {
    config,
    seconds,
    variant: data.variant === "list" ? "list" : "columns",
    step: Number(data.step) || 30,
    isTimeDisabled: (time: string) => disabledTimes.has(time) || disabledTimes.has(time.slice(0, 5)),
    labels: {
      hour: data.hoursLabel ?? "Hours",
      minute: data.minutesLabel ?? "Minutes",
      second: data.secondsLabel ?? "Seconds",
      dayPeriod: data.periodLabel ?? "AM/PM",
    } as Record<ColumnType, string>,
    timesLabel: data.timesLabel ?? "Times",
    nowLabel: data.showNow !== undefined ? data.nowLabel || "Now" : null,
  };
}

function option(label: string, value: string, selected: boolean, disabled: boolean, tabbable: boolean): HTMLElement {
  const node = document.createElement("div");
  node.className = "z-timepicker__option";
  node.setAttribute("role", "option");
  node.dataset.value = value;
  node.setAttribute("aria-selected", String(selected));
  if (disabled) node.setAttribute("aria-disabled", "true");
  node.tabIndex = tabbable ? 0 : -1;
  node.textContent = label;
  return node;
}

/** Rehace el contenido del panel con el valor actual. Conserva el foco en la misma opción. */
function fillPanel(panel: HTMLElement, field: HTMLElement): void {
  const s = pickerSettings(field);
  const value = fieldValue(entryOf(field).state.values, s.config);
  const focused = panel.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
  const focusKey = focused ? `${focused.closest("[data-column]")?.getAttribute("data-column") ?? "list"}|${focused.dataset.value}` : null;
  panel.dataset.variant = s.variant;
  const nodes: HTMLElement[] = [];
  if (s.variant === "list") {
    const query = panelQueries.get(panel) ?? "";
    const slots = timeSlots(s.step, s.config.min, s.config.max).map((time) => {
      const full = s.seconds ? `${time}:00` : time;
      return { time: full, label: timeLabel(time, s.config.locale, s.config.cycle), disabled: s.isTimeDisabled(full) };
    });
    const shown = slots.filter((slot) => slotMatches(slot.time, slot.label, query));
    const tabbable = shown.find((slot) => slot.time === value && !slot.disabled) ?? shown.find((slot) => !slot.disabled) ?? shown[0];
    if (query) {
      const indicator = document.createElement("div");
      indicator.className = "z-timepicker__query";
      indicator.setAttribute("aria-hidden", "true");
      indicator.textContent = query;
      nodes.push(indicator);
    }
    const list = document.createElement("div");
    list.className = "z-timepicker__list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", s.timesLabel);
    list.append(...shown.map((slot) => option(slot.label, slot.time, slot.time === value, slot.disabled, slot === tabbable)));
    nodes.push(list);
  } else {
    const wrap = document.createElement("div");
    wrap.className = "z-timepicker__columns";
    const columns = timeColumns({
      value,
      cycle: s.config.cycle,
      seconds: s.seconds,
      minuteStep: s.config.minuteStep,
      secondStep: s.config.secondStep,
      min: s.config.min,
      max: s.config.max,
      isTimeDisabled: s.isTimeDisabled,
      digits: s.config.digits,
      periods: s.config.periods,
    });
    for (const column of columns) {
      const list = document.createElement("div");
      list.className = "z-timepicker__column";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", s.labels[column.type]);
      list.dataset.column = column.type;
      const tabbable =
        column.options.find((o) => o.value === column.selected && !o.disabled) ??
        column.options.find((o) => !o.disabled) ??
        column.options[0];
      list.append(...column.options.map((o) => option(o.label, String(o.value), o.value === column.selected, o.disabled, o === tabbable)));
      wrap.append(list);
    }
    nodes.push(wrap);
  }
  if (s.nowLabel) {
    const footer = document.createElement("div");
    footer.className = "z-timepicker__footer";
    const now = document.createElement("button");
    now.type = "button";
    now.className = "z-btn z-btn--ghost z-timepicker__now";
    now.dataset.size = "sm";
    now.textContent = s.nowLabel;
    footer.append(now);
    nodes.push(footer);
  }
  // Conserva el desplazamiento de cada lista al rehacerla.
  const scroll = [...panel.querySelectorAll<HTMLElement>('[role="listbox"]')].map((list) => list.scrollTop);
  panel.replaceChildren(...nodes);
  panel.querySelectorAll<HTMLElement>('[role="listbox"]').forEach((list, i) => {
    list.scrollTop = scroll[i] ?? 0;
  });
  if (focusKey) {
    const [column, key] = focusKey.split("|");
    const list =
      column === "list"
        ? panel.querySelector<HTMLElement>(".z-timepicker__list")
        : panel.querySelector<HTMLElement>(`[data-column="${column}"]`);
    const target = list?.querySelector<HTMLElement>(`[data-value="${key}"]`);
    if (list && target) {
      target.focus({ preventScroll: true });
      revealOption(list, target);
    }
  }
}

function refreshPanel(field: HTMLElement): void {
  if (!field.matches(PICKER)) return;
  const panel = popupFor(triggerOf(field));
  if (panel && isOpen(panel)) fillPanel(panel, field);
}

function openPicker(field: HTMLElement): void {
  const trigger = triggerOf(field);
  const panel = popupFor(trigger);
  if (!trigger || !panel || trigger.disabled || isOpen(panel)) return;
  panelQueries.delete(panel);
  fillPanel(panel, field);
  showPopup(panel, field, trigger, () => panelQueries.delete(panel));
  for (const list of panel.querySelectorAll<HTMLElement>('[role="listbox"]')) {
    const chosen = list.querySelector<HTMLElement>('[aria-selected="true"]');
    if (chosen) revealOption(list, chosen, true);
  }
  panel.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus({ preventScroll: true });
}

function closePicker(field: HTMLElement): void {
  const trigger = triggerOf(field);
  const panel = popupFor(trigger);
  if (!panel || !isOpen(panel)) return;
  const inside = panel.contains(document.activeElement);
  hidePopup(panel);
  if (inside) trigger?.focus({ preventScroll: true });
}

/** Elige una hora desde el panel: actualiza el campo y emite z:change. */
function pickTime(field: HTMLElement, time: string): void {
  commit(field, { values: valuesFrom(time, configOf(field)), typed: null }, false);
}

/** Campo dueño de un panel abierto de TimePicker. */
function pickerOfPanel(el: Element): { field: HTMLElement; panel: HTMLElement } | null {
  const panel = el.closest<HTMLElement>(".z-timepicker__panel");
  const field = ownerOf(panel);
  return panel && field?.matches(PICKER) ? { field, panel } : null;
}

function onOptionKey(event: KeyboardEvent, target: HTMLElement, field: HTMLElement, panel: HTMLElement): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const s = pickerSettings(field);
  const list = target.closest<HTMLElement>('[role="listbox"]')!;
  const options = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  const disabled = (o: HTMLElement) => o.getAttribute("aria-disabled") === "true";
  const focusIn = (l: HTMLElement | null | undefined, o: HTMLElement | null | undefined) => {
    if (!l || !o) return;
    o.focus({ preventScroll: true });
    revealOption(l, o);
  };
  if (s.variant === "list") {
    const query = panelQueries.get(panel) ?? "";
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!disabled(target)) {
        pickTime(field, target.dataset.value!);
        closePicker(field);
      }
    } else if ((event.key === "Backspace" || event.key === "Escape") && query) {
      // Escape limpia el filtro; con la lista completa, el siguiente Escape cierra el panel.
      event.preventDefault();
      setQuery(panel, field, event.key === "Escape" ? "" : query.slice(0, -1));
    } else if (event.key.length === 1 && /[\p{L}\p{N}]/u.test(event.key)) {
      event.preventDefault();
      const next = query + event.key;
      const matches = timeSlots(s.step, s.config.min, s.config.max).some((time) =>
        slotMatches(time, timeLabel(time, s.config.locale, s.config.cycle), next),
      );
      if (matches) setQuery(panel, field, next);
    } else {
      const next = stepTo(options, target, event.key, false);
      if (!next) return;
      event.preventDefault();
      focusIn(list, next);
    }
    return;
  }
  const columns = [...panel.querySelectorAll<HTMLElement>("[data-column]")];
  const key = logicalKey(event.key, target);
  const type = list.dataset.column as ColumnType;
  const choose = (o: HTMLElement) => {
    const value = fieldValue(entryOf(field).state.values, s.config);
    pickTime(field, pickColumn(value, type, Number(o.dataset.value), s.config.cycle, s.seconds, field.dataset.placeholderValue ?? null));
  };
  if (key === "ArrowLeft" || key === "ArrowRight") {
    event.preventDefault();
    const other = columns[columns.indexOf(list) + (key === "ArrowLeft" ? -1 : 1)];
    focusIn(other, other?.querySelector<HTMLElement>('[tabindex="0"]'));
  } else if (key === "Enter" || key === " ") {
    event.preventDefault();
    if (!disabled(target)) choose(target);
    if (key === "Enter") closePicker(field);
  } else {
    const next = stepTo(options, target, key, false);
    if (!next) return;
    event.preventDefault();
    focusIn(list, next);
    // La selección sigue al foco: el panel se rehace y el foco vuelve a la misma opción.
    if (!disabled(next)) choose(next);
  }
}

function setQuery(panel: HTMLElement, field: HTMLElement, query: string): void {
  panelQueries.set(panel, query);
  // Sin foco previo que conservar: tras filtrar, el foco va a la primera franja que coincide.
  (document.activeElement as HTMLElement | null)?.blur?.();
  fillPanel(panel, field);
  const list = panel.querySelector<HTMLElement>(".z-timepicker__list");
  const first =
    list?.querySelector<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? list?.querySelector<HTMLElement>('[role="option"]');
  if (list && first) {
    first.focus({ preventScroll: true });
    revealOption(list, first);
  }
}

/* ---------- Delegación ---------- */

/** Campo activo que contiene `target` (dentro de `[data-z-dom]`). */
function fieldAt(target: EventTarget | null): HTMLElement | null {
  const field = target instanceof Element ? target.closest<HTMLElement>(FIELD) : null;
  return field && inDom(field) ? field : null;
}
const segmentAt = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>(`${FIELD} ${SEGMENT}`) : null);

export function setup(on: Listen): void {
  // Opciones del panel en captura: Escape limpia el filtro de la lista antes de que la pila de capas cierre el panel.
  on(
    document,
    "keydown",
    (event) => {
      const target = event.target;
      if (event.defaultPrevented || !(target instanceof HTMLElement) || !target.matches('.z-timepicker__panel [role="option"]')) return;
      const owner = pickerOfPanel(target);
      if (owner) onOptionKey(event, target, owner.field, owner.panel);
    },
    true,
  );
  on(document, "keydown", (event) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const field = fieldAt(target);
    if (!field) return;
    if (event.altKey && event.key === "ArrowDown" && field.matches(PICKER)) {
      event.preventDefault();
      openPicker(field);
      return;
    }
    const segment = segmentAt(target);
    if (!segment || event.ctrlKey || event.metaKey || event.altKey || event.key === "Tab" || event.key === "Escape") return;
    if (event.key === "Enter") {
      event.preventDefault();
      nativeOf(field)?.form?.requestSubmit();
      return;
    }
    if (apply(field, segment, logicalKey(event.key, segment))) event.preventDefault();
  });
  // Teclados virtuales y dictado: el carácter llega en `beforeinput`, sin tecla reconocible.
  on(document, "beforeinput", (event) => {
    const segment = segmentAt(event.target);
    const field = segment && fieldAt(segment);
    if (!field) return;
    event.preventDefault();
    const input = event as InputEvent;
    if (input.inputType === "insertText" && input.data) {
      let current = segment;
      for (const ch of input.data) {
        apply(field, current, ch);
        current = segmentAt(document.activeElement) ?? current;
      }
    } else if (input.inputType.startsWith("delete")) apply(field, segment, "Backspace");
  });
  on(document, "input", (event) => {
    const field = segmentAt(event.target) && fieldAt(event.target);
    if (field) render(field);
  });
  on(document, "paste", (event) => {
    const segment = segmentAt(event.target);
    const field = segment && fieldAt(segment);
    if (!field) return;
    event.preventDefault();
    if (field.hasAttribute("data-disabled") || field.hasAttribute("data-readonly")) return;
    const pasted = parsePasted(event.clipboardData?.getData("text") ?? "", configOf(field));
    if (pasted) commit(field, { values: { ...entryOf(field).state.values, ...pasted }, typed: null });
  });
  on(document, "focusin", (event) => {
    // La validación nativa enfoca el campo oculto inválido: el foco pasa al primer segmento vacío.
    const native = event.target instanceof HTMLInputElement && event.target.matches(".z-native-input") ? fieldAt(event.target) : null;
    if (native) {
      focusSegment(native, firstEditable(entryOf(native).state.values, configOf(native)));
      return;
    }
    const segment = segmentAt(event.target);
    const field = segment && fieldAt(segment);
    if (!field) return;
    for (const other of segmentsOf(field)) other.tabIndex = other === segment ? 0 : -1;
    const entry = entryOf(field);
    if (entry.state.typed && entry.state.typed.type !== segment.dataset.segment) {
      entry.state = { ...entry.state, typed: null };
      render(field);
    }
  });
  on(document, "focusout", (event) => {
    const field = fieldAt(event.target);
    if (!field) return;
    const entry = entryOf(field);
    // Al dejar un segmento se olvida lo tecleado: el año escrito con dos cifras se muestra relleno.
    if (entry.state.typed) {
      entry.state = { ...entry.state, typed: null };
      render(field);
    }
    if (field.contains(event.relatedTarget as Node | null)) return;
    // Validar al salir, y solo si se editó: no se avisa mientras se teclea.
    if (entry.edited) {
      entry.edited = false;
      const status = validity(entry.state.values, configOf(field));
      entry.userInvalid = status === "incomplete" || status === "invalid" || status === "outOfRange";
    }
    render(field);
  });
  on(document, "pointerdown", (event) => {
    const field = fieldAt(event.target);
    const target = event.target as Element;
    // Los botones del campo (borrar, abrir un panel, uno propio de la aplicación) siguen su curso.
    if (!field || event.button !== 0 || field.hasAttribute("data-disabled") || target.closest("[data-segment], button, a, input")) return;
    event.preventDefault();
    focusSegment(field, firstEditable(entryOf(field).state.values, configOf(field)));
  });
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const panelOption = target.closest<HTMLElement>('.z-timepicker__panel [role="option"]');
    const nowButton = target.closest<HTMLElement>(".z-timepicker__panel .z-timepicker__now");
    if (panelOption || nowButton) {
      const owner = pickerOfPanel((panelOption ?? nowButton)!);
      if (!owner) return;
      const { field } = owner;
      const s = pickerSettings(field);
      if (nowButton) {
        pickTime(field, nowTime(s.seconds));
        closePicker(field);
      } else if (panelOption && panelOption.getAttribute("aria-disabled") !== "true") {
        const column = panelOption.closest<HTMLElement>("[data-column]")?.dataset.column as ColumnType | undefined;
        if (column) {
          const value = fieldValue(entryOf(field).state.values, s.config);
          pickTime(
            field,
            pickColumn(value, column, Number(panelOption.dataset.value), s.config.cycle, s.seconds, field.dataset.placeholderValue ?? null),
          );
        } else {
          pickTime(field, panelOption.dataset.value!);
          closePicker(field);
        }
      }
      return;
    }
    const field = fieldAt(target);
    if (!field) return;
    if (target.closest(".z-datefield__clear")) {
      commit(field, { values: {}, typed: null });
      focusSegment(field, 0);
    } else if (target.closest(".z-timepicker__trigger") && field.matches(PICKER)) {
      const panel = popupFor(triggerOf(field));
      if (isOpen(panel)) closePicker(field);
      else openPicker(field);
    }
  });
  // Formulario: un envío inválido marca el campo y le lleva el foco; `form.reset()` vuelve al valor inicial.
  on(
    document,
    "invalid",
    (event) => {
      const input = event.target;
      const field = input instanceof HTMLInputElement && input.matches(".z-native-input") ? fieldAt(input) : null;
      if (!field) return;
      entryOf(field).userInvalid = true;
      render(field);
    },
    true,
  );
  on(document, "reset", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const fields = all(form, FIELD);
    if (!fields.length) return;
    // `reset` llega antes de que el formulario restablezca sus campos.
    setTimeout(() => {
      for (const field of fields) {
        const entry = entryOf(field);
        entry.edited = false;
        entry.userInvalid = false;
        commit(field, { values: valuesFrom(entry.initial, configOf(field)), typed: null }, false);
      }
    }, 0);
  });
}

export function hydrate(root: ParentNode): void {
  for (const field of all(root, FIELD)) render(field);
}
