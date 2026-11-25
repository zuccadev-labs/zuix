// Tracker: tira de estados por día (disponibilidad de un servicio, ejecuciones de un trabajo). Lógica del resumen y
// del foco itinerante entre barras, más la pieza (core/widget) que comparten React y el modo DOM: una lista con una
// sola parada de tabulación, flechas, Inicio y Fin entre días, y una etiqueta flotante con el día activo (al pasar el
// puntero o con el foco). Cada día se lee como texto («3 Nov: Degraded, 12 min»), no por su color.

import { numberFormat } from "./metric";
import { fill, h, type VEl } from "./vnode";
import type { Widget, WidgetHost } from "./widget";

export type TrackerStatus = "ok" | "warning" | "error" | "maintenance" | "empty";

export interface TrackerDay {
  status: TrackerStatus;
  /** Día o periodo («3 Nov»). */
  label: string;
  /** Detalle tras el estado («12 min»). */
  note?: string;
}

export interface TrackerLabels {
  ok: string;
  warning: string;
  error: string;
  maintenance: string;
  empty: string;
  /** «{percent} uptime» */
  summary: string;
  /** «{label}: {status}» y, con nota, «{label}: {status}, {note}». */
  day: string;
}

export const TRACKER_LABELS: TrackerLabels = {
  ok: "Operational",
  warning: "Degraded",
  error: "Outage",
  maintenance: "Maintenance",
  empty: "No data",
  summary: "{percent} uptime",
  day: "{label}: {status}",
};

const STATUSES: readonly TrackerStatus[] = ["ok", "warning", "error", "maintenance", "empty"];
export const trackerStatus = (v: unknown): TrackerStatus => (STATUSES.includes(v as TrackerStatus) ? (v as TrackerStatus) : "empty");

export interface TrackerSummary {
  counts: Record<TrackerStatus, number>;
  /** Fracción de días sin incidencia sobre los días con dato (0…1), o `null` sin datos. Mantenimiento cuenta como bueno. */
  uptime: number | null;
}

export function trackerSummary(days: readonly TrackerDay[]): TrackerSummary {
  const counts: Record<TrackerStatus, number> = { ok: 0, warning: 0, error: 0, maintenance: 0, empty: 0 };
  for (const d of days) counts[trackerStatus(d.status)]++;
  const known = days.length - counts.empty;
  // Un día degradado cuenta a medias: el servicio respondía, pero no del todo.
  const good = counts.ok + counts.maintenance + counts.warning * 0.5;
  return { counts, uptime: known > 0 ? good / known : null };
}

/** Índice tras una tecla en una tira de `n` barras, o `null` si la tecla no mueve. En RTL las flechas se invierten. */
export function trackerKey(key: string, index: number, n: number, rtl = false): number | null {
  if (n <= 0) return null;
  const forward = rtl ? "ArrowLeft" : "ArrowRight";
  const back = rtl ? "ArrowRight" : "ArrowLeft";
  if (key === forward) return Math.min(n - 1, index + 1);
  if (key === back) return Math.max(0, index - 1);
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  if (key === "PageUp") return Math.max(0, index - 7);
  if (key === "PageDown") return Math.min(n - 1, index + 7);
  return null;
}

export interface TrackerProps {
  days: readonly TrackerDay[];
  /** Nombre del servicio o de lo que se sigue. */
  label: string;
  /** Texto a la derecha de la cabecera; por defecto, la disponibilidad calculada. */
  summary?: string;
  /** Oculta la cabecera (nombre y resumen). */
  hideHeader?: boolean;
  size?: "sm" | "md";
  locale?: string;
  labels?: Partial<TrackerLabels>;
}

interface Config {
  days: TrackerDay[];
  label: string;
  summary?: string;
  hideHeader: boolean;
  size: "sm" | "md";
  locale?: string;
  labels: TrackerLabels;
}
interface State {
  /** Día con la parada de tabulación. */
  active: number;
  /** Día con la etiqueta flotante (puntero o foco), o -1. */
  shown: number;
}
type Host = WidgetHost<Config, State>;

export function trackerDayText(day: TrackerDay, labels: TrackerLabels): string {
  const base = fill(labels.day, { label: day.label, status: labels[trackerStatus(day.status)] });
  return day.note ? `${base}, ${day.note}` : base;
}

