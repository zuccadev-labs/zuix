// DurationField: duración por segmentos (horas, minutos, segundos) como pieza (core/widget). Grupo con nombre y un
// `spinbutton` por unidad con su valor hablado («2 hours»); una sola parada de Tab para el grupo. ↑/↓ cambian,
// RePág/AvPág de diez en diez, Inicio/Fin al mínimo y al máximo, ←/→ entre segmentos, las cifras se teclean y
// Retroceso borra. Se puede pegar «1:30», «90m» o «PT1H30M». Preajustes opcionales (15 min, 30 min, 1 h). El valor
// público es ISO 8601 (`PT1H30M`), que también viaja en el campo oculto del formulario.

import { logicalKey } from "./dir";
import { balance, formatDuration, toISODuration, toMs, type DurationUnit } from "./duration";
import { h, on } from "./vnode";
import { list, num, yes, type Widget, type WidgetHost } from "./widget";

export type DurationFieldUnit = Extract<DurationUnit, "hours" | "minutes" | "seconds">;
const ALL: DurationFieldUnit[] = ["hours", "minutes", "seconds"];
const UNIT_MS: Record<DurationFieldUnit, number> = { hours: 3_600_000, minutes: 60_000, seconds: 1000 };
const SINGULAR: Record<DurationFieldUnit, "hour" | "minute" | "second"> = { hours: "hour", minutes: "minute", seconds: "second" };

export interface DurationFieldLabels {
  hours: string;
  minutes: string;
  seconds: string;
  /** Sufijos visibles de cada segmento. */
  hoursShort: string;
  minutesShort: string;
  secondsShort: string;
  /** Nombre del grupo de preajustes. */
  presets: string;
}

export const DURATION_FIELD_LABELS: DurationFieldLabels = {
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",
  hoursShort: "h",
  minutesShort: "min",
  secondsShort: "s",
  presets: "Presets",
};

export interface DurationFieldProps {
  /** Valor controlado en ISO 8601 (`PT1H30M`) o milisegundos. */
  value?: string | number | null;
  defaultValue?: string | number | null;
  units?: readonly DurationFieldUnit[];
  /** Tope (ISO o ms). */
  max?: string | number;
  /** Paso del segmento de minutos (5 → 0, 5, 10…). */
  step?: number;
  /** Preajustes (ISO o ms): botones bajo el campo. */
  presets?: readonly (string | number)[];
  name?: string;
  form?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  size?: "sm" | "md" | "lg";
  /** Nombre accesible del grupo. */
  label?: string;
  locale?: string;
  labels?: Partial<DurationFieldLabels>;
}

interface Config {
  units: DurationFieldUnit[];
  max: number | null;
  step: number;
  presets: number[];
  value: string | number | null | undefined;
  defaultValue: string | number | null | undefined;
  name?: string;
  form?: string;
  disabled: boolean;
  required: boolean;
  invalid: boolean;
  size: "sm" | "md" | "lg";
  label: string;
  locale?: string;
  labels: DurationFieldLabels;
}

interface State {
  ms: number;
  active: number;
  buffer: string;
  prop: string | number | null | undefined;
}

type Host = WidgetHost<Config, State>;

const unitsOf = (units: readonly string[] | undefined): DurationFieldUnit[] => {
  const wanted = ALL.filter((u) => units?.includes(u));
  return wanted.length ? wanted : ["hours", "minutes"];
};

/** Máximo de cada segmento: el mayor llega hasta el tope (o 99 horas, 999 minutos), los demás hasta 59. */
export function segmentMax(units: readonly DurationFieldUnit[], unit: DurationFieldUnit, max: number | null): number {
  if (unit !== units[0]) return 59;
  if (max !== null) return Math.floor(max / UNIT_MS[unit]);
  return unit === "hours" ? 99 : 999;
}

/** Valores de los segmentos para unos milisegundos. */
export function segmentValues(ms: number, units: readonly DurationFieldUnit[]): Record<DurationFieldUnit, number> {
  const parts = balance(ms, units[0]!, units[units.length - 1]!);
  return { hours: parts.hours, minutes: parts.minutes, seconds: parts.seconds };
}

