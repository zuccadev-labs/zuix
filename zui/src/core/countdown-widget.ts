// Countdown hasta un instante como pieza (core/widget). Las unidades van en un `role="timer"` con nombre (sin región
// viva: se lee al llegar a él); los hitos y el final se anuncian en una región `status` aparte, con el criterio de
// core/countdown, nunca cada segundo. El paso del tiempo va por el temporizador compartido (core/ticker), y el final
// tiene su propio aviso exacto para que llegue aunque la pieza esté fuera de pantalla.

import { countdownMilestone, countdownSpoken, countdownTarget, countdownUnits, unitDigits, until, type CountdownUnit } from "./countdown";
import { clockDate, zonedISO } from "./clock";
import { subscribeTick } from "./ticker";
import { pauseOffscreen } from "./visibility";
import { fill, h, type VNode } from "./vnode";
import { announceIn, list, num, type Widget, type WidgetHost } from "./widget";
import { safeTimeZone } from "./zone";

export interface CountdownLabels {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  /** Nombre del temporizador. */
  timer: string;
  /** Lo que se ve y se anuncia al llegar. */
  complete: string;
  /** «{time} left» en los anuncios de hitos. */
  left: string;
  /** «Ends {date}» bajo las cifras (con `showTarget`). */
  target: string;
}

export const COUNTDOWN_LABELS: CountdownLabels = {
  days: "Days",
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",
  timer: "Countdown",
  complete: "Time's up",
  left: "{time} left",
  target: "Ends {date}",
};

export interface CountdownProps {
  /** Instante objetivo: ISO con zona (`2026-12-31T23:00:00Z`), milisegundos o Date. */
  to: number | string | Date;
  /** Zona en la que se muestra el instante objetivo (con `showTarget`). */
  timeZone?: string;
  units?: readonly CountdownUnit[];
  variant?: "inline" | "segments" | "flip";
  /** Segundos entre anuncios; sin él, un paso que se acorta al acercarse; 0 solo anuncia el final. */
  announceEvery?: number;
  /** Fecha y hora objetivo bajo las cifras. */
  showTarget?: boolean;
  size?: "sm" | "md" | "lg";
  locale?: string;
  labels?: Partial<CountdownLabels>;
  /** Momento de referencia fijo (pruebas y capturas). */
  now?: number | string | Date;
}

interface Config {
  to: number | null;
  timeZone: string;
  units: CountdownUnit[];
  variant: "inline" | "segments" | "flip";
  every: number | null;
  showTarget: boolean;
  size: "sm" | "md" | "lg";
  fixedNow: number | null;
  locale?: string;
  labels: CountdownLabels;
}

interface State {
  now: number;
  /** El aviso de fin ya salió (una sola vez por objetivo). */
  doneFor: number | null;
}

type Host = WidgetHost<Config, State>;

const variantOf = (v: unknown): Config["variant"] => (v === "inline" || v === "flip" ? v : "segments");

function unitLabel(labels: CountdownLabels, unit: CountdownUnit): string {
  return labels[unit];
}

function digits(unit: CountdownUnit, value: number, flip: boolean): VNode[] {
  const text = unitDigits(unit, value);
  if (!flip) return [text];
  // Una cifra por caja: al cambiar, la clave cambia y la caja nueva entra con su animación.
  return [...text].map((ch, i) => h("span", { class: "z-countdown__digit", key: `${unit}-${text.length - i}-${ch}` }, ch));
}