export const trackerWidget: Widget<TrackerProps, Config, State> = {
  root: "z-tracker",
  configure: (p) => ({
    days: (p.days ?? []).map((d) => ({ ...d, status: trackerStatus(d.status) })),
    label: p.label ?? "",
    summary: p.summary,
    hideHeader: Boolean(p.hideHeader),
    size: p.size === "sm" ? "sm" : "md",
    locale: p.locale,
    labels: { ...TRACKER_LABELS, ...p.labels },
  }),
  initial: (c) => ({ active: Math.max(0, c.days.length - 1), shown: -1 }),
  control: (c, s) => (s.active >= c.days.length ? { ...s, active: Math.max(0, c.days.length - 1), shown: -1 } : s),
  tree(c, s, uid): VEl {
    const n = c.days.length;
    const { uptime } = trackerSummary(c.days);
    const summary =
      c.summary ??
      (uptime === null
        ? ""
        : fill(c.labels.summary, { percent: numberFormat(c.locale, { style: "percent", maximumFractionDigits: 1 }).format(uptime) }));
    const shown = s.shown >= 0 && s.shown < n ? c.days[s.shown]! : null;
    return h(
      "div",
      { class: "z-tracker", "data-size": c.size, s: { "--z-tracker-n": Math.max(1, n) } },
      c.hideHeader
        ? null
        : h(
            "div",
            { class: "z-tracker__head" },
            h("span", { class: "z-tracker__label", id: `${uid}-label` }, c.label),
            summary ? h("span", { class: "z-tracker__summary" }, summary) : null,
          ),
      h(
        "ol",
        {
          class: "z-tracker__bars",
          "aria-labelledby": c.hideHeader ? undefined : `${uid}-label`,
          "aria-label": c.hideHeader ? c.label : undefined,
        },
        ...c.days.map((d, i) =>
          h(
            "li",
            {
              key: String(i),
              class: "z-tracker__bar",
              "data-status": d.status,
              "data-index": i,
              "data-shown": i === s.shown ? "" : undefined,
              tabindex: i === s.active ? 0 : -1,
            },
            h("span", { class: "z-sr-only" }, trackerDayText(d, c.labels)),
          ),
        ),
      ),
      shown
        ? h(
            "div",
            { class: "z-tracker__tip", "aria-hidden": "true", "data-status": shown.status, s: { "--z-tracker-i": s.shown } },
            h("span", { class: "z-tracker__tip-dot" }),
            h("span", { class: "z-tracker__tip-text" }, trackerDayText(shown, c.labels)),
          )
        : null,
    );
  },
  attach(root, host: Host) {
    const index = (t: EventTarget | null) => {
      const bar = (t as HTMLElement | null)?.closest?.<HTMLElement>(".z-tracker__bar");
      return bar && root.contains(bar) ? Number(bar.dataset.index) : -1;
    };
    const onKey = (e: KeyboardEvent) => {
      const i = index(e.target);
      if (i < 0) return;
      if (e.key === "Escape" && host.state().shown >= 0) {
        host.update({ shown: -1 });
        return;
      }
      const rtl = getComputedStyle(root).direction === "rtl";
      const next = trackerKey(e.key, i, host.config().days.length, rtl);
      if (next === null) return;
      e.preventDefault();
      host.update({ active: next, shown: next }, true);
    };
    const onFocus = (e: FocusEvent) => {
      const i = index(e.target);
      if (i >= 0 && host.state().shown !== i) host.update({ active: i, shown: i });
    };
    const onBlur = (e: FocusEvent) => {
      if (!root.contains(e.relatedTarget as Node | null)) host.update({ shown: -1 });
    };
    const onMove = (e: PointerEvent) => {
      const i = index(e.target);
      if (i >= 0 && i !== host.state().shown) host.update({ shown: i });
    };
    const onLeave = () => {
      if (!root.contains(root.ownerDocument.activeElement)) host.update({ shown: -1 });
    };
    root.addEventListener("keydown", onKey);
    root.addEventListener("focusin", onFocus);
    root.addEventListener("focusout", onBlur);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("focusin", onFocus);
      root.removeEventListener("focusout", onBlur);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  },
  after(root, _host, focus) {
    if (focus) root.querySelector<HTMLElement>('.z-tracker__bar[tabindex="0"]')?.focus({ preventScroll: true });
  },
  fromDom(el, json) {
    const d = el.dataset;
    let days: TrackerDay[] = Array.isArray(json.days) ? (json.days as TrackerDay[]) : [];
    if (!days.length && d.days) {
      // `data-days="ok warning ok error"` con `data-start` opcional para las etiquetas, o JSON.
      try {
        const parsed = JSON.parse(d.days) as unknown;
        if (Array.isArray(parsed)) days = parsed as TrackerDay[];
      } catch {
        days = d.days
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((status, i) => ({ status: trackerStatus(status), label: `${i + 1}` }));
      }
    }
    return {
      days,
      label: d.label ?? "",
      summary: d.summary,
      hideHeader: d.hideHeader !== undefined && d.hideHeader !== "false",
      size: d.size === "sm" ? "sm" : undefined,
      locale: d.locale,
      labels: { ...(json.labels as Partial<TrackerLabels> | undefined) },
    };
  },
};
