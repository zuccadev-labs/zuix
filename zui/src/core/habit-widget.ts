// HabitCalendar (rachas y hábitos) como pieza (core/widget): mes con días cumplidos (sólido + marca), fallados
// (trama + cruz, texto en peligro), de descanso (guion; no rompen la racha), hoy en curso (anillo de progreso) y una
// banda que une los días de la racha actual; o una tira compacta de la semana. Cada estado tiene forma o icono
// además del color, y su texto en el nombre accesible; la leyenda lo explica. Sin documento al importar.

import { addDays, addMonths, daysInMonth, localeWeekInfo, parse, startOfWeek, todayISO, valid } from "./date";
import { habitStreak, type HabitState } from "./heatmap";
import { fill, fmt, h, icon, on, type VNode } from "./vnode";
import { num, type Widget } from "./widget";

export type { HabitState };

export interface HabitLabels {
  /** «{n} days» y «1 day» (racha actual). */
  days: string;
  dayOne: string;
  /** «best {n} days» (mes) y «Best: {n} days» (semana). */
  best: string;
  bestShort: string;
  done: string;
  missed: string;
  rest: string;
  /** «Today {n}%». */
  progress: string;
  previous: string;
  next: string;
  /** «{n}-day streak». */
  streak: string;
}

export const HABIT_LABELS: HabitLabels = {
  days: "{n} days",
  dayOne: "1 day",
  best: "best {n} days",
  bestShort: "Best: {n} days",
  done: "Done",
  missed: "Missed",
  rest: "Rest day",
  progress: "Today {n}%",
  previous: "Previous month",
  next: "Next month",
  streak: "{n} day streak",
};

export interface HabitCalendarProps {
  states?: Record<string, HabitState>;
  variant?: "month" | "week";
  /** Texto bajo la racha («Read 20 minutes»). */
  subtitle?: string;
  /** Pie («Complete a lesson today to reach 13 days»). */
  note?: string;
  month?: string;
  defaultMonth?: string;
  locale?: string;
  weekStartsOn?: number;
  today?: string;
  labels?: Partial<HabitLabels>;
}

export interface HabitConfig {
  states: Record<string, HabitState>;
  variant: "month" | "week";
  subtitle: string;
  note: string;
  month: string | null;
  defaultMonth: string | null;
  locale?: string;
  weekStart: number;
  today: string;
  labels: HabitLabels;
}

export interface HabitState2 {
  month: string;
  focus: string | null;
}

const progressOf = (s: HabitState | undefined) => (typeof s === "object" && s ? Math.max(0, Math.min(100, s.progress)) : null);
const kindOf = (s: HabitState | undefined): "done" | "missed" | "rest" | "progress" | null =>
  s === "done" || s === "missed" || s === "rest" ? s : progressOf(s) !== null ? (progressOf(s)! >= 100 ? "done" : "progress") : null;

