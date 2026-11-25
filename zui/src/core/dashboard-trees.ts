// Piezas de métricas sin estado como árboles (core/vnode): DeltaBadge, ProgressGoal, BarList y FunnelChart. El binding
// de React pinta el árbol tal cual (sirve en un Server Component) y el modo DOM lo vuelve a pintar desde los
// atributos `data-*` de la raíz, que el propio árbol escribe: el HTML del servidor o del contrato basta.

import { funnelStages, type FunnelStageInput } from "./funnel";
import {
  barFractions,
  computeDelta,
  computePace,
  deltaFromRelative,
  deltaMagnitude,
  deltaSpoken,
  formatValue,
  numberFormat,
  type Delta,
  type DeltaLabels,
  type DeltaPositive,
  type PaceStatus,
} from "./metric";
import { fill, h, icon, type VEl, type VNode } from "./vnode";
import { num, type Widget } from "./widget";

const percent = (locale: string | undefined, v: number, digits = 0) =>
  numberFormat(locale, { style: "percent", maximumFractionDigits: digits }).format(v);
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const json = (v: unknown) => (v === undefined ? undefined : JSON.stringify(v));
function parse<T>(text: string | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/* ---------- DeltaBadge ---------- */

export interface DeltaBadgeProps {
  /** Valor actual (con `previous`). */
  value?: number;
  /** Valor del periodo anterior. */
  previous?: number;
  /** Variación ya calculada, como fracción (0.124 = 12,4 %). Gana sobre `value` y `previous`. */
  delta?: number;
  /** Lo que es bueno: que suba (por defecto) o que baje. */
  positive?: DeltaPositive;
  /** Periodo de comparación en la frase hablada («last month»). */
  period?: string;
  /** Formato de la diferencia absoluta cuando no hay relativa (anterior 0). */
  absFormat?: Intl.NumberFormatOptions;
  size?: "sm" | "md";
  /** `soft` con fondo (por defecto) o `plain` solo texto. */
  variant?: "soft" | "plain";
  locale?: string;
  labels?: Partial<DeltaLabels>;
}

/** Variación de las props de DeltaBadge, o `null` si no hay con qué calcularla. */
export function deltaOf(p: Pick<DeltaBadgeProps, "value" | "previous" | "delta" | "positive">): Delta | null {
  if (typeof p.delta === "number" && Number.isFinite(p.delta)) return deltaFromRelative(p.delta, p.positive);
  if (typeof p.value === "number" && typeof p.previous === "number") return computeDelta(p.value, p.previous, p.positive);
  return null;
}

const ARROW = { up: "arrow-trending-up-right", down: "arrow-trending-down-right", flat: "minus" } as const;

export function deltaTree(p: DeltaBadgeProps): VEl {
  const d = deltaOf(p) ?? { abs: 0, rel: null, direction: "flat" as const, sentiment: "neutral" as const };
  const magnitude = deltaMagnitude(d, p.locale, p.absFormat);
  const spoken = deltaSpoken(d, magnitude, p.period, p.labels);
  return h(
    "span",
    {
      class: "z-delta",
      "data-direction": d.direction,
      "data-sentiment": d.sentiment,
      "data-size": p.size === "sm" ? "sm" : undefined,
      "data-variant": p.variant === "plain" ? "plain" : undefined,
      "data-value": p.value,
      "data-previous": p.previous,
      "data-delta": p.delta,
      "data-positive": p.positive === "down" ? "down" : undefined,
      "data-period": p.period,
      "data-locale": p.locale,
    },
    h("span", { class: "z-delta__arrow", "aria-hidden": "true" }, icon(ARROW[d.direction], p.size === "sm" ? 12 : 14)),
    h("span", { class: "z-delta__value", "aria-hidden": "true" }, d.direction === "flat" ? "0%" : magnitude),
    h("span", { class: "z-sr-only" }, spoken),
  );
}

export const deltaWidget: Widget<DeltaBadgeProps, DeltaBadgeProps, null> = {
  root: "z-delta",
  configure: (p) => p,
  initial: () => null,
  tree: (p) => deltaTree(p),
  attach: () => () => {},
  after: () => {},
  fromDom(el, j) {
    const d = el.dataset;
    const n = (v: string | undefined) => (v === undefined || v === "" ? undefined : Number(v));
    return {
      value: n(d.value),
      previous: n(d.previous),
      delta: n(d.delta),
      positive: d.positive === "down" ? "down" : "up",
      period: d.period,
      size: d.size === "sm" ? "sm" : undefined,
      variant: d.variant === "plain" ? "plain" : undefined,
      locale: d.locale,
      labels: j.labels as Partial<DeltaLabels> | undefined,
    };
  },
};

/* ---------- ProgressGoal ---------- */

export interface ProgressGoalLabels {
  /** «{value} of {target}» */
  ofTarget: string;
  /** «{percent} of goal, {status}» (nombre accesible del valor). */
  valueText: string;
  /** Texto del ritmo: «{ratio} of expected pace». */
  pace: string;
  ahead: string;
  onTrack: string;
  behind: string;
  done: string;
  /** Nombre de la marca del ritmo esperado. */
  expected: string;
}

export const PROGRESS_GOAL_LABELS: ProgressGoalLabels = {
  ofTarget: "{value} of {target}",
  valueText: "{percent} of goal, {status}",
  pace: "{ratio} of expected pace",
  ahead: "Ahead of pace",
  onTrack: "On track",
  behind: "Behind pace",
  done: "Goal reached",
  expected: "Expected today",
};

export interface ProgressGoalProps {
  label: string;
  value: number;
  target: number;
  /** Valor de partida (por defecto 0). */
  start?: number;
  /** Fracción del periodo transcurrida (0…1): marca el ritmo esperado y calcula si vas por delante o por detrás. */
  elapsed?: number;
  valueFormat?: Intl.NumberFormatOptions;
  size?: "sm" | "md";
  locale?: string;
  labels?: Partial<ProgressGoalLabels>;
}

const STATUS_KEY: Record<PaceStatus, keyof ProgressGoalLabels> = { ahead: "ahead", "on-track": "onTrack", behind: "behind", done: "done" };
const STATUS_TONE: Record<PaceStatus, string> = { ahead: "success", "on-track": "accent", behind: "warning", done: "success" };

export function progressGoalTree(p: ProgressGoalProps): VEl {
  const l = { ...PROGRESS_GOAL_LABELS, ...p.labels };
  const pace = computePace(p.value, p.target, p.elapsed, p.start ?? 0);
  const status = l[STATUS_KEY[pace.status]];
  const f = (v: number) => formatValue(v, p.locale, p.valueFormat);
  const pct = percent(p.locale, pace.progress);
  return h(
    "div",
    {
      class: "z-progress-goal",
      "data-status": pace.status,
      "data-tone": STATUS_TONE[pace.status],
      "data-size": p.size === "sm" ? "sm" : undefined,
      "data-label": p.label,
      "data-value": p.value,
      "data-target": p.target,
      "data-start": p.start,
      "data-elapsed": p.elapsed,
      "data-locale": p.locale,
      "data-value-format": json(p.valueFormat),
    },
    h(
      "div",
      { class: "z-progress-goal__head" },
      h("span", { class: "z-progress-goal__label" }, p.label),
      h("span", { class: "z-progress-goal__amount" }, fill(l.ofTarget, { value: f(p.value), target: f(p.target) })),
    ),
    h(
      "div",
      {
        class: "z-progress-goal__track",
        role: "meter",
        "aria-label": p.label,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": Math.round(pace.progress * 100),
        "aria-valuetext": fill(l.valueText, { percent: pct, status }),
        s: { "--z-goal": r3(pace.progress), ...(pace.expected !== null ? { "--z-goal-expected": r3(pace.expected) } : {}) },
      },
      h("span", { class: "z-progress-goal__fill" }),
      pace.expected !== null && pace.status !== "done"
        ? h("span", { class: "z-progress-goal__expected", title: l.expected, "aria-hidden": "true" })
        : null,
    ),
    h(
      "div",
      { class: "z-progress-goal__foot", "aria-hidden": "true" },
      h("span", { class: "z-progress-goal__status" }, icon(pace.status === "behind" ? "exclamation-triangle" : "check-circle", 14), status),
      pace.ratio !== null && pace.status !== "done"
        ? h("span", { class: "z-progress-goal__pace" }, fill(l.pace, { ratio: percent(p.locale, pace.ratio) }))
        : h("span", { class: "z-progress-goal__pace" }, pct),
    ),
  );
}

export const progressGoalWidget: Widget<ProgressGoalProps, ProgressGoalProps, null> = {
  root: "z-progress-goal",
  configure: (p) => p,
  initial: () => null,
  tree: (p) => progressGoalTree(p),
  attach: () => () => {},
  after: () => {},
  fromDom(el, j) {
    const d = el.dataset;
    return {
      label: d.label ?? "",
      value: num(d.value, 0),
      target: num(d.target, 100),
      start: d.start !== undefined ? num(d.start, 0) : undefined,
      elapsed: d.elapsed !== undefined ? num(d.elapsed, 0) : undefined,
      size: d.size === "sm" ? "sm" : undefined,
      valueFormat: (j.valueFormat as Intl.NumberFormatOptions | undefined) ?? parse(d.valueFormat, undefined),
      locale: d.locale,
      labels: j.labels as Partial<ProgressGoalLabels> | undefined,
    };
  },
};

/* ---------- BarList ---------- */

export interface BarListItem {
  label: string;
  value: number;
  /** Enlace de la fila. */
  href?: string;
  /** Icono a la izquierda de la etiqueta. */
  icon?: string;
  /** Texto a la derecha que sustituye al valor formateado. */
  display?: string;
}

export interface BarListProps {
  items: readonly BarListItem[];
  /** Nombre de la lista. */
  label: string;
  /** Escala de las barras; por defecto, el mayor valor. */
  max?: number;
  /** Orden: el dado (por defecto) o de mayor a menor. */
  sort?: "none" | "desc";
  /** Color de serie 1–8. */
  color?: number;
  valueFormat?: Intl.NumberFormatOptions;
  locale?: string;
}

export function barListTree(p: BarListProps): VEl {
  const items = p.sort === "desc" ? [...p.items].sort((a, b) => b.value - a.value) : [...p.items];
  const fr = barFractions(
    items.map((i) => i.value),
    p.max,
  );
  const color = Math.min(8, Math.max(1, Math.round(p.color ?? 1)));
  return h(
    "ul",
    {
      class: "z-bar-list",
      "aria-label": p.label,
      "data-color": color,
      "data-items": json(p.items),
      "data-label": p.label,
      "data-max": p.max,
      "data-sort": p.sort === "desc" ? "desc" : undefined,
      "data-locale": p.locale,
      "data-value-format": json(p.valueFormat),
    },
    ...items.map((item, i) => {
      const name: VNode[] = [
        item.icon ? h("span", { class: "z-bar-list__icon" }, icon(item.icon, 14)) : null,
        h("span", { class: "z-bar-list__text" }, item.label),
      ];
      return h(
        "li",
        { class: "z-bar-list__row", key: `${i}-${item.label}`, s: { "--z-bar": r3(fr[i] ?? 0) } },
        h("span", { class: "z-bar-list__bar", "aria-hidden": "true" }),
        item.href ? h("a", { class: "z-bar-list__label", href: item.href }, ...name) : h("span", { class: "z-bar-list__label" }, ...name),
        h("span", { class: "z-bar-list__value" }, item.display ?? formatValue(item.value, p.locale, p.valueFormat)),
      );
    }),
  );
}

export const barListWidget: Widget<BarListProps, BarListProps, null> = {
  root: "z-bar-list",
  configure: (p) => p,
  initial: () => null,
  tree: (p) => barListTree(p),
  attach: () => () => {},
  after: () => {},
  fromDom(el, j) {
    const d = el.dataset;
    return {
      items: (Array.isArray(j.items) ? j.items : parse<BarListItem[]>(d.items, [])) as BarListItem[],
      label: d.label ?? el.getAttribute("aria-label") ?? "",
      max: d.max !== undefined ? num(d.max, 0) : undefined,
      sort: d.sort === "desc" ? "desc" : undefined,
      color: d.color !== undefined ? num(d.color, 1) : undefined,
      valueFormat: (j.valueFormat as Intl.NumberFormatOptions | undefined) ?? parse(d.valueFormat, undefined),
      locale: d.locale,
    };
  },
};

/* ---------- FunnelChart ---------- */

export interface FunnelLabels {
  /** «{percent} of previous» */
  ofPrevious: string;
  /** «{percent} of total» */
  ofFirst: string;
  /** «{value} dropped» */
  dropped: string;
  /** Resumen: «{conversion} overall conversion». */
  summary: string;
}

export const FUNNEL_LABELS: FunnelLabels = {
  ofPrevious: "{percent} of previous",
  ofFirst: "{percent} of total",
  dropped: "{value} dropped",
  summary: "{conversion} overall conversion",
};

export interface FunnelChartProps {
  stages: readonly FunnelStageInput[];
  title: string;
  /** Descripción bajo el título. */
  description?: string;
  color?: number;
  valueFormat?: Intl.NumberFormatOptions;
  locale?: string;
  labels?: Partial<FunnelLabels>;
}

export function funnelTree(p: FunnelChartProps): VEl {
  const l = { ...FUNNEL_LABELS, ...p.labels };
  const stages = funnelStages(p.stages);
  const f = (v: number) => formatValue(v, p.locale, p.valueFormat);
  const conversion = stages.length ? stages[stages.length - 1]!.ofFirst : 0;
  const color = Math.min(8, Math.max(1, Math.round(p.color ?? 1)));
  return h(
    "figure",
    {
      class: "z-funnel",
      "data-color": color,
      "data-stages": json(p.stages),
      "data-title": p.title,
      "data-description": p.description,
      "data-locale": p.locale,
      "data-value-format": json(p.valueFormat),
    },
    h(
      "figcaption",
      { class: "z-funnel__caption" },
      h("span", { class: "z-funnel__title" }, p.title),
      h("span", { class: "z-funnel__summary" }, fill(l.summary, { conversion: percent(p.locale, conversion, 1) })),
      p.description ? h("span", { class: "z-funnel__description" }, p.description) : null,
    ),
    h(
      "ol",
      { class: "z-funnel__stages" },
      ...stages.map((s) =>
        h(
          "li",
          {
            class: "z-funnel__stage",
            key: `${s.index}-${s.label}`,
            s: { "--z-funnel": r3(s.ofFirst), "--z-funnel-prev": r3(s.index ? (stages[s.index - 1]?.ofFirst ?? 1) : s.ofFirst) },
          },
          h("span", { class: "z-funnel__name" }, s.label),
          h("span", { class: "z-funnel__value" }, f(s.value)),
          h(
            "span",
            { class: "z-funnel__track", "aria-hidden": "true" },
            h("span", { class: "z-funnel__drop" }),
            h("span", { class: "z-funnel__bar" }),
          ),
          h(
            "span",
            { class: "z-funnel__rate" },
            s.index === 0
              ? fill(l.ofFirst, { percent: percent(p.locale, 1) })
              : fill(l.ofPrevious, { percent: percent(p.locale, s.ofPrevious, 1) }),
          ),
          s.index > 0 && s.dropped > 0 ? h("span", { class: "z-sr-only" }, `, ${fill(l.dropped, { value: f(s.dropped) })}`) : null,
        ),
      ),
    ),
  );
}

export const funnelWidget: Widget<FunnelChartProps, FunnelChartProps, null> = {
  root: "z-funnel",
  configure: (p) => p,
  initial: () => null,
  tree: (p) => funnelTree(p),
  attach: () => () => {},
  after: () => {},
  fromDom(el, j) {
    const d = el.dataset;
    return {
      stages: (Array.isArray(j.stages) ? j.stages : parse<FunnelStageInput[]>(d.stages, [])) as FunnelStageInput[],
      title: d.title ?? "",
      description: d.description,
      color: d.color !== undefined ? num(d.color, 1) : undefined,
      valueFormat: (j.valueFormat as Intl.NumberFormatOptions | undefined) ?? parse(d.valueFormat, undefined),
      locale: d.locale,
      labels: j.labels as Partial<FunnelLabels> | undefined,
    };
  },
};
