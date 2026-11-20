// SlotPicker (franjas de cita, estilo Calendly) como pieza (core/widget): un Calendar con los días que tienen hueco
// realzados (los demás deshabilitados pero enfocables y anunciados «no times available»), la zona del visitante y
// un `listbox` con las horas del día elegido en 12 o 24 h; «Next» es un botón aparte. Las horas son instantes: se
// calculan en la zona del anfitrión y se muestran en la del visitante. Sin documento al importar.

import { addDays, localeWeekInfo, parse, todayISO, valid } from "./date";
import { availabilitySlots, localeHourCycle, slotLabel, slotsByDay, type Availability, type HourCycle } from "./slots";
import { fill, fmt, h, icon } from "./vnode";
import { num, type Widget } from "./widget";
import { safeTimeZone, toWall, zoneCity, zoneLabel } from "./zone";

export interface SlotPickerLabels {
  title: string;
  timeZone: string;
  /** «{n} times available» / «1 time available». */
  available: string;
  availableOne: string;
  none: string;
  /** Descripción de un día sin huecos en el calendario. */
  noTimes: string;
  times: string;
  next: string;
  hourCycle: string;
  h12: string;
  h24: string;
  /** «{time} selected». */
  selected: string;
}

export const SLOT_LABELS: SlotPickerLabels = {
  title: "Select a date & time",
  timeZone: "Time zone",
  available: "{n} times available",
  availableOne: "1 time available",
  none: "No times available on this day",
  noTimes: "no times available",
  times: "Available times",
  next: "Next",
  hourCycle: "Time format",
  h12: "12h",
  h24: "24h",
  selected: "{time} selected",
};

export interface SlotPickerProps {
  /** Instantes de inicio (ISO con zona o milisegundos). */
  slots?: (string | number)[];
  /** O disponibilidad del anfitrión (en `hostTimeZone`) con `duration`, entre `from` y `to` (fechas del anfitrión). */
  availability?: Availability[];
  hostTimeZone?: string;
  duration?: number;
  step?: number;
  from?: string;
  to?: string;
  busy?: { start: string | number; end: string | number }[];
  /** Zona del visitante (IANA). Por defecto, la del dispositivo. */
  timeZone?: string;
  /** Zonas del selector; sin ellas solo se muestra la zona. */
  timeZones?: string[];
  hourCycle?: HourCycle;
  defaultHourCycle?: HourCycle;
  /** Instante elegido (ISO o ms) y día del calendario. */
  value?: string | number | null;
  defaultValue?: string | number | null;
  date?: string;
  locale?: string;
  weekStartsOn?: number;
  today?: string;
  /** No ofrece franjas anteriores a este instante (por defecto, ahora). */
  now?: number | string;
  labels?: Partial<SlotPickerLabels>;
}

export interface SlotPickerConfig {
  slots: number[];
  timeZone: string;
  timeZones: string[] | null;
  hourCycle: HourCycle | null;
  defaultHourCycle: HourCycle;
  value: number | null | undefined;
  defaultValue: number | null;
  date: string | null;
  locale?: string;
  weekStart: number;
  today: string;
  now: number;
  labels: SlotPickerLabels;
}

export interface SlotPickerState {
  date: string | null;
  value: number | null;
  timeZone: string;
  hourCycle: HourCycle;
  focus: number | null;
}

const toMs = (v: string | number | null | undefined) => (v === null || v === undefined ? null : typeof v === "number" ? v : Date.parse(v));

/** Día que se abre: el del valor, el pedido o el primero con franjas desde hoy. */
function firstDay(byDay: Map<string, number[]>, today: string): string | null {
  for (const d of [...byDay.keys()].sort()) if (d >= today) return d;
  return [...byDay.keys()].sort()[0] ?? null;
}