export const habitWidget: Widget<HabitCalendarProps, HabitConfig, HabitState2> = {
  root: "z-habit",
  configure(p) {
    return {
      states: p.states ?? {},
      variant: p.variant === "week" ? "week" : "month",
      subtitle: p.subtitle ?? "",
      note: p.note ?? "",
      month: p.month && /^\d{4}-\d{2}$/.test(p.month) ? p.month : null,
      defaultMonth: p.defaultMonth && /^\d{4}-\d{2}$/.test(p.defaultMonth) ? p.defaultMonth : null,
      locale: p.locale,
      weekStart: (((p.weekStartsOn ?? localeWeekInfo(p.locale).firstDay) % 7) + 7) % 7,
      today: valid(p.today) ? p.today : todayISO(),
      labels: { ...HABIT_LABELS, ...p.labels },
    };
  },
  initial(config) {
    return { month: config.month ?? config.defaultMonth ?? config.today.slice(0, 7), focus: null };
  },
  control(config, state) {
    return config.month && config.month !== state.month ? { ...state, month: config.month } : state;
  },
  tree(config, state, uid) {
    const { labels, locale, today, states } = config;
    const streak = habitStreak(states, today);
    const run = new Set(streak.run);
    const dayName = fmt(locale, { weekday: "long", day: "numeric", month: "long" });
    const stateText = (d: string) => {
      const s = states[d];
      const k = kindOf(s);
      if (k === "progress") return fill(labels.progress, { n: progressOf(s)! });
      return k === "done" ? labels.done : k === "missed" ? labels.missed : k === "rest" ? labels.rest : "";
    };
    const mark = (d: string): VNode => {
      const k = kindOf(states[d]);
      if (k === "done") return h("span", { class: "z-habit__mark", "aria-hidden": "true" }, icon("check", 12));
      if (k === "missed") return h("span", { class: "z-habit__mark", "aria-hidden": "true" }, icon("x-mark", 12));
      return null;
    };
    const head = h(
      "div",
      { class: "z-habit__head" },
      h("span", { class: "z-habit__flame", "aria-hidden": "true" }, icon("fire", 22)),
      h(
        "div",
        null,
        h(
          "p",
          { class: "z-habit__count", id: `${uid}-count` },
          config.variant === "week"
            ? fill(labels.streak, { n: streak.current })
            : streak.current === 1
              ? labels.dayOne
              : fill(labels.days, { n: streak.current }),
        ),
        h(
          "p",
          { class: "z-habit__sub" },
          (config.variant === "week"
            ? [fill(labels.bestShort, { n: streak.longest }), config.subtitle]
            : [config.subtitle, fill(labels.best, { n: streak.longest })]
          )
            .filter(Boolean)
            .join(" · "),
        ),
      ),
    );
    if (config.variant === "week") {
      const first = startOfWeek(today, config.weekStart);
      return h(
        "div",
        { class: "z-habit z-liquid", "data-variant": "week" },
        head,
        h(
          "ol",
          { class: "z-habit__week", "aria-labelledby": `${uid}-count` },
          ...Array.from({ length: 7 }, (_, i) => {
            const d = addDays(first, i);
            const k = kindOf(states[d]);
            const text = stateText(d);
            return h(
              "li",
              { key: d, class: "z-habit__weekday" },
              h(
                "span",
                { class: "z-habit__box", "data-state": k ?? undefined, "data-today": on(d === today), "aria-hidden": "true" },
                k === "done" ? icon("check", 16) : d === today ? icon("fire", 16) : k === "missed" ? icon("x-mark", 16) : null,
              ),
              h("span", { "aria-hidden": "true" }, fmt(locale, { weekday: "short" }).format(parse(d)).slice(0, 2)),
              h("span", { class: "z-sr-only" }, `${dayName.format(parse(d))}${text ? `, ${text}` : ""}`),
            );
          }),
        ),
        config.note ? h("p", { class: "z-habit__note" }, config.note) : null,
      );
    }
    const month = state.month;
    const year = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7)) - 1;
    const firstDay = `${month}-01`;
    const lead = (parse(firstDay).getUTCDay() - config.weekStart + 7) % 7;
    const total = daysInMonth(year, m);
    const rows = Math.ceil((lead + total) / 7);
    const focusDay = state.focus && state.focus.slice(0, 7) === month ? state.focus : today.slice(0, 7) === month ? today : firstDay;
    const weekdays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(firstDay, config.weekStart), i));
    const caption = fmt(locale, { month: "long", year: "numeric" }).format(parse(firstDay));
    return h(
      "div",
      { class: "z-habit z-liquid", "data-variant": "month" },
      head,
      h(
        "div",
        { class: "z-habit__nav" },
        h("h3", { class: "z-habit__month", id: `${uid}-month`, "aria-live": "polite" }, caption),
        h(
          "span",
          { class: "z-agenda__nav" },
          h(
            "button",
            { type: "button", class: "z-agenda__icon-btn", "data-nav": "previous", "aria-label": labels.previous },
            icon("chevron-left", 16),
          ),
          h(
            "button",
            { type: "button", class: "z-agenda__icon-btn", "data-nav": "next", "aria-label": labels.next },
            icon("chevron-right", 16),
          ),
        ),
      ),
      h(
        "table",
        { class: "z-habit__grid", role: "grid", "aria-labelledby": `${uid}-month`, "aria-readonly": "true" },
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            ...weekdays.map((d) =>
              h(
                "th",
                { key: d, scope: "col", abbr: fmt(locale, { weekday: "long" }).format(parse(d)) },
                fmt(locale, { weekday: "short" }).format(parse(d)).slice(0, 2),
              ),
            ),
          ),
        ),
        h(
          "tbody",
          null,
          ...Array.from({ length: rows }, (_, r) =>
            h(
              "tr",
              { key: `r${r}` },
              ...Array.from({ length: 7 }, (_, c) => {
                const n = r * 7 + c - lead + 1;
                if (n < 1 || n > total) return h("td", { key: `e${r}${c}`, class: "z-habit__cell", role: "presentation" });
                const d = `${month}-${String(n).padStart(2, "0")}`;
                const k = kindOf(states[d]);
                const inRun = run.has(d);
                const text = stateText(d);
                const prevIn = run.has(addDays(d, -1)) && c > 0;
                const nextIn = run.has(addDays(d, 1)) && c < 6;
                return h(
                  "td",
                  {
                    key: d,
                    class: "z-habit__cell",
                    role: "gridcell",
                    "data-band": inRun ? (prevIn && nextIn ? "middle" : prevIn ? "end" : nextIn ? "start" : "single") : undefined,
                  },
                  h(
                    "button",
                    {
                      type: "button",
                      class: "z-habit__day",
                      "data-date": d,
                      "data-focus-id": `d:${d}`,
                      "data-state": k ?? undefined,
                      "data-today": on(d === today),
                      "data-future": on(d > today),
                      "aria-current": d === today ? "date" : undefined,
                      "aria-label": `${dayName.format(parse(d))}${text ? `, ${text}` : ""}`,
                      tabindex: d === focusDay ? 0 : -1,
                      s: k === "progress" ? { "--z-habit-progress": `${progressOf(states[d])}%` } : undefined,
                    },
                    fmt(locale, { day: "numeric" }).format(parse(d)),
                    mark(d),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
      h(
        "ul",
        { class: "z-habit__legend", "aria-hidden": "true" },
        h("li", null, h("i", { "data-state": "done" }), labels.done),
        h("li", null, h("i", { "data-state": "missed" }), labels.missed),
        h("li", null, h("i", { "data-state": "rest" }), labels.rest),
        progressOf(states[today]) !== null && kindOf(states[today]) === "progress"
          ? h(
              "li",
              null,
              h("i", { "data-state": "progress", s: { "--z-habit-progress": `${progressOf(states[today])}%` } }),
              fill(labels.progress, { n: progressOf(states[today])! }),
            )
          : null,
      ),
    );
  },
  attach(root, host) {
    const abort = new AbortController();
    const signal = abort.signal;
    const go = (date: string, focus = true) => {
      const month = date.slice(0, 7);
      const changed = month !== host.state().month;
      host.update({ focus: date, month }, focus);
      if (changed) host.emit("month-change", { month });
    };
    root.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        const nav = target.closest<HTMLElement>("[data-nav]");
        if (nav) {
          const month = addMonths(`${host.state().month}-01`, nav.dataset.nav === "previous" ? -1 : 1).slice(0, 7);
          host.update({ month, focus: null });
          host.emit("month-change", { month });
          return;
        }
        const day = target.closest<HTMLElement>(".z-habit__day");
        if (day?.dataset.date) {
          host.update({ focus: day.dataset.date });
          host.emit("day-click", { date: day.dataset.date, state: host.config().states[day.dataset.date] ?? null });
        }
      },
      { signal },
    );
    root.addEventListener(
      "keydown",
      (event) => {
        const day = (event.target as HTMLElement).closest<HTMLElement>(".z-habit__day");
        if (!day?.dataset.date) return;
        const d = day.dataset.date;
        const rtl = root.closest("[dir]")?.getAttribute("dir") === "rtl";
        const key = rtl && event.key === "ArrowLeft" ? "ArrowRight" : rtl && event.key === "ArrowRight" ? "ArrowLeft" : event.key;
        const ws = host.config().weekStart;
        const offset = (parse(d).getUTCDay() - ws + 7) % 7;
        const next =
          key === "ArrowRight"
            ? addDays(d, 1)
            : key === "ArrowLeft"
              ? addDays(d, -1)
              : key === "ArrowDown"
                ? addDays(d, 7)
                : key === "ArrowUp"
                  ? addDays(d, -7)
                  : key === "Home"
                    ? addDays(d, -offset)
                    : key === "End"
                      ? addDays(d, 6 - offset)
                      : key === "PageUp"
                        ? addMonths(d, -1)
                        : key === "PageDown"
                          ? addMonths(d, 1)
                          : null;
        if (!next) return;
        event.preventDefault();
        go(next);
      },
      { signal },
    );
    return () => abort.abort();
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      states: json.states as Record<string, HabitState> | undefined,
      variant: d.variant === "week" ? "week" : "month",
      subtitle: d.subtitle,
      note: d.note,
      defaultMonth: d.month,
      locale: d.locale,
      weekStartsOn: d.weekStart !== undefined ? num(d.weekStart, 1) : undefined,
      today: d.today,
      labels: json.labels as Partial<HabitLabels> | undefined,
    };
  },
};
