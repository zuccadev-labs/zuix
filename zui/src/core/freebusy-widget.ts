// FreeBusy («buscar hueco») como pieza (core/widget): la rejilla de recursos con una fila por persona, sus ocupados
// (trama neutra y «Busy» en texto), lo que queda fuera de su horario (trama cálida y «Outside hours») y la franja
// común propuesta (verde con su texto). Botones para la anterior, la siguiente y «Use …». Sin documento al importar.

import { clockMinutes, dateOf, dayStart, minuteOfDay, nowIn } from "./agenda";
import { addDays, todayISO, valid } from "./date";
import { busyOf, findSlots, subtractIntervals, toMs, workingIntervals, type Attendee, type Interval } from "./freebusy";
import { resourceTimeline, type ResourceItem } from "./timeline-view";
import { fill, fmt, h, icon } from "./vnode";
import { num, type Widget } from "./widget";
import { fromWall, safeTimeZone, toWall, zoneCity } from "./zone";

export interface FreeBusyLabels {
  title: string;
  guests: string;
  busy: string;
  outside: string;
  /** «All {n} free». */
  allFree: string;
  /** «Use {time}». */
  use: string;
  earlier: string;
  later: string;
  none: string;
  /** «{city} · {time} now». */
  localNow: string;
}

export const FREEBUSY_LABELS: FreeBusyLabels = {
  title: "Find a time",
  guests: "Guests",
  busy: "Busy",
  outside: "Outside hours",
  allFree: "All {n} free",
  use: "Use {time}",
  earlier: "Earlier slot",
  later: "Later slot",
  none: "No common free time this day",
  localNow: "{city} · {time} now",
};

export interface FreeBusyAttendee extends Attendee {
  /** Texto bajo el nombre («Organiser · Madrid»). Por defecto, la ciudad de su zona y su hora. */
  meta?: string;
}

export interface FreeBusyProps {
  attendees?: FreeBusyAttendee[];
  date?: string;
  /** Zona de presentación (IANA). */
  timeZone?: string;
  /** Minutos de la reunión. */
  duration?: number;
  step?: number;
  dayStart?: string;
  dayEnd?: string;
  locale?: string;
  now?: number | string;
  title?: string;
  labels?: Partial<FreeBusyLabels>;
}

export interface FreeBusyConfig {
  attendees: FreeBusyAttendee[];
  date: string;
  timeZone: string;
  duration: number;
  step: number;
  dayStart: number;
  dayEnd: number;
  locale?: string;
  now: number | null;
  title: string;
  labels: FreeBusyLabels;
}

