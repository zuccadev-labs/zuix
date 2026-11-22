// Clock (digital), AnalogClock y WorldClock como piezas (core/widget): un árbol para React y para el modo DOM, y el
// paso del tiempo con el temporizador compartido (core/ticker), que se para fuera de pantalla y con la pestaña oculta.
// Ninguno es una región viva: un reloj no se anuncia solo. El nombre de la esfera cambia una vez por minuto, nunca por
// segundo (el segundero es decorativo). Con `value` el reloj queda fijo en ese instante.

import {
  clockDate,
  clockParts,
  clockText,
  differenceSpoken,
  differenceText,
  faceMarks,
  faceNumerals,
  handAngles,
  isDaytime,
  wallAt,
  zoneDifference,
  zonedISO,
  type ClockFormat,
} from "./clock";
import { toInstant } from "./relative";
import { subscribeTick } from "./ticker";
import { pauseOffscreen } from "./visibility";
import { fill, h, icon, on, type VEl, type VNode } from "./vnode";
import { list, yes, type Widget, type WidgetHost } from "./widget";
import { safeTimeZone, zoneCity, zoneLabel } from "./zone";

type HourCycle = ClockFormat["hourCycle"];
const cycleOf = (v: unknown): HourCycle => (v === "h11" || v === "h12" || v === "h23" || v === "h24" ? v : undefined);
const sizeOf = (v: unknown): "sm" | "md" | "lg" => (v === "sm" || v === "lg" ? v : "md");

interface TickState {
  now: number;
}

/** Conecta el reloj al temporizador compartido (si no está fijo en un instante). */
function tick<C extends { fixed: number | null; seconds: boolean }>(root: HTMLElement, host: WidgetHost<C, TickState>): () => void {
  if (host.config().fixed !== null) return () => {};
  const now = Date.now();
  if (Math.abs(now - host.state().now) > 500) host.update({ now });
  // Las animaciones de CSS (separadores que laten, segundero continuo) también se paran fuera de pantalla.
  const unwatch = pauseOffscreen(root);
  const stop = subscribeTick(root, host.config().seconds ? "second" : "minute", (at) => {
    if (host.config().fixed === null) host.update({ now: at });
  });
  return () => {
    stop();
    unwatch();
  };
}

const fixedOf = (value: unknown) => (value === undefined || value === null || value === "" ? null : toInstant(value as string));

/* ---------- Clock ---------- */

export interface ClockProps {
  /** Instante fijo (ISO, ms o Date). Sin él, la hora actual. */
  value?: number | string | Date;
  /** Zona IANA; por defecto la del dispositivo. */
  timeZone?: string;
  hourCycle?: "h11" | "h12" | "h23" | "h24";
  seconds?: boolean;
  /** Fecha bajo la hora: `true` (día de la semana, día y mes) u opciones de `Intl.DateTimeFormat`. */
  date?: boolean | Intl.DateTimeFormatOptions;
  /** Los separadores laten (solo sin movimiento reducido). */
  blink?: boolean;
  /** Nombre de la zona junto a la hora: `short` («GMT+1») o `long` («Central European Standard Time»). */
  zone?: boolean | "short" | "long";
  /** Rótulo encima de la hora (una ciudad, «Local»). */
  label?: string;
  size?: "sm" | "md" | "lg";
  locale?: string;
}

interface ClockConfig {
  fixed: number | null;
  timeZone: string;
  hourCycle: HourCycle;
  seconds: boolean;
  date: false | Intl.DateTimeFormatOptions;
  blink: boolean;
  zone: false | "short" | "long";
  label: string;
  size: "sm" | "md" | "lg";
  locale?: string;
}