export const countdownWidget: Widget<CountdownProps, Config, State> = {
  root: "z-countdown",
  configure: (p) => ({
    to: countdownTarget(p.to),
    timeZone: safeTimeZone(p.timeZone),
    units: countdownUnits(p.units),
    variant: variantOf(p.variant),
    every: typeof p.announceEvery === "number" && Number.isFinite(p.announceEvery) ? Math.max(0, p.announceEvery) : null,
    showTarget: Boolean(p.showTarget),
    size: p.size === "sm" || p.size === "lg" ? p.size : "md",
    fixedNow: p.now === undefined || p.now === null || p.now === "" ? null : countdownTarget(p.now),
    locale: p.locale,
    labels: { ...COUNTDOWN_LABELS, ...p.labels },
  }),
  initial: (c) => ({ now: c.fixedNow ?? Date.now(), doneFor: null }),
  control: (c, s) => (c.fixedNow !== null && c.fixedNow !== s.now ? { ...s, now: c.fixedNow } : s),
  tree(c, s) {
    const { labels } = c;
    const remaining = c.to === null ? { ms: 0, done: true, parts: {} } : until(c.to, s.now, c.units);
    const done = remaining.done;
    const spoken = done ? labels.complete : countdownSpoken(remaining, c.locale);
    const flip = c.variant === "flip";
    const units = c.units.map((unit) =>
      h(
        "span",
        { class: "z-countdown__unit", "data-unit": unit, key: unit },
        h("span", { class: "z-countdown__value" }, ...digits(unit, remaining.parts[unit] ?? 0, flip)),
        h("span", { class: "z-countdown__label" }, unitLabel(labels, unit)),
      ),
    );
    return h(
      "div",
      { class: "z-countdown", "data-variant": c.variant, "data-size": c.size, "data-state": done ? "done" : "running" },
      h(
        "div",
        { class: "z-countdown__timer", role: "timer", "aria-label": `${labels.timer}: ${spoken}` },
        h("span", { class: "z-countdown__units", "aria-hidden": "true" }, ...units),
        done ? h("span", { class: "z-countdown__complete", "aria-hidden": "true" }, labels.complete) : null,
      ),
      c.showTarget && c.to !== null
        ? h(
            "time",
            { class: "z-countdown__target", datetime: zonedISO(c.to, c.timeZone) },
            fill(labels.target, {
              date: clockDate(c.to, {
                timeZone: c.timeZone,
                locale: c.locale,
                date: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
              }),
            }),
          )
        : null,
      h("span", { class: "z-sr-only z-countdown__live", role: "status", "data-live": "" }),
    );
  },
  attach(root, host: Host) {
    let finish: ReturnType<typeof setTimeout> | undefined;
    let last = host.config().to === null ? 0 : until(host.config().to!, host.state().now, host.config().units).ms;
    const check = (now: number) => {
      const c = host.config();
      if (c.to === null) return;
      const left = Math.max(0, c.to - now);
      if (left === 0) {
        if (host.state().doneFor !== c.to) {
          host.update({ now, doneFor: c.to });
          announceIn(root, c.labels.complete, ".z-countdown__live");
          host.emit("complete", { to: c.to });
        }
        return;
      }
      const hit = countdownMilestone(last, left, c.every);
      last = left;
      host.update({ now });
      if (hit !== null)
        announceIn(root, fill(c.labels.left, { time: countdownSpoken(until(c.to, now, c.units), c.locale) }), ".z-countdown__live");
    };
    const arm = () => {
      clearTimeout(finish);
      const c = host.config();
      if (c.to === null || c.fixedNow !== null) return;
      const left = c.to - Date.now();
      // El final no depende de que la pieza se vea: un aviso exacto (los navegadores lo agrupan si es largo).
      if (left > 0 && left < 2_147_483_647) finish = setTimeout(() => check(Date.now()), left + 4);
      else if (left <= 0) check(Date.now());
    };
    if (host.config().fixedNow !== null) return () => {};
    const unit = host.config().units.includes("seconds") ? "second" : "minute";
    check(Date.now());
    arm();
    const stop = subscribeTick(root, unit, (now) => check(now));
    const unwatch = pauseOffscreen(root);
    return () => {
      stop();
      unwatch();
      clearTimeout(finish);
    };
  },
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    return {
      to: d.to ?? "",
      timeZone: d.timeZone,
      units: d.units ? (list(d.units) as CountdownUnit[]) : undefined,
      variant: variantOf(d.variant),
      announceEvery: d.announceEvery !== undefined ? num(d.announceEvery, 0) : undefined,
      showTarget: d.showTarget !== undefined && d.showTarget !== "false",
      size: d.size === "sm" || d.size === "lg" ? d.size : undefined,
      now: d.now,
      locale: d.locale,
      labels: { ...(json.labels as Partial<CountdownLabels> | undefined), ...labelAttrs(d) },
    };
  },
};

/** Textos en `data-*-label` (data-complete-label, data-days-label…). */
function labelAttrs(d: DOMStringMap): Partial<CountdownLabels> {
  const out: Partial<CountdownLabels> = {};
  for (const key of Object.keys(COUNTDOWN_LABELS) as (keyof CountdownLabels)[]) {
    const v = d[`${key}Label`];
    if (v !== undefined) out[key] = v;
  }
  return out;
}
