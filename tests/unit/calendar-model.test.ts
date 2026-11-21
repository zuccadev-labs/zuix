// Lógica pura de la familia de fecha: semanas ISO, preajustes, rango, selección, teclado y el modelo que pintan
// el binding de React y el modo DOM (zui/src/core/calendar.ts). Casos de borde a mano y propiedades con fast-check.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  addDays,
  clampDate,
  daysInMonth,
  diffDays,
  endOfMonth,
  format,
  formatDateRange,
  isoWeekText,
  localeWeekInfo,
  PRESET_KEYS,
  rangePresets,
  resolvePreset,
  startOfWeek,
  toISODate,
  valid,
  validMonth,
  validYear,
  weekNumber,
  weeksInYear,
  weekStartOf,
} from "../../zui/src/core/date.ts";
import {
  anchorOf,
  bounds,
  buildCalendar,
  captionOptions,
  choose,
  clampUnit,
  clampView,
  dayKeyTarget,
  dayStatus,
  initialMonth,
  navStep,
  parseValueText,
  rangeBlocked,
  rangeWindow,
  readSelection,
  revealMonth,
  selectionText,
  selectionValue,
  shiftMonth,
  unitEnd,
  unitKeyTarget,
  unitStart,
  validUnit,
  valueText,
  type CalendarInput,
} from "../../zui/src/core/calendar.ts";

fc.configureGlobal({
  seed: Number(process.env.ZUIX_FC_SEED ?? 20261119),
  numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300),
});

const iso = fc
  .tuple(fc.integer({ min: 2, max: 9998 }), fc.integer({ min: 0, max: 11 }), fc.integer({ min: 1, max: 31 }))
  .map(([y, m, d]) => {
    const date = new Date(0);
    date.setUTCFullYear(y, m, Math.min(d, daysInMonth(y, m)));
    return format(date);
  });
const weekStart = fc.integer({ min: 0, max: 6 });

const empty = readSelection("single", null);
const input = (over: Partial<CalendarInput> = {}): CalendarInput => ({
  mode: "single",
  selection: empty,
  rules: {},
  month: "2026-11",
  weekStart: 1,
  locale: "en-US",
  today: "2026-11-19",
  ...over,
});

describe("semanas", () => {
  test("semana ISO: W53 de 2026, semana 1 que empieza en diciembre y fin de año", () => {
    assert.equal(isoWeekText("2026-12-31"), "2026-W53");
    assert.equal(isoWeekText("2027-01-03"), "2026-W53");
    assert.equal(isoWeekText("2027-01-04"), "2027-W01");
    assert.equal(isoWeekText("2024-12-30"), "2025-W01");
    assert.equal(isoWeekText("2026-11-19"), "2026-W47");
    assert.equal(weeksInYear(2026), 53);
    assert.equal(weeksInYear(2027), 52);
    assert.equal(weekStartOf("2026-W53"), "2026-12-28");
    assert.equal(weekStartOf("2025-W01"), "2024-12-30");
    assert.equal(weekStartOf("2027-W53"), null, "2027 no tiene semana 53");
    assert.equal(weekStartOf("2026-W00"), null);
    assert.equal(weekStartOf("nope"), null);
    assert.equal(weekStartOf(undefined), null);
  });
  test("numeración del locale: semana que empieza en domingo con 1 día mínimo (Estados Unidos)", () => {
    assert.deepEqual(weekNumber("2026-01-01", 0, 1), { year: 2026, week: 1 });
    assert.deepEqual(weekNumber("2025-12-28", 0, 1), { year: 2026, week: 1 });
    assert.deepEqual(weekNumber("2026-11-19", 0, 1), { year: 2026, week: 47 });
  });
  test("datos de semana del locale, con respaldo sin datos", () => {
    const gb = localeWeekInfo("en-GB");
    assert.equal(gb.firstDay, 1);
    const us = localeWeekInfo("en-US");
    assert.equal(us.firstDay, 0);
    assert.ok(Array.isArray(us.weekend) && us.weekend.length > 0);
    assert.deepEqual(localeWeekInfo("not a locale!!"), { firstDay: 1, weekend: [6, 0], minimalDays: 4 });
  });
  test("propiedad: weekStartOf(isoWeekText(d)) es el lunes de la semana de d", () => {
    fc.assert(
      fc.property(iso, (d) => {
        const monday = weekStartOf(isoWeekText(d));
        assert.equal(monday, startOfWeek(d, 1));
        assert.ok(diffDays(monday!, d) >= 0 && diffDays(monday!, d) <= 6);
      }),
    );
  });
  test("propiedad: la semana tiene entre 1 y 53 y startOfWeek cae en el día pedido", () => {
    fc.assert(
      fc.property(iso, weekStart, fc.integer({ min: 1, max: 7 }), (d, first, minimal) => {
        const { week } = weekNumber(d, first, minimal);
        assert.ok(week >= 1 && week <= 53, `${d} ${first} ${minimal} → ${week}`);
        const start = startOfWeek(d, first);
        assert.equal(new Date(`${start}T00:00:00Z`).getUTCDay(), first);
      }),
    );
  });
});