export const clockWidget: Widget<ClockProps, ClockConfig, TickState> = {
  root: "z-clock",
  configure: (p) => ({
    fixed: fixedOf(p.value),
    timeZone: safeTimeZone(p.timeZone),
    hourCycle: cycleOf(p.hourCycle),
    seconds: Boolean(p.seconds),
    date: p.date === true ? { weekday: "long", day: "numeric", month: "long" } : p.date ? p.date : false,
    blink: Boolean(p.blink),
    zone: p.zone === true ? "short" : p.zone === "short" || p.zone === "long" ? p.zone : false,
    label: p.label ?? "",
    size: sizeOf(p.size),
    locale: p.locale,
  }),
  initial: (c) => ({ now: c.fixed ?? Date.now() }),
  control: (c, s) => (c.fixed !== null && c.fixed !== s.now ? { now: c.fixed } : s),
  tree(c, s) {
    const options = { timeZone: c.timeZone, locale: c.locale, hourCycle: c.hourCycle, seconds: c.seconds };
    const parts = clockParts(s.now, options).map((p, i): VNode => {
      if (p.type === "separator") return h("span", { class: "z-clock__sep", key: `s${i}` }, p.value);
      if (p.type === "dayPeriod") return h("span", { class: "z-clock__period", key: `p${i}` }, p.value);
      if (p.type === "literal") return p.value;
      return h("span", { class: "z-clock__digits", "data-unit": p.type, key: `d${i}` }, p.value);
    });
    return h(
      "div",
      { class: "z-clock", "data-size": c.size, "data-blinking": on(c.blink && c.fixed === null) },
      c.label ? h("span", { class: "z-clock__label" }, c.label) : null,
      h("time", { class: "z-clock__time", datetime: zonedISO(s.now, c.timeZone, c.seconds) }, ...parts),
      c.date || c.zone
        ? h(
            "span",
            { class: "z-clock__meta" },
            c.date ? h("span", { class: "z-clock__date" }, clockDate(s.now, { ...options, date: c.date })) : null,
            c.zone
              ? h("span", { class: "z-clock__zone" }, zoneLabel(c.timeZone, s.now, c.locale, c.zone === "long" ? "long" : "shortOffset"))
              : null,
          )
        : null,
    );
  },
  attach: (root, host) => tick(root, host),
  after: () => {},
  fromDom(el) {
    const d = el.dataset;
    return {
      value: d.value,
      timeZone: d.timeZone,
      hourCycle: cycleOf(d.hourCycle),
      seconds: yes(d.seconds),
      date: yes(d.date),
      blink: yes(d.blink),
      zone: d.zone === "long" ? "long" : yes(d.zone) ? "short" : false,
      label: d.label,
      size: sizeOf(d.size),
      locale: d.locale,
    };
  },
};

/* ---------- AnalogClock ---------- */

export interface AnalogClockProps {
  value?: number | string | Date;
  timeZone?: string;
  /** Segundero (decorativo). Por defecto, sí. */
  seconds?: boolean;
  marks?: "hours" | "minutes" | "none";
  numerals?: "none" | "quarters" | "all";
  size?: "sm" | "md" | "lg";
  /** Segundero continuo en vez de a saltos (solo sin movimiento reducido). */
  smooth?: boolean;
  /** Lugar que acompaña a la hora en el nombre accesible y, con `caption`, bajo la esfera. */
  label?: string;
  /** Muestra la hora digital y el rótulo bajo la esfera. */
  caption?: boolean;
  locale?: string;
}

interface AnalogConfig {
  fixed: number | null;
  timeZone: string;
  seconds: boolean;
  marks: "hours" | "minutes" | "none";
  numerals: "none" | "quarters" | "all";
  size: "sm" | "md" | "lg";
  smooth: boolean;
  label: string;
  caption: boolean;
  locale?: string;
}

/**
 * Radio de las cifras cuando hay marcas. Las marcas largas empiezan en 40 (46 − 6) y una cifra del tamaño de la
 * esfera mide unas 8 unidades de alto y hasta 14 de ancho («12»): a 31 queda una holgura de 3 unidades. A 35 la
 * cifra pisaba las marcas del 3 y del 9.
 */
const NUMERAL_RADIUS = 31;