export interface FreeBusyState {
  index: number;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Franjas comunes del día en la zona de presentación (instantes). */
export function freeBusySlots(config: FreeBusyConfig): Interval[] {
  const from = fromWall(
    { date: config.date, hour: Math.floor(config.dayStart / 60), minute: config.dayStart % 60, second: 0 },
    config.timeZone,
  );
  const to = fromWall(
    { date: config.date, hour: Math.floor(config.dayEnd / 60) % 24, minute: config.dayEnd % 60, second: 0 },
    config.timeZone,
  );
  const end = config.dayEnd >= 1440 ? fromWall({ date: addDays(config.date, 1), hour: 0, minute: 0, second: 0 }, config.timeZone) : to;
  if (from === null || end === null) return [];
  return findSlots(config.attendees, from, end, config.duration, { step: config.step, limit: 200, fallbackZone: config.timeZone });
}

export const freeBusyWidget: Widget<FreeBusyProps, FreeBusyConfig, FreeBusyState> = {
  root: "z-freebusy",
  configure(p) {
    const nowMs = p.now === undefined ? null : typeof p.now === "number" ? p.now : Date.parse(p.now);
    return {
      attendees: p.attendees ?? [],
      date: valid(p.date) ? p.date : todayISO(),
      timeZone: safeTimeZone(p.timeZone),
      duration: Math.max(5, p.duration ?? 60),
      step: Math.max(5, p.step ?? 30),
      dayStart: clockMinutes(p.dayStart, 8 * 60),
      dayEnd: clockMinutes(p.dayEnd, 19 * 60),
      locale: p.locale,
      now: Number.isFinite(nowMs) ? (nowMs as number) : null,
      title: p.title ?? "",
      labels: { ...FREEBUSY_LABELS, ...p.labels },
    };
  },
  initial() {
    return { index: 0 };
  },
  tree(config, state, uid) {
    const { labels, locale, timeZone } = config;
    const base = dayStart(config.date);
    const toMin = (ms: number) => nowIn(ms, timeZone) - base;
    const time = (m: number) => fmt(locale, { hour: "2-digit", minute: "2-digit" }).format(minuteOfDay(m) * 60_000);
    const range = (a: number, b: number) => {
      const f = fmt(locale, { hour: "2-digit", minute: "2-digit" }, timeZone);
      try {
        return f.formatRange(a, b);
      } catch {
        return `${f.format(a)} – ${f.format(b)}`;
      }
    };
    const dayFrom = fromWall({ date: config.date, hour: 0, minute: 0, second: 0 }, timeZone) ?? 0;
    const dayTo = fromWall({ date: addDays(config.date, 1), hour: 0, minute: 0, second: 0 }, timeZone) ?? dayFrom + 86_400_000;
    const items: ResourceItem[] = [];
    const kinds = new Map<string, "busy" | "outside">();
    for (const a of config.attendees) {
      const busy = busyOf(a).filter((b) => b.end > dayFrom && b.start < dayTo);
      busy.forEach((b, i) => {
        const key = `${a.id}:busy:${i}`;
        kinds.set(key, "busy");
        items.push({ key, resourceId: a.id, start: toMin(Math.max(b.start, dayFrom)), end: toMin(Math.min(b.end, dayTo)) || 1440 });
      });
      if (a.workingHours) {
        const work = workingIntervals(a.workingHours, a.timeZone ?? timeZone, dayFrom, dayTo);
        subtractIntervals([{ start: dayFrom, end: dayTo }], [...work, ...busy]).forEach((b, i) => {
          const key = `${a.id}:out:${i}`;
          kinds.set(key, "outside");
          items.push({ key, resourceId: a.id, start: toMin(b.start), end: b.end >= dayTo ? 1440 : toMin(b.end) });
        });
      }
    }
    const slots = freeBusySlots(config);
    const index = Math.min(state.index, Math.max(0, slots.length - 1));
    const slot = slots[index] ?? null;
    const required = config.attendees.filter((a) => !a.optional).length;
    const slotText = slot ? range(slot.start, slot.end) : "";
    const nowMin = config.now !== null ? nowIn(config.now, timeZone) : null;
    const overlay = slot
      ? h(
          "div",
          {
            class: "z-freebusy__suggest",
            "aria-hidden": "true",
            s: { "--z-tl-start": (toMin(slot.start) - config.dayStart) / 60, "--z-tl-span": (slot.end - slot.start) / 3_600_000 },
          },
          h("span", null, icon("check", 12), fill(labels.allFree, { n: required })),
        )
      : null;
    const grid = resourceTimeline({
      uid,
      resources: config.attendees.map((a) => ({ id: a.id, title: a.name, meta: a.meta })),
      items,
      dayStart: config.dayStart,
      dayEnd: config.dayEnd,
      now: nowMin !== null && dateOf(nowMin) === config.date ? minuteOfDay(nowMin) : null,
      locale,
      labels: { resource: labels.guests, overlaps: "", newBooking: "" },
      overlay,
      focusableScroll: true,
      renderLabel: (r) => {
        const a = config.attendees.find((x) => x.id === r.id)!;
        const zone = a.timeZone ?? timeZone;
        const local = config.now !== null ? fmt(locale, { hour: "2-digit", minute: "2-digit" }, zone).format(config.now) : "";
        const meta = a.meta ?? (zone !== timeZone && local ? fill(labels.localNow, { city: zoneCity(zone), time: local }) : zoneCity(zone));
        return [
          h("span", { class: "z-timeline__avatar z-freebusy__avatar", "aria-hidden": "true" }, initials(a.name)),
          h("span", { class: "z-timeline__meta" }, h("span", { class: "z-timeline__name" }, a.name), h("small", null, meta)),
        ];
      },
      renderItem: (it, layout) => {
        const kind = kinds.get(it.key)!;
        const text = kind === "busy" ? labels.busy : labels.outside;
        const a = Math.max(config.dayStart, it.start);
        const b = Math.min(config.dayEnd, it.end);
        return h(
          "span",
          { key: it.key, class: "z-freebusy__block", "data-kind": kind, s: layout.s },
          h("span", { "aria-hidden": "true" }, text),
          h("span", { class: "z-sr-only" }, `${text} ${time(a)}–${time(b)}`),
        );
      },
    });
    return h(
      "div",
      { class: "z-freebusy z-liquid" },
      h(
        "div",
        { class: "z-timeline__toolbar" },
        h("h2", { class: "z-timeline__title" }, config.title || labels.title),
        h("span", { class: "z-timeline__spacer-flex" }),
        h(
          "span",
          { class: "z-freebusy__actions" },
          h(
            "button",
            {
              type: "button",
              class: "z-agenda__icon-btn z-freebusy__prev",
              "aria-label": labels.earlier,
              disabled: index <= 0 ? true : undefined,
            },
            icon("chevron-left", 16),
          ),
          h(
            "button",
            {
              type: "button",
              class: "z-agenda__icon-btn z-freebusy__next",
              "aria-label": labels.later,
              disabled: index >= slots.length - 1 ? true : undefined,
            },
            icon("chevron-right", 16),
          ),
          slot
            ? h(
                "button",
                {
                  type: "button",
                  class: "z-btn z-btn--primary z-freebusy__use",
                  "data-size": "sm",
                  "data-start": slot.start,
                  "data-end": slot.end,
                },
                fill(labels.use, { time: slotText }),
              )
            : h("span", { class: "z-freebusy__none" }, labels.none),
        ),
      ),
      grid,
      h(
        "div",
        { class: "z-sr-only", role: "status", "aria-live": "polite", "data-live": "" },
        slot ? `${fill(labels.allFree, { n: required })}: ${slotText}` : labels.none,
      ),
    );
  },
  attach(root, host) {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const slots = freeBusySlots(host.config());
      const i = Math.min(host.state().index, Math.max(0, slots.length - 1));
      if (target.closest(".z-freebusy__prev")) host.update({ index: Math.max(0, i - 1) });
      else if (target.closest(".z-freebusy__next")) host.update({ index: Math.min(slots.length - 1, i + 1) });
      else if (target.closest(".z-freebusy__use") && slots[i]) {
        const c = host.config();
        const iso = (ms: number) => {
          const w = toWall(ms, c.timeZone);
          return `${w.date}T${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
        };
        host.emit("select", {
          start: iso(slots[i].start),
          end: iso(slots[i].end),
          timeZone: c.timeZone,
          startMs: slots[i].start,
          endMs: slots[i].end,
        });
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  },
  after() {},
  fromDom(el, json) {
    const d = el.dataset;
    return {
      attendees: json.attendees as FreeBusyAttendee[] | undefined,
      date: d.date,
      timeZone: d.timeZone,
      duration: d.duration ? num(d.duration, 60) : undefined,
      step: d.step ? num(d.step, 30) : undefined,
      dayStart: d.dayStart,
      dayEnd: d.dayEnd,
      locale: d.locale,
      now: d.now,
      title: d.title,
      labels: json.labels as Partial<FreeBusyLabels> | undefined,
    };
  },
};

export { toMs };