export const slotPickerWidget: Widget<SlotPickerProps, SlotPickerConfig, SlotPickerState> = {
  root: "z-slotpicker",
  configure(p) {
    const now = toMs(p.now ?? null) ?? Date.now();
    const today = valid(p.today) ? p.today : todayISO();
    let slots = (p.slots ?? []).map(toMs).filter((v): v is number => v !== null && Number.isFinite(v));
    if (!p.slots && p.availability) {
      const from = valid(p.from) ? p.from : today;
      slots = availabilitySlots(
        p.availability,
        safeTimeZone(p.hostTimeZone),
        from,
        valid(p.to) ? p.to : addDays(from, 60),
        p.duration ?? 30,
        {
          step: p.step,
          busy: (p.busy ?? []).map((b) => ({ start: toMs(b.start)!, end: toMs(b.end)! })),
          notBefore: now,
        },
      );
    }
    return {
      slots,
      timeZone: safeTimeZone(p.timeZone),
      timeZones: p.timeZones?.length ? p.timeZones : null,
      hourCycle: p.hourCycle ?? null,
      defaultHourCycle: p.defaultHourCycle ?? localeHourCycle(p.locale),
      value: p.value === undefined ? undefined : toMs(p.value),
      defaultValue: toMs(p.defaultValue ?? null),
      date: valid(p.date) ? p.date : null,
      locale: p.locale,
      weekStart: (((p.weekStartsOn ?? localeWeekInfo(p.locale).firstDay) % 7) + 7) % 7,
      today,
      now,
      labels: { ...SLOT_LABELS, ...p.labels },
    };
  },
  initial(config) {
    const value = config.value !== undefined ? config.value : config.defaultValue;
    const byDay = slotsByDay(config.slots, config.timeZone);
    return {
      date: config.date ?? (value !== null ? toWall(value, config.timeZone).date : firstDay(byDay, config.today)),
      value,
      timeZone: config.timeZone,
      hourCycle: config.hourCycle ?? config.defaultHourCycle,
      focus: null,
    };
  },
  control(config, state) {
    let next = state;
    if (config.value !== undefined && config.value !== state.value) next = { ...next, value: config.value };
    if (config.hourCycle && config.hourCycle !== state.hourCycle) next = { ...next, hourCycle: config.hourCycle };
    if (config.date && config.date !== state.date) next = { ...next, date: config.date };
    return next;
  },
  tree(config, state, uid) {
    const { labels, locale } = config;
    const tz = state.timeZone;
    const byDay = slotsByDay(config.slots, tz);
    const days = new Set(byDay.keys());
    const list = state.date ? (byDay.get(state.date) ?? []) : [];
    const focus =
      state.focus !== null && list.includes(state.focus)
        ? state.focus
        : state.value !== null && list.includes(state.value)
          ? state.value
          : (list[0] ?? null);
    const headingId = `${uid}-day`;
    const label = (ms: number) => slotLabel(ms, tz, locale, state.hourCycle);
    const zones = [...new Set([tz, ...(config.timeZones ?? [])])];
    const zoneText = (z: string) =>
      `${zoneCity(z)} · ${zoneLabel(z, config.now, locale)} (${slotLabel(config.now, z, locale, state.hourCycle)})`;
    const selectedInList = state.value !== null && list.includes(state.value);
    return h(
      "div",
      { class: "z-slotpicker z-liquid", "data-hour-cycle": state.hourCycle },
      h(
        "div",
        { class: "z-slotpicker__frame" },
        h(
          "div",
          { class: "z-slotpicker__cal" },
          h("h3", { class: "z-slotpicker__title" }, labels.title),
          {
            slot: "calendar",
            k: "calendar",
            p: {
              name: "day",
              className: "z-slotpicker__calendar",
              props: {
                value: state.date,
                today: config.today,
                locale,
                weekStartsOn: config.weekStart,
                cellSize: "lg",
                isDateDisabled: (d: string) => !days.has(d),
                getDayDescription: (d: string) => (days.has(d) ? null : labels.noTimes),
                modifiers: { available: (d: string) => days.has(d) },
              },
              attrs: {
                "data-mode": "single",
                "data-value": state.date ?? "",
                "data-today": config.today,
                "data-locale": locale,
                "data-week-start": config.weekStart,
                "data-cell-size": "lg",
              },
              options: {
                isDateDisabled: (d: string) => !days.has(d),
                dayDescription: (d: string) => (days.has(d) ? null : labels.noTimes),
                modifiers: { available: (d: string) => days.has(d) },
              },
            },
          },
          h(
            "label",
            { class: "z-slotpicker__tz" },
            h("span", null, labels.timeZone),
            config.timeZones
              ? h(
                  "span",
                  { class: "z-slotpicker__select-wrap" },
                  icon("globe-alt", 14),
                  h(
                    "select",
                    { class: "z-slotpicker__select" },
                    ...zones.map((z) => h("option", { key: z, value: z, selected: z === tz }, zoneText(z))),
                  ),
                  icon("chevron-up-down", 14),
                )
              : h("span", { class: "z-slotpicker__select-wrap", "data-static": "" }, icon("globe-alt", 14), zoneText(tz)),
          ),
        ),
        h(
          "div",
          { class: "z-slotpicker__times" },
          h(
            "div",
            { class: "z-slotpicker__head" },
            h(
              "div",
              null,
              h(
                "h3",
                { class: "z-slotpicker__day", id: headingId },
                state.date ? fmt(locale, { weekday: "long", day: "numeric", month: "long" }).format(parse(state.date)) : labels.times,
              ),
              h(
                "p",
                { class: "z-slotpicker__count" },
                list.length === 1 ? labels.availableOne : list.length ? fill(labels.available, { n: list.length }) : labels.none,
              ),
            ),
            h(
              "div",
              { class: "z-segmented z-slotpicker__cycle", role: "group", "aria-label": labels.hourCycle, "data-size": "sm" },
              ...(["h12", "h23"] as const).map((c) =>
                h(
                  "button",
                  {
                    key: c,
                    type: "button",
                    class: "z-segmented__item z-slotpicker__cycle-btn",
                    "data-cycle": c,
                    "aria-pressed": state.hourCycle === c ? "true" : "false",
                    "data-state": state.hourCycle === c ? "on" : "off",
                  },
                  h("span", { class: "z-segmented__label" }, c === "h12" ? labels.h12 : labels.h24),
                ),
              ),
            ),
          ),
          list.length
            ? h(
                "div",
                { class: "z-slotpicker__list", role: "listbox", "aria-labelledby": headingId },
                ...list.map((ms) =>
                  h(
                    "div",
                    {
                      key: `s${ms}`,
                      id: `${uid}-slot-${ms}`,
                      class: "z-slotpicker__slot",
                      role: "option",
                      "data-slot": ms,
                      "data-focus-id": `slot:${ms}`,
                      "aria-selected": state.value === ms ? "true" : "false",
                      tabindex: focus === ms ? 0 : -1,
                    },
                    h("time", { datetime: new Date(ms).toISOString() }, label(ms)),
                  ),
                ),
              )
            : null,
          selectedInList
            ? h(
                "div",
                { class: "z-slotpicker__confirm" },
                h("span", { class: "z-slotpicker__chosen", role: "status" }, fill(labels.selected, { time: label(state.value!) })),
                h("button", { type: "button", class: "z-btn z-btn--primary z-slotpicker__next", "data-size": "lg" }, labels.next),
              )
            : null,
        ),
      ),
    );
  },
  attach(root, host) {
    const abort = new AbortController();
    const signal = abort.signal;
    const listOf = () => [...root.querySelectorAll<HTMLElement>(".z-slotpicker__slot")].map((el) => Number(el.dataset.slot));
    const choose = (ms: number) => {
      host.update({ value: ms, focus: ms }, true);
      host.emit("select", { start: new Date(ms).toISOString(), timeZone: host.state().timeZone, startMs: ms });
    };
    root.addEventListener(
      "click",
      (event) => {
        const target = event.target as HTMLElement;
        const slot = target.closest<HTMLElement>(".z-slotpicker__slot");
        if (slot) {
          choose(Number(slot.dataset.slot));
          return;
        }
        const cycle = target.closest<HTMLElement>("[data-cycle]");
        if (cycle) {
          const value = cycle.dataset.cycle as HourCycle;
          if (value !== host.state().hourCycle) {
            host.update({ hourCycle: value });
            host.emit("hour-cycle-change", { hourCycle: value });
          }
          return;
        }
        if (target.closest(".z-slotpicker__next")) {
          const s = host.state();
          if (s.value !== null) host.emit("confirm", { start: new Date(s.value).toISOString(), timeZone: s.timeZone, startMs: s.value });
        }
      },
      { signal },
    );
    root.addEventListener(
      "keydown",
      (event) => {
        const slot = (event.target as HTMLElement).closest<HTMLElement>(".z-slotpicker__slot");
        if (!slot) return;
        const list = listOf();
        const i = list.indexOf(Number(slot.dataset.slot));
        let j = -1;
        if (event.key === "ArrowDown") j = Math.min(list.length - 1, i + 1);
        else if (event.key === "ArrowUp") j = Math.max(0, i - 1);
        else if (event.key === "Home") j = 0;
        else if (event.key === "End") j = list.length - 1;
        else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          choose(list[i]!);
          return;
        } else return;
        event.preventDefault();
        if (j >= 0 && j !== i) host.update({ focus: list[j]! }, true);
      },
      { signal },
    );
    root.addEventListener(
      "change",
      (event) => {
        const select = event.target as HTMLSelectElement;
        if (!select.matches?.(".z-slotpicker__select")) return;
        host.update({ timeZone: select.value });
        host.emit("time-zone-change", { timeZone: select.value });
      },
      { signal },
    );
    return () => abort.abort();
  },
  after(root, host, focus) {
    if (!focus) return;
    const s = host.state();
    const el =
      root.querySelector<HTMLElement>(`.z-slotpicker__slot[data-slot="${s.focus ?? s.value}"]`) ??
      root.querySelector<HTMLElement>('.z-slotpicker__slot[tabindex="0"]');
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: "nearest" });
  },
  calendarChange(host, _name, value) {
    if (typeof value !== "string" || !valid(value) || value === host.state().date) return;
    host.update({ date: value, focus: null });
    host.emit("date-change", { date: value });
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      slots: json.slots as (string | number)[] | undefined,
      availability: json.availability as Availability[] | undefined,
      hostTimeZone: d.hostTimeZone,
      duration: d.duration ? num(d.duration, 30) : undefined,
      step: d.step ? num(d.step, 30) : undefined,
      from: d.from,
      to: d.to,
      busy: json.busy as SlotPickerProps["busy"],
      timeZone: d.timeZone,
      timeZones: d.timeZones?.split(/[\s,]+/).filter(Boolean),
      defaultHourCycle: d.hourCycle === "h12" || d.hourCycle === "h23" ? d.hourCycle : undefined,
      defaultValue: d.value ?? null,
      date: undefined,
      locale: d.locale,
      weekStartsOn: d.weekStart !== undefined ? num(d.weekStart, 1) : undefined,
      today: d.today,
      now: d.now,
      labels: json.labels as Partial<SlotPickerLabels> | undefined,
    };
  },
};