describe("utilidades de fecha", () => {
  test("validaciones de mes y año, límites y valores de entrada tipo Temporal", () => {
    assert.ok(validMonth("2026-11") && !validMonth("2026-13") && !validMonth("0000-01") && !validMonth(null));
    assert.ok(validYear("2026") && !validYear("0000") && !validYear("26"));
    assert.equal(clampDate("2026-01-01", "2026-02-01", null), "2026-02-01");
    assert.equal(clampDate("2026-05-01", null, "2026-03-01"), "2026-03-01");
    assert.equal(clampDate("2026-02-10", "x", undefined), "2026-02-10");
    assert.equal(toISODate({ year: 2026, month: 2, day: 28 }), "2026-02-28");
    assert.equal(toISODate({ year: 2026, month: 2, day: 30 }), null);
    assert.equal(toISODate("2026-02-30"), null);
    assert.equal(toISODate(42), null);
    assert.equal(endOfMonth("2024-02-10"), "2024-02-29");
  });
  test("preajustes relativos a hoy", () => {
    const p = rangePresets("2026-11-19", 1);
    assert.deepEqual(p["last-7-days"], { from: "2026-11-13", to: "2026-11-19" });
    assert.deepEqual(p["this-week"], { from: "2026-11-16", to: "2026-11-22" });
    assert.deepEqual(p["last-month"], { from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual(p["next-month"], { from: "2026-12-01", to: "2026-12-31" });
    assert.deepEqual(p["last-year"], { from: "2025-01-01", to: "2025-12-31" });
    assert.deepEqual(resolvePreset("today", "2026-11-19"), { from: "2026-11-19", to: "2026-11-19" });
    assert.deepEqual(resolvePreset("2026-11-02", "2026-11-19"), { from: "2026-11-02", to: "2026-11-02" });
    assert.deepEqual(resolvePreset("2026-11-09/2026-11-02", "2026-11-19"), { from: "2026-11-02", to: "2026-11-09" });
    assert.equal(resolvePreset("someday", "2026-11-19"), null);
  });
  test("propiedad: todo preajuste es un rango válido y ordenado", () => {
    fc.assert(
      fc.property(iso, weekStart, (today, ws) => {
        const all = rangePresets(today, ws);
        for (const key of PRESET_KEYS) {
          const { from, to } = all[key];
          assert.ok(valid(from) && valid(to) && from <= to, `${key} ${from} ${to}`);
        }
      }),
    );
  });
  test("rango legible con formatRange", () => {
    assert.match(formatDateRange({ from: "2026-11-10", to: "2026-11-16" }, "en-US", { month: "short", day: "numeric" }), /^Nov 10\s–\s16$/);
    assert.equal(formatDateRange({ from: "2026-11-10", to: null }, "en-US", { month: "short", day: "numeric" }), "Nov 10");
    assert.match(formatDateRange({ from: "2026-11-16", to: "2026-11-10" }, "en-US", { month: "short", day: "numeric" }), /^Nov 10\s–\s16$/);
    assert.equal(formatDateRange(null), "");
  });
});

describe("valor y selección", () => {
  test("lectura por modo y unidad; texto del formulario y vuelta", () => {
    assert.deepEqual(readSelection("range", { from: "2026-11-20", to: "2026-11-10" }).range, { from: "2026-11-10", to: "2026-11-20" });
    assert.deepEqual(readSelection("range", { from: null, to: "2026-11-10" }).range, { from: null, to: null });
    assert.deepEqual(readSelection("multiple", ["2026-11-03", "bad", "2026-11-01", "2026-11-03"]).multiple, ["2026-11-01", "2026-11-03"]);
    assert.equal(readSelection("single", "2026-11", "month").single, "2026-11");
    assert.equal(readSelection("single", "2026-11-01", "month").single, null);
    assert.equal(valueText("multiple", parseValueText("multiple", "2026-11-04, 2026-11-02")), "2026-11-02,2026-11-04");
    assert.equal(valueText("range", parseValueText("range", "2026-11-04/")), "2026-11-04/");
    assert.equal(anchorOf(parseValueText("multiple", "2026-11-04")), "2026-11-04");
    assert.deepEqual(selectionValue("range", parseValueText("range", "")), { from: null, to: null });
    assert.ok(validUnit("2026", "year") && !validUnit(2026, "year"));
    assert.equal(unitStart("2026"), "2026-01-01");
    assert.equal(unitEnd("2026-02"), "2026-02-28");
  });
  test("propiedad: valueText y parseValueText son inversos en los tres modos", () => {
    fc.assert(
      fc.property(fc.array(iso, { maxLength: 6 }), (dates) => {
        for (const mode of ["single", "range", "multiple"] as const) {
          const raw = mode === "single" ? (dates[0] ?? null) : mode === "range" ? { from: dates[0] ?? null, to: dates[1] ?? null } : dates;
          const selection = readSelection(mode, raw);
          assert.deepEqual(parseValueText(mode, valueText(mode, selection)), selection);
        }
      }),
    );
  });
  test("límites: min > max ignora max; min y max de mes o año cuentan desde su primer o último día", () => {
    assert.deepEqual(bounds({ min: "2026-05-01", max: "2026-01-01" }), { min: "2026-05-01", max: "9999-12-31" });
    assert.deepEqual(bounds({ min: "2026-03", max: "2027" }), { min: "2026-03-01", max: "2027-12-31" });
    assert.equal(dayStatus("2026-11-01", { isDateUnavailable: (d) => d === "2026-11-01" }), "unavailable");
    assert.equal(clampUnit("2025-12", { min: "2026-03-15" }), "2026-03");
    assert.equal(clampUnit("2030", { max: "2027-05-01" }), "2027");
  });
  test("elegir: único, múltiple con máximo, rango que se invierte y rango que cruza una reservada", () => {
    const rules = { isDateUnavailable: (d: string) => d === "2026-11-20" };
    assert.equal(choose("single", empty, "2026-11-20", rules), undefined, "reservada");
    assert.deepEqual(choose("multiple", readSelection("multiple", ["2026-11-02"]), "2026-11-01", {}), ["2026-11-01", "2026-11-02"]);
    assert.deepEqual(choose("multiple", readSelection("multiple", ["2026-11-02"]), "2026-11-02", {}), []);
    assert.equal(choose("multiple", readSelection("multiple", ["2026-11-02"]), "2026-11-05", { maxSelected: 1 }), undefined);
    const start = readSelection("range", { from: "2026-11-18", to: null });
    assert.deepEqual(choose("range", start, "2026-11-10", {}), { from: "2026-11-10", to: "2026-11-18" });
    assert.deepEqual(choose("range", start, "2026-11-22", rules), { from: "2026-11-22", to: null }, "cruza una reservada: empieza otro");
    assert.deepEqual(choose("range", start, "2026-11-22", { ...rules, rangeCrossesUnavailable: "allow" }), {
      from: "2026-11-18",
      to: "2026-11-22",
    });
    assert.equal(choose("range", start, "2026-11-18", { allowSingleDayRange: false }), undefined);
    assert.deepEqual(choose("range", start, "2026-11-19", { minRange: 3 }), { from: "2026-11-19", to: null });
    assert.deepEqual(choose("single", empty, "2026-11-19", {}, { unit: "week", weekStart: 1 }), "2026-11-16");
    assert.deepEqual(
      choose("range", readSelection("range", { from: "2026-11-16", to: null }), "2026-11-04", {}, { unit: "week", weekStart: 1 }),
      {
        from: "2026-11-02",
        to: "2026-11-22",
      },
    );
    assert.equal(choose("single", empty, "2025-12", { min: "2026-01-01" }), undefined, "mes fuera de los límites");
  });
  test("ventana del rango: corta en la reservada más cercana y en maxRange", () => {
    const rules = { isDateUnavailable: (d: string) => d === "2026-11-20" || d === "2026-11-05", maxRange: 30 };
    assert.deepEqual(rangeWindow("2026-11-12", rules), { lo: "2026-11-06", hi: "2026-11-19" });
    assert.deepEqual(rangeWindow("2026-11-12", { maxRange: 3 }), { lo: "2026-11-10", hi: "2026-11-14" });
    assert.ok(rangeBlocked("2026-11-12", "2026-11-21", rules));
    assert.ok(!rangeBlocked("2026-11-12", "2026-11-19", rules));
  });
  test("propiedad: un rango elegido en dos pasos está ordenado y no contiene reservadas (block)", () => {
    fc.assert(
      fc.property(iso, fc.integer({ min: -60, max: 60 }), fc.integer({ min: 0, max: 6 }), (from, offset, mod) => {
        const rules = { isDateUnavailable: (d: string) => Number(d.slice(8, 10)) % 7 === mod };
        const first = choose("range", readSelection("range", null), from, rules);
        if (first === undefined) return;
        const second = choose("range", readSelection("range", first), addDays(from, offset), rules);
        if (!second || typeof second !== "object" || Array.isArray(second)) return;
        if (!second.to) return;
        assert.ok(second.from! <= second.to);
        for (let d = second.from!; d <= second.to; d = addDays(d, 1))
          assert.ok(!rules.isDateUnavailable(d), `${d} en ${JSON.stringify(second)}`);
      }),
    );
  });
});

describe("teclado", () => {
  test("días: flechas, Inicio/Fin, Ctrl+Inicio/Fin, RePág/AvPág con y sin Mayús y límites del calendario", () => {
    const k = (key: string, extra = {}) => dayKeyTarget({ key, ...extra }, "2026-11-19", 1);
    assert.equal(k("ArrowLeft"), "2026-11-18");
    assert.equal(k("ArrowDown"), "2026-11-26");
    assert.equal(k("Home"), "2026-11-16");
    assert.equal(k("End"), "2026-11-22");
    assert.equal(k("Home", { ctrlKey: true }), "2026-11-01");
    assert.equal(k("End", { metaKey: true }), "2026-11-30");
    assert.equal(k("PageUp"), "2026-10-19");
    assert.equal(k("PageDown", { shiftKey: true }), "2027-11-19");
    assert.equal(k("Tab"), null);
    assert.equal(dayKeyTarget({ key: "ArrowLeft" }, "0001-01-01", 1), "0001-01-01");
    assert.equal(dayKeyTarget({ key: "ArrowRight" }, "9999-12-31", 1), "9999-12-31");
  });
  test("meses y años en rejilla de 3 × 4", () => {
    assert.equal(unitKeyTarget("month", { key: "ArrowDown" }, "2026-11"), "2027-02");
    assert.equal(unitKeyTarget("month", { key: "Home" }, "2026-11"), "2026-10");
    assert.equal(unitKeyTarget("month", { key: "End", ctrlKey: true }, "2026-05"), "2026-12");
    assert.equal(unitKeyTarget("month", { key: "PageUp" }, "2026-05"), "2025-05");
    assert.equal(unitKeyTarget("month", { key: "PageDown", shiftKey: true }, "2026-05"), "2036-05");
    assert.equal(unitKeyTarget("year", { key: "ArrowUp" }, "2026"), "2023");
    assert.equal(unitKeyTarget("year", { key: "Home", ctrlKey: true }, "2026"), "2019");
    assert.equal(unitKeyTarget("year", { key: "End" }, "2026"), "2027");
    assert.equal(unitKeyTarget("year", { key: "PageDown", shiftKey: true }, "2026"), "2126");
    assert.equal(unitKeyTarget("year", { key: "ArrowLeft" }, "0001"), "0001");
    assert.equal(unitKeyTarget("year", { key: "x" }, "2026"), null);
    assert.equal(unitKeyTarget("month", { key: "x" }, "2026-01"), null);
  });
  test("propiedad: una flecha y su contraria vuelven al mismo día", () => {
    fc.assert(
      fc.property(iso, weekStart, fc.constantFrom(["ArrowLeft", "ArrowRight"], ["ArrowUp", "ArrowDown"]), (d, ws, [a, b]) => {
        assert.equal(dayKeyTarget({ key: b! }, dayKeyTarget({ key: a! }, d, ws)!, ws), d);
      }),
    );
  });
});

describe("modelo", () => {
  test("un mes: 5 filas, días de fuera, hoy, tabulador único y título", () => {
    const model = buildCalendar(input({ selection: readSelection("single", "2026-11-24") }));
    assert.equal(model.title, "November 2026");
    assert.equal(model.months[0]!.weeks.length, 6);
    const cells = model.months[0]!.weeks.flatMap((w) => w.cells);
    assert.equal(cells.filter((c) => c.tabbable).length, 1);
    assert.equal(cells.find((c) => c.tabbable)!.date, "2026-11-24");
    assert.ok(cells.find((c) => c.date === "2026-11-19")!.today);
    assert.ok(cells.find((c) => c.date === "2026-10-26")!.outside);
    assert.deepEqual(model.weekdays.map((w) => w.short).slice(0, 2), ["Mon", "Tue"]);
    assert.ok(model.weekdays[5]!.weekend);
  });
  test("semanas fijas, números de semana ISO y del locale", () => {
    const model = buildCalendar(input({ month: "2026-02", fixedWeeks: true, showWeekNumber: true, weekStart: 0 }));
    assert.equal(model.months[0]!.weeks.length, 6);
    // La primera fila empieza el domingo 1 de febrero de 2026; su lunes (día 2) es de la semana ISO 6.
    assert.equal(model.months[0]!.weeks[0]!.number!.label, "6");
    assert.equal(model.months[0]!.weeks[0]!.number!.ariaLabel, "Week 6");
    const locale = buildCalendar(input({ month: "2026-01", showWeekNumber: true, weekStart: 0, weekNumbering: "locale", minimalDays: 1 }));
    assert.equal(locale.months[0]!.weeks[0]!.number!.value, 1);
  });
  test("dos meses: sin días de fuera, título con formatRange y extremos de la banda en los huecos", () => {
    const model = buildCalendar(
      input({ mode: "range", numberOfMonths: 2, selection: readSelection("range", { from: "2026-11-26", to: "2026-12-04" }) }),
    );
    assert.equal(model.months.length, 2);
    assert.match(model.title, /November.*December 2026/);
    const nov = model.months[0]!.weeks.flatMap((w) => w.cells);
    assert.ok(nov.filter((c) => c.outside).every((c) => c.hidden));
    const last = nov.find((c) => c.date === "2026-11-30")!;
    assert.equal(last.range, "middle");
    assert.ok(last.rowStart && last.rowEnd, "el 30 está solo en su fila");
    const dec = model.months[1]!.weeks.flatMap((w) => w.cells);
    assert.ok(dec.find((c) => c.date === "2026-12-01")!.rowStart);
    assert.equal(dec.find((c) => c.date === "2026-12-04")!.range, "end");
    assert.ok(model.canPrevious && model.canNext);
  });
  test("vista previa del rango y días bloqueados durante la elección", () => {
    const model = buildCalendar(
      input({
        mode: "range",
        selection: readSelection("range", { from: "2026-11-10", to: null }),
        preview: "2026-11-13",
        rules: { isDateUnavailable: (d) => d === "2026-11-20", maxRange: 7 },
        labels: { unavailable: "booked" },
      }),
    );
    const cells = model.months[0]!.weeks.flatMap((w) => w.cells);
    const at = (d: string) => cells.find((c) => c.date === d)!;
    assert.equal(at("2026-11-12").range, "middle");
    assert.ok(at("2026-11-12").preview);
    assert.ok(at("2026-11-17").disabled, "fuera de maxRange");
    assert.ok(!at("2026-11-16").disabled);
    assert.ok(at("2026-11-20").unavailable && at("2026-11-20").ariaLabel.endsWith(", booked"));
  });
  test("semana: la semana elegida y la vista previa de otra", () => {
    const base = input({ unit: "week", selection: readSelection("single", "2026-11-16") });
    const cells = buildCalendar(base).months[0]!.weeks.flatMap((w) => w.cells);
    assert.equal(cells.filter((c) => c.inSelection).length, 7);
    const hover = buildCalendar({ ...base, preview: "2026-11-25" }).months[0]!.weeks.flatMap((w) => w.cells);
    assert.equal(hover.find((c) => c.date === "2026-11-23")!.range, "start");
    assert.ok(hover.find((c) => c.date === "2026-11-23")!.preview);
  });
  test("modificadores, descripción y múltiple", () => {
    const model = buildCalendar(
      input({
        mode: "multiple",
        selection: readSelection("multiple", ["2026-11-03", "2026-11-05"]),
        modifiers: { holiday: (d) => d === "2026-11-11" },
        dayDescription: (d) => (d === "2026-11-11" ? "Veterans Day" : null),
      }),
    );
    const cells = model.months[0]!.weeks.flatMap((w) => w.cells);
    const holiday = cells.find((c) => c.date === "2026-11-11")!;
    assert.deepEqual(holiday.modifiers, ["holiday"]);
    assert.match(holiday.ariaLabel, /Veterans Day$/);
    assert.equal(cells.filter((c) => c.selected).length, 2);
  });
  test("vistas de mes y año", () => {
    const months = buildCalendar(input({ view: "month", selection: readSelection("single", "2026-11-24"), rules: { max: "2026-12-15" } }));
    assert.equal(months.title, "2026");
    assert.equal(months.units.length, 4);
    assert.equal(months.units[3]![1]!.label, "Nov");
    assert.ok(months.units[3]![1]!.selected && months.units[3]![1]!.current);
    assert.ok(!months.canNext);
    const years = buildCalendar(input({ view: "year", minView: "year", selection: readSelection("single", "2024", "year") }));
    assert.equal(years.title, "2020 – 2029");
    const flat = years.units.flat();
    assert.equal(flat.length, 12);
    assert.ok(flat[0]!.outside && flat[11]!.outside);
    assert.ok(flat.find((u) => u.value === "2024")!.selected);
    assert.equal(years.unitsLabel, "Choose year");
    const ranged = buildCalendar(
      input({
        view: "month",
        minView: "month",
        mode: "range",
        selection: readSelection("range", { from: "2026-03", to: "2026-06" }, "month"),
      }),
    );
    assert.equal(ranged.units.flat().find((u) => u.value === "2026-04")!.range, "middle");
  });
  test("vista, navegación y mes inicial", () => {
    assert.equal(clampView("year", "month", "month"), "month");
    assert.equal(clampView("nope", "month"), "month");
    assert.equal(navStep("day", 2, true), 2);
    assert.equal(navStep("year"), 120);
    assert.equal(shiftMonth("0001-02", -5), "0001-01");
    assert.equal(revealMonth("2026-11", 2, "2027-01-03"), "2026-12");
    assert.equal(revealMonth("2026-11", 2, "2027-01-03", true), "2027-01");
    assert.equal(revealMonth("2026-11", 2, "2026-10-03"), "2026-10");
    assert.equal(revealMonth("2026-11", 2, "2026-12-03"), "2026-11");
    assert.equal(initialMonth(null, null, "2026-11-19", { min: "2027-02-01" }), "2027-02");
    assert.equal(initialMonth("2026-03", "2026-05-01", "2026-11-19", {}), "2026-03");
    assert.equal(initialMonth(null, "2026", "2026-11-19", {}), "2026-01");
    const caption = captionOptions("2026-11", { min: "2026-03-01", max: "2028-06-30" }, "en-US");
    assert.ok(caption.months[1]!.disabled && !caption.months[2]!.disabled);
    assert.deepEqual(
      caption.years.map((y) => y.value),
      ["2026", "2027", "2028"],
    );
  });
  test("texto del valor para el campo", () => {
    const at = { locale: "en-US" };
    assert.equal(selectionText("single", readSelection("single", "2026-11-13"), at), "Nov 13, 2026");
    assert.equal(selectionText("range", readSelection("range", { from: "2026-11-13", to: null }), at), "Nov 13, 2026 – …");
    assert.equal(selectionText("multiple", readSelection("multiple", ["2026-11-01", "2026-11-02", "2026-11-03"]), at), "3 dates");
    assert.equal(selectionText("single", readSelection("single", "2026-11", "month"), { ...at, unit: "month" }), "November 2026");
    assert.equal(selectionText("single", readSelection("single", "2026", "year"), { ...at, unit: "year" }), "2026");
  });
  test("propiedad: siempre hay exactamente un día con tabulador por calendario de días", () => {
    fc.assert(
      fc.property(iso, fc.integer({ min: 1, max: 3 }), weekStart, fc.boolean(), (d, n, ws, fixed) => {
        const model = buildCalendar(
          input({
            month: d.slice(0, 7),
            numberOfMonths: n,
            weekStart: ws,
            fixedWeeks: fixed,
            selection: readSelection("single", d),
            today: null,
          }),
        );
        const tabbable = model.months.flatMap((m) => m.weeks.flatMap((w) => w.cells)).filter((c) => c.tabbable);
        assert.equal(tabbable.length, 1);
        assert.equal(tabbable[0]!.date, d);
      }),
    );
  });
});