/** Esfera en SVG: la comparten AnalogClock y la variante analógica de WorldClock. */
function face(c: Pick<AnalogConfig, "timeZone" | "seconds" | "marks" | "numerals" | "smooth" | "locale">, now: number, name: string): VEl {
  const wall = wallAt(now, c.timeZone);
  const a = handAngles(wall);
  const hand = (kind: "hour" | "minute" | "second", length: number, tail: number, angle: number) =>
    h("line", {
      class: "z-analog-clock__hand",
      "data-hand": kind,
      x1: 50,
      y1: 50 + tail,
      x2: 50,
      y2: 50 - length,
      "stroke-linecap": "round",
      transform: `rotate(${Math.round(angle * 100) / 100} 50 50)`,
    });
  return h(
    "svg",
    { class: "z-analog-clock__face", viewBox: "0 0 100 100", role: "img", "aria-label": name, focusable: "false" },
    h("circle", { class: "z-analog-clock__dial", cx: 50, cy: 50, r: 49 }),
    c.marks === "none"
      ? null
      : h(
          "g",
          { class: "z-analog-clock__marks" },
          ...faceMarks(c.marks).map((m) =>
            h("line", {
              class: "z-analog-clock__mark",
              "data-major": on(m.major),
              x1: m.x1,
              y1: m.y1,
              x2: m.x2,
              y2: m.y2,
              "stroke-linecap": "round",
            }),
          ),
        ),
    c.numerals === "none"
      ? null
      : h(
          "g",
          { class: "z-analog-clock__numerals" },
          ...faceNumerals(c.numerals, c.marks === "none" ? 40 : NUMERAL_RADIUS).map((n) =>
            h(
              "text",
              { class: "z-analog-clock__numeral", x: n.x, y: n.y, "text-anchor": "middle", "dominant-baseline": "central" },
              new Intl.NumberFormat(c.locale).format(n.value),
            ),
          ),
        ),
    hand("hour", 24, 6, a.hour),
    hand("minute", 36, 8, a.minute),
    c.seconds
      ? h(
          "g",
          {
            class: "z-analog-clock__second",
            "data-smooth": on(c.smooth),
            // Con segundero continuo la animación de CSS gira desde este ángulo (retraso negativo).
            s: c.smooth ? { "--z-clock-second-delay": `${-Math.round((wall.second + (now % 1000) / 1000) * 1000)}ms` } : undefined,
          },
          hand("second", 40, 10, c.smooth ? 0 : a.second),
        )
      : null,
    h("circle", { class: "z-analog-clock__pin", cx: 50, cy: 50, r: 2.5 }),
  );
}

export const analogClockWidget: Widget<AnalogClockProps, AnalogConfig, TickState> = {
  root: "z-analog-clock",
  configure: (p) => ({
    fixed: fixedOf(p.value),
    timeZone: safeTimeZone(p.timeZone),
    seconds: p.seconds !== false,
    marks: p.marks === "minutes" || p.marks === "none" ? p.marks : "hours",
    numerals: p.numerals === "quarters" || p.numerals === "all" ? p.numerals : "none",
    size: sizeOf(p.size),
    smooth: Boolean(p.smooth),
    label: p.label ?? "",
    caption: Boolean(p.caption),
    locale: p.locale,
  }),
  initial: (c) => ({ now: c.fixed ?? Date.now() }),
  control: (c, s) => (c.fixed !== null && c.fixed !== s.now ? { now: c.fixed } : s),
  tree(c, s) {
    const time = clockText(s.now, { timeZone: c.timeZone, locale: c.locale });
    const name = c.label ? `${time}, ${c.label}` : time;
    return h(
      "div",
      { class: "z-analog-clock", "data-size": c.size },
      h("time", { class: "z-analog-clock__time", datetime: zonedISO(s.now, c.timeZone, false) }, face(c, s.now, name)),
      c.caption
        ? h(
            "span",
            { class: "z-analog-clock__caption", "aria-hidden": "true" },
            c.label ? h("span", { class: "z-analog-clock__label" }, c.label) : null,
            h("span", { class: "z-analog-clock__digital" }, time),
          )
        : null,
    );
  },
  // Sin segundero basta con un pintado por minuto.
  attach: (root, host) => tick(root, host),
  after: () => {},
  fromDom(el) {
    const d = el.dataset;
    return {
      value: d.value,
      timeZone: d.timeZone,
      seconds: d.seconds === undefined ? undefined : yes(d.seconds),
      marks: d.marks as AnalogClockProps["marks"],
      numerals: d.numerals as AnalogClockProps["numerals"],
      size: sizeOf(d.size),
      smooth: yes(d.smooth),
      label: d.label,
      caption: yes(d.caption),
      locale: d.locale,
    };
  },
};

