// CircularSlider: deslizador en un anillo (círculo completo o arco abierto) con el valor en el centro. Patrón APG
// «slider» sobre el tirador (flechas, Re/Av Pág, Inicio, Fin, Mayúsculas); el puntero arrastra por el anillo. Un solo
// árbol (core/vnode) y una sola interacción para React y el modo DOM (core/widget).

import { angleOf, arcPath, pointAt, ringGeometry, valueAtPoint } from "./circular";
import { keyValue, snap } from "./slider";
import { fill, h, on, type VEl } from "./vnode";
import { num, yes, type Widget, type WidgetHost } from "./widget";

export interface CircularSliderProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Grados del recorrido (30–360). Por defecto el círculo completo. */
  arc?: number;
  /** Ángulo del valor mínimo (0 arriba, en el sentido de las agujas). Por defecto, un arco abierto deja el hueco abajo. */
  startAngle?: number;
  /** Lado en píxeles (por defecto 160). */
  size?: number;
  /** Grosor de la pista en píxeles (por defecto 8). */
  thickness?: number;
  /** Marcas: `true` una por paso (hasta 60) o una lista de valores. Decorativas. */
  marks?: boolean | readonly number[];
  /** Valor en el centro. */
  showValue?: boolean;
  /** Formato del valor (Intl.NumberFormat). */
  valueFormat?: Intl.NumberFormatOptions;
  locale?: string;
  /** Texto bajo el valor (unidad o nombre corto). */
  caption?: string;
  /** Nombre accesible del tirador. */
  label?: string;
  disabled?: boolean;
  name?: string;
  form?: string;
}

interface Config {
  min: number;
  max: number;
  step: number;
  arc: number;
  start: number;
  size: number;
  thickness: number;
  marks: number[];
  showValue: boolean;
  format: Intl.NumberFormat;
  caption?: string;
  label: string;
  disabled: boolean;
  name?: string;
  form?: string;
  value?: number;
  defaultValue: number;
  raw: CircularSliderProps;
}

interface State {
  value: number;
  prop: number | undefined;
}