/** Milisegundos tras cambiar un segmento, con el total dentro del tope. */
export function withSegment(
  ms: number,
  units: readonly DurationFieldUnit[],
  unit: DurationFieldUnit,
  value: number,
  max: number | null,
): number {
  const values = segmentValues(ms, units);
  values[unit] = Math.max(0, Math.min(segmentMax(units, unit, max), Math.round(value)));
  const total = units.reduce((sum, u) => sum + values[u] * UNIT_MS[u], 0);
  return max !== null ? Math.min(max, total) : total;
}

function spokenUnit(value: number, unit: DurationFieldUnit, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "unit", unit: SINGULAR[unit], unitDisplay: "long" }).format(value);
  } catch {
    return `${value} ${SINGULAR[unit]}${value === 1 ? "" : "s"}`;
  }
}

const truncate = (ms: number, units: readonly DurationFieldUnit[]) => {
  const size = UNIT_MS[units[units.length - 1]!];
  return Math.floor(ms / size) * size;
};

function commit(host: Host, ms: number, patch: Partial<State> = {}, focus = false): void {
  const before = host.state().ms;
  host.update({ ...patch, ms }, focus);
  if (ms !== before) host.emit("change", { value: toISODuration(ms), ms });
}

function attach(root: HTMLElement, host: Host): () => void {
  const segmentOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>(".z-duration-field__segment") : null;
  const indexOf = (el: HTMLElement) => Number(el.dataset.index);

  const keydown = (event: KeyboardEvent) => {
    const seg = segmentOf(event.target);
    const c = host.config();
    if (!seg || c.disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const s = host.state();
    const i = indexOf(seg);
    const unit = c.units[i]!;
    const values = segmentValues(s.ms, c.units);
    const top = segmentMax(c.units, unit, c.max);
    const step = unit === "minutes" ? c.step : 1;
    const key = logicalKey(event.key, seg);
    const set = (value: number, extra: Partial<State> = {}) =>
      commit(host, withSegment(s.ms, c.units, unit, value, c.max), { buffer: "", ...extra }, true);
    if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();
      const delta = key === "ArrowUp" ? step : -step;
      let next = values[unit] + delta;
      // Los segmentos menores dan la vuelta (59 → 0); el mayor se queda en sus límites.
      if (i > 0) next = ((next % (top + 1)) + (top + 1)) % (top + 1);
      set(next);
    } else if (key === "PageUp" || key === "PageDown") {
      event.preventDefault();
      set(values[unit] + (key === "PageUp" ? 10 : -10));
    } else if (key === "Home" || key === "End") {
      event.preventDefault();
      set(key === "Home" ? 0 : top);
    } else if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      const next = Math.max(0, Math.min(c.units.length - 1, i + (key === "ArrowRight" ? 1 : -1)));
      host.update({ active: next, buffer: "" }, true);
    } else if (key === "Backspace" || key === "Delete") {
      event.preventDefault();
      const buffer = s.buffer.slice(0, -1);
      set(buffer ? Number(buffer) : 0, { buffer });
    } else if (/^\d$/.test(event.key)) {
      event.preventDefault();
      typeDigit(host, i, event.key);
    }
  };
  // Teclados en pantalla: llegan como `beforeinput` sobre el segmento editable.
  const beforeinput = (event: InputEvent) => {
    const seg = segmentOf(event.target);
    if (!seg) return;
    event.preventDefault();
    if (host.config().disabled) return;
    const i = indexOf(seg);
    if (event.inputType === "insertText" && event.data) for (const ch of event.data) if (/\d/.test(ch)) typeDigit(host, i, ch);
    if (event.inputType.startsWith("delete")) {
      const s = host.state();
      const c = host.config();
      const buffer = s.buffer.slice(0, -1);
      commit(host, withSegment(s.ms, c.units, c.units[i]!, buffer ? Number(buffer) : 0, c.max), { buffer }, true);
    }
  };
  const focusin = (event: FocusEvent) => {
    const seg = segmentOf(event.target);
    if (seg && indexOf(seg) !== host.state().active) host.update({ active: indexOf(seg), buffer: "" });
  };
  const focusout = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    if (host.state().buffer) host.update({ buffer: "" });
  };
  const paste = (event: ClipboardEvent) => {
    if (!segmentOf(event.target) || host.config().disabled) return;
    const text = event.clipboardData?.getData("text") ?? "";
    const ms = toMs(text);
    event.preventDefault();
    if (!ms && !/^\s*(PT?0+[HMS]?|0+(:0+){0,2})\s*$/i.test(text)) return;
    const c = host.config();
    commit(host, truncate(c.max !== null ? Math.min(c.max, ms) : ms, c.units), { buffer: "" }, true);
  };
  const click = (event: MouseEvent) => {
    const preset = (event.target as Element | null)?.closest?.<HTMLButtonElement>(".z-duration-field__preset");
    if (!preset || !root.contains(preset) || host.config().disabled) return;
    const c = host.config();
    const ms = Number(preset.dataset.ms);
    commit(host, truncate(c.max !== null ? Math.min(c.max, ms) : ms, c.units), { buffer: "" });
  };
  root.addEventListener("keydown", keydown);
  root.addEventListener("beforeinput", beforeinput);
  root.addEventListener("focusin", focusin);
  root.addEventListener("focusout", focusout);
  root.addEventListener("paste", paste);
  root.addEventListener("click", click);
  return () => {
    root.removeEventListener("keydown", keydown);
    root.removeEventListener("beforeinput", beforeinput);
    root.removeEventListener("focusin", focusin);
    root.removeEventListener("focusout", focusout);
    root.removeEventListener("paste", paste);
    root.removeEventListener("click", click);
  };
}