/* ---------- WorldClock ---------- */

export interface WorldClockLabels {
  /** «{time} ahead» y «{time} behind»: diferencia con la zona de referencia. */
  ahead: string;
  behind: string;
  same: string;
  today: string;
  tomorrow: string;
  yesterday: string;
  day: string;
  night: string;
  /** «Remove {city}». */
  remove: string;
  /** Nombre de la lista. */
  list: string;
}

export const WORLD_CLOCK_LABELS: WorldClockLabels = {
  ahead: "{time} ahead",
  behind: "{time} behind",
  same: "Same time",
  today: "Today",
  tomorrow: "Tomorrow",
  yesterday: "Yesterday",
  day: "Day",
  night: "Night",
  remove: "Remove {city}",
  list: "World clock",
};

export interface WorldClockZone {
  timeZone: string;
  label?: string;
}

export interface WorldClockProps {
  zones: readonly WorldClockZone[];
  layout?: "list" | "grid";
  /** Zona de referencia de las diferencias; por defecto la del dispositivo. */
  reference?: string;
  variant?: "digital" | "analog";
  seconds?: boolean;
  hourCycle?: "h11" | "h12" | "h23" | "h24";
  value?: number | string | Date;
  /** Botón para quitar cada ciudad (avisa con `remove`). */
  removable?: boolean;
  locale?: string;
  labels?: Partial<WorldClockLabels>;
}

interface WorldConfig {
  fixed: number | null;
  zones: { timeZone: string; label: string }[];
  layout: "list" | "grid";
  reference: string;
  variant: "digital" | "analog";
  seconds: boolean;
  hourCycle: HourCycle;
  removable: boolean;
  locale?: string;
  labels: WorldClockLabels;
}

const markupZones = new WeakMap<HTMLElement, WorldClockZone[]>();