const formats = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: string | undefined, options: Intl.NumberFormatOptions | undefined): Intl.NumberFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options ?? {})}`;
  let f = formats.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat(undefined, options);
    }
    formats.set(key, f);
  }
  return f;
}

function configure(p: CircularSliderProps): Config {
  const min = Number.isFinite(p.min) ? p.min! : 0;
  const max = Math.max(min, Number.isFinite(p.max) ? p.max! : 100);
  const step = Number.isFinite(p.step) && p.step! > 0 ? p.step! : 1;
  const { arc, start } = ringGeometry(p.arc, p.startAngle);
  const steps = Math.round((max - min) / step);
  const marks =
    p.marks === true
      ? steps <= 60
        ? Array.from({ length: steps + 1 }, (_, i) => min + i * step)
        : []
      : Array.isArray(p.marks)
        ? p.marks.filter((m) => Number.isFinite(m) && m >= min && m <= max)
        : [];
  return {
    min,
    max,
    step,
    arc,
    start,
    size: Number.isFinite(p.size) && p.size! > 0 ? p.size! : 160,
    thickness: Number.isFinite(p.thickness) && p.thickness! > 0 ? p.thickness! : 8,
    // En un círculo completo el último valor coincide con el primero: su marca no se repite.
    marks: arc >= 360 ? marks.filter((m) => m !== max || min === max) : marks,
    showValue: p.showValue !== false,
    format: numberFormat(p.locale, p.valueFormat),
    caption: p.caption,
    label: p.label ?? "Value",
    disabled: Boolean(p.disabled),
    name: p.name,
    form: p.form,
    value: Number.isFinite(p.value) ? snap(p.value!, min, max, step) : undefined,
    defaultValue: snap(Number.isFinite(p.defaultValue) ? p.defaultValue! : min, min, max, step),
    raw: p,
  };
}

function tree(c: Config, s: State): VEl {
  // Lienzo de 100 × 100: el grosor y el margen del tirador se pasan a esas unidades.
  const unit = 100 / c.size;
  const stroke = c.thickness * unit;
  const radius = 50 - Math.max(stroke / 2, 12 * unit) - 1;
  const angle = angleOf(s.value, c.min, c.max, c.arc, c.start);
  const t = c.max === c.min ? 0 : (s.value - c.min) / (c.max - c.min);
  const thumb = pointAt(angle, radius);
  const text = c.format.format(s.value);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return h(
    "div",
    {
      class: "z-circular",
      "data-disabled": on(c.disabled),
      "data-min": c.min,
      "data-max": c.max,
      "data-step": c.step,
      "data-arc": c.arc,
      "data-start": c.start,
      "data-size": c.size,
      "data-thickness": c.thickness,
      "data-value": s.value,
      "data-show-value": c.showValue ? undefined : "false",
      "data-caption": c.caption,
      "data-label": c.label === "Value" ? undefined : c.label,
      "data-name": c.name,
      "data-locale": c.raw.locale,
      "data-value-format": c.raw.valueFormat ? JSON.stringify(c.raw.valueFormat) : undefined,
      "data-marks": c.marks.length ? c.marks.join(",") : undefined,
      s: {
        "--z-circular-size": `${c.size}px`,
        "--z-circular-x": `${thumb.x}%`,
        "--z-circular-y": `${thumb.y}%`,
      },
    },
    h(
      "svg",
      { class: "z-circular__svg", viewBox: "0 0 100 100", "aria-hidden": "true", focusable: "false" },
      h("path", { class: "z-circular__track", d: arcPath(c.start, c.arc, radius), "stroke-width": r(stroke) }),
      t > 0
        ? h("path", { class: "z-circular__range", d: arcPath(c.start, Math.min(c.arc, t * c.arc), radius), "stroke-width": r(stroke) })
        : null,
      ...c.marks.map((m) => {
        const a = angleOf(m, c.min, c.max, c.arc, c.start);
        const p1 = pointAt(a, radius + stroke / 2 + 1.5);
        const p2 = pointAt(a, radius + stroke / 2 + 4);
        return h("line", {
          key: `m${m}`,
          class: "z-circular__mark",
          "data-in-range": on(m <= s.value),
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
        });
      }),
    ),
    c.showValue
      ? h(
          "span",
          { class: "z-circular__center", "aria-hidden": "true" },
          h("span", { class: "z-circular__value" }, text),
          c.caption ? h("span", { class: "z-circular__caption" }, c.caption) : null,
        )
      : null,
    h("span", {
      class: "z-circular__thumb",
      role: "slider",
      tabindex: c.disabled ? -1 : 0,
      "aria-label": c.label,
      "aria-valuemin": c.min,
      "aria-valuemax": c.max,
      "aria-valuenow": s.value,
      "aria-valuetext": c.caption ? fill("{v} {c}", { v: text, c: c.caption }) : text,
      "aria-disabled": c.disabled ? "true" : undefined,
    }),
    c.name ? h("input", { type: "hidden", name: c.name, form: c.form, value: s.value, disabled: c.disabled || undefined }) : null,
  );
}

type Host = WidgetHost<Config, State>;

function set(host: Host, value: number, end: boolean): void {
  const s = host.state();
  if (value !== s.value) {
    host.update({ value });
    host.emit("change", { value });
  }
  if (end) host.emit("change-end", { value: host.state().value });
}

function attach(root: HTMLElement, host: Host): () => void {
  let drag: number | null = null;
  let moved = false;
  const at = (event: PointerEvent) => {
    const c = host.config();
    const rect = root.getBoundingClientRect();
    return valueAtPoint(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
      c.min,
      c.max,
      c.step,
      c.arc,
      c.start,
    );
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || host.config().disabled) return;
    event.preventDefault();
    drag = event.pointerId;
    moved = false;
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // Puntero sintético.
    }
    root.querySelector<HTMLElement>(".z-circular__thumb")?.focus({ preventScroll: true });
    const v = at(event);
    if (v !== host.state().value) moved = true;
    set(host, v, false);
  };
  const moveTo = (event: PointerEvent) => {
    if (drag !== event.pointerId) return;
    const v = at(event);
    if (v !== host.state().value) moved = true;
    set(host, v, false);
  };
  const up = (event: PointerEvent) => {
    if (drag !== event.pointerId) return;
    drag = null;
    if (moved) host.emit("change-end", { value: host.state().value });
  };
  const key = (event: KeyboardEvent) => {
    const c = host.config();
    if (c.disabled || !(event.target instanceof HTMLElement) || !event.target.classList.contains("z-circular__thumb")) return;
    const wanted = keyValue(event.key, event.shiftKey, host.state().value, c.min, c.max, c.step);
    if (wanted === undefined) return;
    event.preventDefault();
    set(host, snap(wanted, c.min, c.max, c.step), true);
  };
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", moveTo);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  root.addEventListener("keydown", key);
  return () => {
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointermove", moveTo);
    root.removeEventListener("pointerup", up);
    root.removeEventListener("pointercancel", up);
    root.removeEventListener("keydown", key);
  };
}

const parseJson = (text: string | undefined): Intl.NumberFormatOptions | undefined => {
  if (!text) return undefined;
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" ? (v as Intl.NumberFormatOptions) : undefined;
  } catch {
    return undefined;
  }
};

export const circularSliderWidget: Widget<CircularSliderProps, Config, State> = {
  root: "z-circular",
  configure,
  initial: (c) => ({ value: c.value ?? c.defaultValue, prop: c.value }),
  control: (c, s) => (c.value !== undefined && c.value !== s.prop ? { value: c.value, prop: c.value } : s),
  tree,
  attach,
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    const marks = d.marks === "" || d.marks === "true" ? true : d.marks ? d.marks.split(",").map(Number) : undefined;
    return {
      defaultValue: num(d.value, 0),
      min: num(d.min, 0),
      max: num(d.max, 100),
      step: num(d.step, 1),
      arc: d.arc ? Number(d.arc) : undefined,
      startAngle: d.start ? Number(d.start) : undefined,
      size: d.size ? Number(d.size) : undefined,
      thickness: d.thickness ? Number(d.thickness) : undefined,
      marks,
      showValue: d.showValue === undefined ? undefined : yes(d.showValue),
      valueFormat: (json.valueFormat as Intl.NumberFormatOptions | undefined) ?? parseJson(d.valueFormat),
      locale: d.locale,
      caption: d.caption,
      label: d.label ?? el.getAttribute("aria-label") ?? undefined,
      disabled: d.disabled !== undefined,
      name: d.name,
      form: d.form,
    };
  },
};