/** Cifra tecleada en el segmento `i`: se acumula y, cuando no cabe otra, se pasa al siguiente. */
function typeDigit(host: Host, i: number, digit: string): void {
  const c = host.config();
  const s = host.state();
  const unit = c.units[i]!;
  const top = segmentMax(c.units, unit, c.max);
  let buffer = (i === s.active ? s.buffer : "") + digit;
  if (Number(buffer) > top) buffer = digit;
  const value = Math.min(top, Number(buffer));
  const full = buffer.length >= String(top).length || value * 10 > top;
  const next = full && i < c.units.length - 1 ? i + 1 : i;
  commit(host, withSegment(s.ms, c.units, unit, value, c.max), { buffer: full ? "" : buffer, active: next }, true);
}

export const durationFieldWidget: Widget<DurationFieldProps, Config, State> = {
  root: "z-duration-field",
  configure: (p) => ({
    units: unitsOf(p.units),
    max: p.max === undefined || p.max === null || p.max === "" ? null : toMs(p.max) || null,
    step: Math.max(1, Math.min(30, Math.round(Number(p.step) || 1))),
    presets: (p.presets ?? []).map((v) => toMs(v)).filter((ms) => ms > 0),
    value: p.value,
    defaultValue: p.defaultValue,
    name: p.name,
    form: p.form,
    disabled: Boolean(p.disabled),
    required: Boolean(p.required),
    invalid: Boolean(p.invalid),
    size: p.size === "sm" || p.size === "lg" ? p.size : "md",
    label: p.label ?? "Duration",
    locale: p.locale,
    labels: { ...DURATION_FIELD_LABELS, ...p.labels },
  }),
  initial: (c) => ({ ms: truncate(toMs(c.value ?? c.defaultValue), c.units), active: 0, buffer: "", prop: c.value }),
  control: (c, s) => (c.value !== undefined && c.value !== s.prop ? { ...s, ms: truncate(toMs(c.value), c.units), prop: c.value } : s),
  tree(c, s, uid) {
    const values = segmentValues(s.ms, c.units);
    const iso = toISODuration(s.ms);
    const segments = c.units.flatMap((unit, i) => {
      const value = values[unit];
      const top = segmentMax(c.units, unit, c.max);
      const shown =
        i === s.active && s.buffer ? s.buffer.padStart(i === 0 ? 1 : 2, "0") : i === 0 ? String(value) : String(value).padStart(2, "0");
      return [
        h(
          "span",
          {
            key: unit,
            class: "z-duration-field__segment",
            role: "spinbutton",
            "data-unit": unit,
            "data-index": i,
            "data-focus-id": unit,
            tabindex: c.disabled ? undefined : i === s.active ? 0 : -1,
            contenteditable: c.disabled ? undefined : "true",
            inputmode: "numeric",
            spellcheck: "false",
            autocorrect: "off",
            autocapitalize: "off",
            enterkeyhint: i < c.units.length - 1 ? "next" : "done",
            "aria-label": c.labels[unit],
            "aria-valuemin": 0,
            "aria-valuemax": top,
            "aria-valuenow": value,
            "aria-valuetext": spokenUnit(value, unit, c.locale),
            "aria-disabled": c.disabled ? "true" : undefined,
            "aria-invalid": c.invalid ? "true" : undefined,
          },
          shown,
        ),
        h("span", { key: `${unit}-suffix`, class: "z-duration-field__suffix", "aria-hidden": "true" }, c.labels[`${unit}Short`]),
      ];
    });
    return h(
      "div",
      { class: "z-duration-field", "data-size": c.size, "data-disabled": on(c.disabled) },
      h(
        "div",
        {
          class: "z-input z-duration-field__control",
          role: "group",
          "aria-label": c.label,
          "data-size": c.size,
          "data-invalid": on(c.invalid),
          "aria-disabled": c.disabled ? "true" : undefined,
        },
        h("span", { class: "z-duration-field__input", dir: "ltr" }, ...segments),
        h("input", {
          type: "text",
          class: "z-native-input",
          "aria-hidden": "true",
          tabindex: -1,
          name: c.name,
          form: c.form,
          value: iso,
          required: on(c.required),
          disabled: on(c.disabled),
        }),
      ),
      c.presets.length
        ? h(
            "div",
            { class: "z-duration-field__presets", role: "group", "aria-label": c.labels.presets, id: `${uid}-presets` },
            ...c.presets.map((ms) =>
              h(
                "button",
                {
                  type: "button",
                  key: String(ms),
                  class: "z-btn z-btn--secondary z-duration-field__preset",
                  "data-size": "sm",
                  "data-ms": ms,
                  "aria-pressed": ms === s.ms ? "true" : "false",
                  disabled: on(c.disabled),
                },
                formatDuration(ms, { style: "short", locale: c.locale }),
              ),
            ),
          )
        : null,
    );
  },
  attach,
  after(root, host, focus) {
    // El campo oculto no se repinta como atributo (es un campo): su valor se escribe aquí.
    const input = root.querySelector<HTMLInputElement>(".z-duration-field__control > input.z-native-input");
    const iso = toISODuration(host.state().ms);
    if (input && input.value !== iso) input.value = iso;
    if (!focus) return;
    const seg = root.querySelector<HTMLElement>(`.z-duration-field__segment[data-index="${host.state().active}"]`);
    if (seg && seg !== root.ownerDocument.activeElement) seg.focus({ preventScroll: true });
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      defaultValue: d.value,
      units: d.units ? (list(d.units) as DurationFieldUnit[]) : undefined,
      max: d.max,
      step: num(d.step, 1),
      presets: d.presets ? list(d.presets) : (json.presets as string[] | undefined),
      name: d.name,
      form: d.form,
      disabled: yes(d.disabled),
      required: yes(d.required),
      invalid: yes(d.invalid),
      size: d.size === "sm" || d.size === "lg" ? d.size : undefined,
      label: d.label,
      locale: d.locale,
      labels: json.labels as Partial<DurationFieldLabels> | undefined,
    };
  },
};