export const worldClockWidget: Widget<WorldClockProps, WorldConfig, TickState> = {
  root: "z-world-clock",
  configure: (p) => ({
    fixed: fixedOf(p.value),
    zones: (p.zones ?? []).map((z) => ({ timeZone: safeTimeZone(z.timeZone), label: z.label || zoneCity(safeTimeZone(z.timeZone)) })),
    layout: p.layout === "grid" ? "grid" : "list",
    reference: safeTimeZone(p.reference),
    variant: p.variant === "analog" ? "analog" : "digital",
    seconds: Boolean(p.seconds),
    hourCycle: cycleOf(p.hourCycle),
    removable: Boolean(p.removable),
    locale: p.locale,
    labels: { ...WORLD_CLOCK_LABELS, ...p.labels },
  }),
  initial: (c) => ({ now: c.fixed ?? Date.now() }),
  control: (c, s) => (c.fixed !== null && c.fixed !== s.now ? { now: c.fixed } : s),
  tree(c, s) {
    const { labels } = c;
    const seen = new Map<string, number>();
    const items = c.zones.map((z, i) => {
      // Clave por zona (no por posición): al quitar una ciudad, las demás conservan su nodo y el foco.
      const n = seen.get(z.timeZone) ?? 0;
      seen.set(z.timeZone, n + 1);
      const time = clockText(s.now, { timeZone: z.timeZone, locale: c.locale, hourCycle: c.hourCycle, seconds: c.seconds });
      const diff = zoneDifference(s.now, z.timeZone, c.reference);
      const shortDiff = differenceText(diff.minutes, c.locale);
      const spokenDiff =
        diff.minutes === 0
          ? labels.same
          : fill(diff.minutes > 0 ? labels.ahead : labels.behind, { time: differenceSpoken(diff.minutes, c.locale) });
      const dayWord = diff.day === 1 ? labels.tomorrow : diff.day === -1 ? labels.yesterday : labels.today;
      const day = isDaytime(wallAt(s.now, z.timeZone).hour);
      const sentence = [z.label, time, spokenDiff, diff.day ? dayWord : "", day ? labels.day : labels.night].filter(Boolean).join(", ");
      return h(
        "li",
        { class: "z-world-clock__city", key: n ? `${z.timeZone}#${n}` : z.timeZone, "data-day": day ? "day" : "night" },
        h("span", { class: "z-sr-only" }, sentence),
        h(
          "span",
          { class: "z-world-clock__body", "aria-hidden": "true" },
          c.variant === "analog"
            ? h(
                "span",
                { class: "z-analog-clock z-world-clock__dial", "data-size": "sm" },
                face(
                  { timeZone: z.timeZone, seconds: false, marks: "hours", numerals: "none", smooth: false, locale: c.locale },
                  s.now,
                  "",
                ),
              )
            : null,
          h(
            "span",
            { class: "z-world-clock__place" },
            h("span", { class: "z-world-clock__name" }, z.label),
            h(
              "span",
              { class: "z-world-clock__diff" },
              diff.minutes === 0 ? labels.same : shortDiff,
              diff.day ? h("span", { class: "z-world-clock__day" }, dayWord) : null,
            ),
          ),
          h(
            "span",
            { class: "z-world-clock__now" },
            h("span", { class: "z-world-clock__icon", "data-day": day ? "day" : "night" }, icon(day ? "sun" : "moon", 16)),
            h("time", { class: "z-world-clock__time", datetime: zonedISO(s.now, z.timeZone, c.seconds) }, time),
          ),
        ),
        c.removable
          ? h(
              "button",
              {
                type: "button",
                class: "z-btn z-btn--icon z-btn--ghost z-world-clock__remove",
                "data-size": "sm",
                "data-index": i,
                "aria-label": fill(labels.remove, { city: z.label }),
                title: fill(labels.remove, { city: z.label }),
              },
              icon("x-mark", 14),
            )
          : null,
      );
    });
    return h(
      "div",
      { class: "z-world-clock", "data-layout": c.layout, "data-variant": c.variant },
      h("ul", { class: "z-world-clock__list", "aria-label": labels.list, role: "list" }, ...items),
    );
  },
  attach(root, host) {
    const stop = tick(root, host);
    const click = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest?.<HTMLButtonElement>(".z-world-clock__remove");
      if (!button || !root.contains(button)) return;
      const index = Number(button.dataset.index);
      const zone = host.config().zones[index];
      if (!zone) return;
      // El foco pasa a la ciudad siguiente (o a la anterior) para no perderse al quitar esta: se busca por su nombre
      // cuando la aplicación ya ha quitado la ciudad.
      const zones = host.config().zones;
      const neighbour = zones[index + 1] ?? zones[index - 1];
      const name = neighbour ? fill(host.config().labels.remove, { city: neighbour.label }) : null;
      host.emit("remove", { timeZone: zone.timeZone, index });
      requestAnimationFrame(() => {
        // Si la aplicación no la quitó (el botón sigue ahí) o el foco ya está en otra parte, no se toca.
        const active = root.ownerDocument.activeElement;
        if (button.isConnected || (active && active !== root.ownerDocument.body)) return;
        const target = [...root.querySelectorAll<HTMLElement>(".z-world-clock__remove")].find((b) => b.getAttribute("aria-label") === name);
        (target ?? root.querySelector<HTMLElement>(".z-world-clock__remove"))?.focus();
      });
    };
    root.addEventListener("click", click);
    return () => {
      stop();
      root.removeEventListener("click", click);
    };
  },
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    // Las ciudades del marcado (`li[data-time-zone]`) se leen una vez: al montar, el árbol las sustituye.
    const found = [...el.querySelectorAll<HTMLElement>(":scope > ul > li[data-time-zone], :scope > li[data-time-zone]")].map((li) => ({
      timeZone: li.dataset.timeZone ?? "",
      label: li.dataset.label,
    }));
    if (found.length) markupZones.set(el, found);
    const fromItems = markupZones.get(el) ?? [];
    const zones =
      (json.zones as WorldClockZone[] | undefined) ?? (fromItems.length ? fromItems : list(d.zones).map((timeZone) => ({ timeZone })));
    return {
      zones,
      layout: d.layout === "grid" ? "grid" : "list",
      reference: d.reference,
      variant: d.variant === "analog" ? "analog" : "digital",
      seconds: yes(d.seconds),
      hourCycle: cycleOf(d.hourCycle),
      value: d.value,
      removable: yes(d.removable),
      locale: d.locale,
      labels: json.labels as Partial<WorldClockLabels> | undefined,
    };
  },
};
