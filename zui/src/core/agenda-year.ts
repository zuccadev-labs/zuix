// Vistas de año de la agenda: doce minimeses con densidad (YearView) y el año perpetuo de una página
// (PerpetualYear), que también es una pieza independiente. Árboles de core/vnode; sin documento.

import { addDays, daysInMonth, localeWeekInfo, parse, startOfWeek, valid } from "./date";
import { perpetualLookup, perpetualYear } from "./perpetual";
import { fill, fmt, h, on, type VEl, type VNode } from "./vnode";

/* ---------- Año: 12 minimeses ---------- */

export interface YearGridInput {
  year: number;
  weekStart: number;
  locale?: string;
  today: string;
  /** Día enfocable (tabindex itinerante) y elegido. */
  focus: string;
  selected?: string;
  /** Eventos de cada día (para la densidad y el nombre accesible). */
  counts: Map<string, number>;
  /** Densidad 0…3 de un día; por defecto, por número de eventos (1, 2–3, 4 o más). */
  density?: (date: string, count: number) => number;
  labels: { events: string; event: string; title: string };
}

const defaultDensity = (_d: string, n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);

export function yearGrid(input: YearGridInput): VEl {
  const { year, weekStart, locale, today, counts, labels } = input;
  const density = input.density ?? defaultDensity;
  const weekend = new Set(localeWeekInfo(locale).weekend);
  const first = startOfWeek(`${String(year).padStart(4, "0")}-01-01`, weekStart);
  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const dayLabel = fmt(locale, { dateStyle: "full" });
  return h(
    "div",
    { class: "z-yeargrid", role: "group", "aria-label": labels.title },
    ...Array.from({ length: 12 }, (_, m) => {
      const month = `${String(year).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}`;
      const firstDay = `${month}-01`;
      const lead = (parse(firstDay).getUTCDay() - weekStart + 7) % 7;
      const total = daysInMonth(year, m);
      const rows = Math.ceil((lead + total) / 7);
      const name = fmt(locale, { month: "long" }).format(parse(firstDay));
      const caption = fmt(locale, { month: "long", year: "numeric" }).format(parse(firstDay));
      const current = today.slice(0, 7) === month;
      return h(
        "section",
        { key: month, class: "z-yeargrid__month", "data-current": on(current), "data-month": month },
        h(
          "h3",
          { class: "z-yeargrid__title" },
          h("button", { type: "button", class: "z-yeargrid__month-btn", "data-month": month, "aria-label": caption }, name),
        ),
        h(
          "table",
          { class: "z-yeargrid__table", role: "grid", "aria-label": caption, "aria-readonly": "true" },
          h(
            "thead",
            null,
            h(
              "tr",
              null,
              ...weekdays.map((d) =>
                h(
                  "th",
                  {
                    key: d,
                    scope: "col",
                    abbr: fmt(locale, { weekday: "long" }).format(parse(d)),
                    class: "z-yeargrid__weekday",
                    "data-weekend": on(weekend.has(parse(d).getUTCDay())),
                  },
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
                { key: `${month}-${r}` },
                ...Array.from({ length: 7 }, (_, c) => {
                  const n = r * 7 + c - lead + 1;
                  if (n < 1 || n > total) return h("td", { key: `${r}-${c}`, class: "z-yeargrid__cell", role: "presentation" });
                  const date = `${month}-${String(n).padStart(2, "0")}`;
                  const count = counts.get(date) ?? 0;
                  const load = Math.max(0, Math.min(3, Math.round(density(date, count))));
                  const label = `${dayLabel.format(parse(date))}, ${count === 1 ? labels.event : fill(labels.events, { n: count })}`;
                  return h(
                    "td",
                    { key: date, class: "z-yeargrid__cell", role: "gridcell", "aria-selected": date === input.selected ? "true" : "false" },
                    h(
                      "button",
                      {
                        type: "button",
                        class: "z-yeargrid__day",
                        "data-date": date,
                        "data-focus-id": `d:${date}`,
                        "data-load": load,
                        "data-today": on(date === today),
                        "aria-current": date === today ? "date" : undefined,
                        "aria-label": label,
                        tabindex: input.focus === date ? 0 : -1,
                      },
                      fmt(locale, { day: "numeric" }).format(parse(date)),
                    ),
                  );
                }),
              ),
            ),
          ),
        ),
      );
    }),
  );
}

/* ---------- Año perpetuo de una página ---------- */

export interface PerpetualLabels {
  /** «One-page calendar». */
  title: string;
  /** Instrucciones de lectura (enlazadas con aria-describedby). */
  how: string;
  /** Etiqueta del buscador. */
  find: string;
  /** «{n} days». */
  days: string;
  /** Cabecera de la columna de filas («Day of the month»). */
  dayOfMonth: string;
  /** Resultado: «{date} → {weekday}» (texto; el día de la semana va en negrita). */
  result: string;
}

export const PERPETUAL_LABELS: PerpetualLabels = {
  title: "One-page calendar",
  how: "Find the day of the month on this side, follow its row to the left and stop under your month: that is the weekday.",
  find: "Find a weekday",
  days: "{n} days",
  dayOfMonth: "Days of the month",
  result: "{date} → {weekday}",
};

export interface PerpetualInput {
  uid: string;
  year: number;
  weekStart: number;
  locale?: string;
  /** Fecha resaltada (cruz) y la del buscador. */
  highlight?: string | null;
  today?: string | null;
  labels: PerpetualLabels;
}

export function perpetualTree(input: PerpetualInput): VEl {
  const { uid, year, weekStart, locale, labels } = input;
  const model = perpetualYear(year, weekStart);
  const hit = input.highlight && Number(input.highlight.slice(0, 4)) === year ? perpetualLookup(input.highlight, weekStart) : null;
  const hitMonth = hit ? Number(input.highlight!.slice(5, 7)) : 0;
  const hitDay = hit ? Number(input.highlight!.slice(8, 10)) : 0;
  const week = localeWeekInfo(locale).weekend;
  const restDay = week[week.length - 1] ?? 0;
  // Nombre de cada día de la semana (0 domingo): una semana cualquiera que empieza en domingo.
  const sunday = "2026-11-15";
  const short = (wd: number) => fmt(locale, { weekday: "short" }).format(parse(addDays(sunday, wd)));
  const long = (wd: number) => fmt(locale, { weekday: "long" }).format(parse(addDays(sunday, wd)));
  const monthName = (m: number) => fmt(locale, { month: "short" }).format(parse(`2026-${String(m).padStart(2, "0")}-01`));
  const monthLong = (m: number) => fmt(locale, { month: "long" }).format(parse(`2026-${String(m).padStart(2, "0")}-01`));
  const number = (n: number) => fmt(locale, { day: "numeric" }).format(parse(`2026-01-${String(n).padStart(2, "0")}`));
  const howId = `${uid}-how`;
  const result = hit
    ? fill(labels.result, {
        date: fmt(locale, { day: "numeric", month: "short", year: "numeric" }).format(parse(input.highlight!)),
        weekday: long(hit.weekday),
      })
    : "";
  const yearText = fmt(locale, { year: "numeric" }).format(parse(`${String(year).padStart(4, "0")}-06-01`));
  const value = hit ? input.highlight! : "";
  return h(
    "div",
    { class: "z-perpetual__frame" },
    h(
      "div",
      { class: "z-perpetual__sheet" },
      h(
        "table",
        { class: "z-perpetual__table", "aria-describedby": howId },
        h("caption", { class: "z-sr-only" }, `${yearText} · ${labels.title}`),
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h("td", { class: "z-perpetual__corner" }),
            ...model.columns.map((months, c) =>
              h(
                "th",
                { key: `c${c}`, scope: "col", class: "z-perpetual__months", "data-col-hl": on(hit?.column === c) },
                ...months.map((m) =>
                  h(
                    "span",
                    {
                      key: `m${m.month}`,
                      class: "z-perpetual__month",
                      "data-short": on(m.days < 31),
                      "data-current": on(m.month === hitMonth),
                    },
                    h(
                      "b",
                      null,
                      h("i", { "aria-hidden": "true" }, number(m.month)),
                      h("span", { "aria-hidden": "true" }, monthName(m.month)),
                    ),
                    h("span", { class: "z-sr-only" }, monthLong(m.month)),
                    h("small", null, fill(labels.days, { n: m.days })),
                  ),
                ),
              ),
            ),
          ),
        ),
        h(
          "tbody",
          null,
          ...model.weekdays.map((row, r) =>
            h(
              "tr",
              { key: `r${r}`, "data-row-hl": on(hit?.row === r) },
              h("th", { scope: "row", class: "z-perpetual__rowhead" }, model.numbers[r]!.map(number).join(", ")),
              ...row.map((wd, c) =>
                h(
                  "td",
                  {
                    key: `r${r}c${c}`,
                    class: "z-perpetual__wd",
                    "data-rest": on(wd === restDay),
                    "data-row-hl": on(hit?.row === r),
                    "data-col-hl": on(hit?.column === c),
                    "data-hit": on(hit?.row === r && hit.column === c),
                  },
                  h("abbr", { title: long(wd) }, short(wd)),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    h(
      "div",
      { class: "z-perpetual__side" },
      h("p", { class: "z-perpetual__year", "aria-hidden": "true" }, yearText),
      h("p", { class: "z-perpetual__sub" }, labels.title),
      h(
        "div",
        { class: "z-perpetual__dates", "aria-hidden": "true" },
        ...model.numbers.flatMap((row, r) =>
          row.map((n) =>
            h(
              "span",
              {
                key: `n${n}`,
                s: { "--z-pp-row": r + 1, "--z-pp-col": Math.floor((n - 1) / 7) + 1 },
                "data-row-hl": on(hit?.row === r),
                "data-hit": on(n === hitDay),
              },
              number(n),
            ),
          ),
        ),
      ),
      h(
        "label",
        { class: "z-perpetual__find" },
        h("span", { class: "z-perpetual__find-label" }, labels.find),
        h("input", {
          type: "date",
          class: "z-perpetual__input",
          value,
          min: `${String(year).padStart(4, "0")}-01-01`,
          max: `${String(year).padStart(4, "0")}-12-31`,
          "aria-describedby": `${uid}-result`,
        }),
      ),
      h("output", { class: "z-perpetual__result", id: `${uid}-result`, role: "status", "aria-live": "polite" }, result),
      h("p", { class: "z-perpetual__how", id: howId }, labels.how),
    ),
  );
}

/** Fecha válida dentro del año o `null`. */
export const inYear = (date: string | null | undefined, year: number) => (valid(date) && Number(date.slice(0, 4)) === year ? date : null);

export type { VNode };
