// Lógica de DateField, TimeField y TimePicker (zui/src/core/segments.ts y zui/src/core/time.ts): orden de los
// segmentos por locale, teclado APG de spinbutton, pegado, validez, ciclos horarios, franjas y columnas. Al final,
// propiedades con fast-check (semilla fija, como tests/unit/properties.test.ts).
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { daysInMonth, format } from "../../zui/src/core/date.ts";
import {
  bounds,
  digitOf,
  fieldConfig,
  fieldValue,
  firstEditable,
  inBounds,
  isComplete,
  isEmpty,
  parsePasted,
  segmentKey,
  segmentText,
  segmentValueText,
  validity,
  valuesFrom,
  type FieldConfig,
  type FieldState,
  type SegmentType,
  type Values,
} from "../../zui/src/core/segments.ts";
import {
  dayPeriods,
  formatTime,
  fromDisplayHour,
  fullTime,
  hourBounds,
  inTimeRange,
  is12h,
  localeHourCycle,
  nowTime,
  parseTime,
  pickColumn,
  revealOption,
  safeStep,
  slotKey,
  slotMatches,
  stepValues,
  timeColumns,
  timeLabel,
  timeSlots,
  toDisplayHour,
  validTime,
  type HourCycle,
} from "../../zui/src/core/time.ts";

fc.configureGlobal({
  seed: Number(process.env.ZUIX_FC_SEED ?? 20261119),
  numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300),
});

const order = (config: FieldConfig) => config.parts.map((p) => (p.type === "literal" ? p.text : p.type)).join("");
const empty = (): FieldState => ({ values: {}, typed: null });
/** Pulsa teclas sobre segmentos (`[segmento, tecla]`) y devuelve el estado y el último cambio de foco. */
function keys(config: FieldConfig, start: FieldState, steps: Array<[SegmentType, string]>, readOnly = false) {
  let state = start;
  let focus: string | undefined;
  for (const [type, key] of steps) {
    const outcome = segmentKey(state, type, key, config, readOnly);
    state = outcome.state;
    focus = outcome.focus;
  }
  return { state, focus };
}

describe("time: horas civiles", () => {
  test("validTime, parseTime, formatTime y fullTime", () => {
    assert.ok(validTime("00:00") && validTime("23:59:59"));
    for (const bad of ["24:00", "9:30", "12:60", "12:00:60", "", null, undefined, "12:00Z"])
      assert.equal(validTime(bad), false, String(bad));
    assert.deepEqual(parseTime("07:05:09"), { hour: 7, minute: 5, second: 9 });
    assert.deepEqual(parseTime("07:05"), { hour: 7, minute: 5, second: 0 });
    assert.equal(parseTime("x"), null);
    assert.equal(formatTime({ hour: 7, minute: 5, second: 9 }), "07:05");
    assert.equal(formatTime({ hour: 7, minute: 5, second: 9 }, true), "07:05:09");
    assert.equal(fullTime("07:05"), "07:05:00");
    assert.equal(fullTime("07:05:01"), "07:05:01");
  });
  test("inTimeRange: franja normal, franja que cruza la medianoche y sin límites", () => {
    assert.ok(inTimeRange("09:00", "09:00", "17:00") && inTimeRange("17:00", "09:00", "17:00"));
    assert.ok(!inTimeRange("08:59", "09:00", "17:00") && !inTimeRange("17:00:01", "09:00", "17:00"));
    assert.ok(inTimeRange("23:30", "22:00", "02:00") && inTimeRange("01:00", "22:00", "02:00") && inTimeRange("02:00", "22:00", "02:00"));
    assert.ok(!inTimeRange("12:00", "22:00", "02:00") && !inTimeRange("21:59", "22:00", "02:00"));
    assert.ok(inTimeRange("05:00") && inTimeRange("05:00", "04:00") && !inTimeRange("05:00", null, "04:00"));
    assert.ok(inTimeRange("05:00", "nope", "also"), "límites no válidos no limitan");
  });
  test("ciclo horario del locale y su variante de 12 o 24 h", () => {
    assert.equal(localeHourCycle("en-US"), "h12");
    assert.equal(localeHourCycle("en-GB"), "h23");
    assert.equal(localeHourCycle("en-US", 24), "h23");
    assert.equal(localeHourCycle("de", 12), "h12");
    assert.ok(["h11", "h12"].includes(localeHourCycle("ja", 12)));
    assert.equal(localeHourCycle("x-invalid-locale-!!", 12), "h12");
    assert.equal(localeHourCycle("x-invalid-locale-!!"), "h23");
  });
  test("hora mostrada en cada ciclo: 12 AM es 00, h11 empieza en 0, h24 termina en 24", () => {
    assert.deepEqual(toDisplayHour(0, "h12"), { hour: 12, period: 0 });
    assert.deepEqual(toDisplayHour(12, "h12"), { hour: 12, period: 1 });
    assert.deepEqual(toDisplayHour(13, "h11"), { hour: 1, period: 1 });
    assert.deepEqual(toDisplayHour(0, "h24"), { hour: 24, period: 0 });
    assert.deepEqual(toDisplayHour(15, "h23"), { hour: 15, period: 1 });
    assert.equal(fromDisplayHour(12, 0, "h12"), 0);
    assert.equal(fromDisplayHour(12, 1, "h12"), 12);
    assert.equal(fromDisplayHour(0, 1, "h11"), 12);
    assert.equal(fromDisplayHour(24, undefined, "h24"), 0);
    assert.deepEqual(hourBounds("h11"), [0, 11]);
    assert.deepEqual(hourBounds("h24"), [1, 24]);
    assert.ok(is12h("h11") && !is12h("h23"));
  });
  test("textos de AM/PM y etiquetas por locale", () => {
    assert.deepEqual(dayPeriods("en-US"), ["AM", "PM"]);
    const [am, pm] = dayPeriods("es");
    assert.match(am, /a/);
    assert.match(pm, /p/);
    assert.equal(timeLabel("21:30", "en-US", "h12"), "9:30 PM");
    assert.equal(timeLabel("09:30", "en-GB", "h23"), "09:30");
    assert.equal(timeLabel("09:30:15", "en-GB", "h23", true), "09:30:15");
    assert.equal(timeLabel("nope", "en-GB", "h23"), "nope");
  });
  test("nowTime, safeStep y stepValues", () => {
    const at = new Date(2026, 10, 19, 8, 4, 33);
    assert.equal(nowTime(false, at), "08:04");
    assert.equal(nowTime(true, at), "08:04:33");
    assert.match(nowTime(), /^\d{2}:\d{2}$/);
    assert.equal(safeStep(15), 15);
    for (const bad of [0, -5, 61, 2.5, "x", null]) assert.equal(safeStep(bad), 1);
    assert.deepEqual(stepValues(15), [0, 15, 30, 45]);
    assert.deepEqual(stepValues(25), [0, 25, 50]);
  });
  test("timeSlots: paso, límites, franja que cruza la medianoche y paso que no divide el día", () => {
    assert.equal(timeSlots(30).length, 48);
    assert.deepEqual(timeSlots(60, "09:00", "12:00"), ["09:00", "10:00", "11:00", "12:00"]);
    assert.deepEqual(timeSlots(60, "22:00", "02:00"), ["22:00", "23:00", "00:00", "01:00", "02:00"]);
    assert.deepEqual(timeSlots(30, "09:15", "10:30"), ["09:15", "09:45", "10:15"]);
    assert.deepEqual(timeSlots(30, "09:00:30", "10:00"), ["09:01", "09:31"]);
    const odd = timeSlots(45);
    assert.equal(new Set(odd).size, odd.length);
    assert.equal(odd.length, 32);
    assert.equal(timeSlots(0).length, 48, "un paso no válido usa 30 minutos");
  });
  test("timeColumns: orden de reloj en 12 h, opciones fuera de rango o deshabilitadas", () => {
    const columns = timeColumns({ value: "13:05", cycle: "h12", minuteStep: 15, min: "09:00", max: "17:00" });
    assert.deepEqual(
      columns.map((c) => c.type),
      ["hour", "minute", "dayPeriod"],
    );
    const [hours, minutes, periods] = columns;
    assert.equal(hours!.options[0]!.label, "12");
    assert.equal(hours!.selected, 1);
    assert.deepEqual(
      hours!.options.filter((o) => !o.disabled).map((o) => o.value),
      [12, 1, 2, 3, 4, 5],
    );
    assert.equal(minutes!.selected, 5);
    assert.deepEqual(
      minutes!.options.map((o) => o.value),
      [0, 15, 30, 45],
    );
    assert.equal(periods!.selected, 1);
    assert.ok(periods!.options.every((o) => !o.disabled));
    const late = timeColumns({ value: "17:00", cycle: "h23", min: "09:00", max: "17:00", seconds: true, secondStep: 30 });
    assert.equal(late.length, 3);
    assert.deepEqual(
      late[1]!.options.filter((o) => !o.disabled).map((o) => o.value),
      [0],
    );
    assert.deepEqual(
      late[2]!.options.map((o) => [o.value, o.disabled]),
      [
        [0, false],
        [30, true],
      ],
    );
    const lunch = timeColumns({ value: null, cycle: "h23", isTimeDisabled: (t) => t.startsWith("12:") });
    assert.ok(lunch[0]!.options.find((o) => o.value === 12)!.disabled);
    assert.equal(lunch[0]!.selected, null);
    const morning = timeColumns({ value: null, cycle: "h12", max: "11:59" });
    assert.ok(morning[2]!.options[1]!.disabled, "sin ninguna hora PM elegible, PM queda deshabilitado");
  });
  test("pickColumn conserva el resto de la hora y siembra lo que falta", () => {
    assert.equal(pickColumn("09:30", "hour", 11, "h12"), "11:30");
    assert.equal(pickColumn("21:30", "hour", 11, "h12"), "23:30");
    assert.equal(pickColumn("09:30", "dayPeriod", 1, "h12"), "21:30");
    assert.equal(pickColumn("21:30", "dayPeriod", 0, "h12"), "09:30");
    assert.equal(pickColumn("09:30", "minute", 45, "h23"), "09:45");
    assert.equal(pickColumn("09:30:10", "second", 20, "h23", true), "09:30:20");
    assert.equal(pickColumn(null, "minute", 15, "h23"), "00:15");
    assert.equal(pickColumn(null, "hour", 8, "h23", false, "10:45"), "08:45");
  });
  test("filtro de franjas: por etiqueta, en 12 h y en 24 h", () => {
    assert.equal(slotKey("9:30 a. m."), "930am");
    assert.ok(slotMatches("21:30", "9:30 PM", "93"));
    assert.ok(slotMatches("21:30", "9:30 PM", "930p"));
    assert.ok(slotMatches("21:30", "9:30 PM", "2130"));
    assert.ok(slotMatches("09:00", "09:00", ""));
    assert.ok(!slotMatches("09:00", "09:00", "1"));
  });
  test("revealOption desplaza solo la lista", () => {
    const list = { scrollTop: 0, clientTop: 0, clientHeight: 100 } as unknown as HTMLElement;
    const option = (top: number) => ({ offsetTop: top, offsetHeight: 20 }) as unknown as HTMLElement;
    revealOption(list, option(150));
    assert.equal(list.scrollTop, 70);
    revealOption(list, option(10));
    assert.equal(list.scrollTop, 10);
    revealOption(list, option(50));
    assert.equal(list.scrollTop, 10, "visible: no se mueve");
    revealOption(list, option(300), true);
    assert.equal(list.scrollTop, 260);
  });
});

describe("segments: orden y presentación", () => {
  test("orden y separadores del locale (formatToParts), solo para presentar", () => {
    assert.equal(order(fieldConfig({ locale: "en-US" })), "month/day/year");
    assert.equal(order(fieldConfig({ locale: "de" })), "day.month.year");
    assert.equal(order(fieldConfig({ locale: "ja" })), "year/month/day");
    assert.equal(order(fieldConfig({ locale: "en-US", granularity: "second" })), "month/day/year, hour:minute:second dayPeriod");
    assert.equal(order(fieldConfig({ locale: "en-GB", granularity: "hour" })), "day/month/year, hour");
    assert.equal(order(fieldConfig({ locale: "en-US", time: true })), "hour:minute dayPeriod");
    assert.equal(order(fieldConfig({ locale: "en-US", time: true, hourCycle: 24 })), "hour:minute");
    assert.equal(order(fieldConfig({ locale: "ko", time: true })), "dayPeriod hour:minute");
    const arabic = fieldConfig({ locale: "ar-EG" });
    assert.ok(!/[‎‏؜]/.test(order(arabic)), "sin marcas de dirección en los literales");
    assert.equal(arabic.digits(7, 2), "٠٧");
  });
  test("tipo de valor según la granularidad", () => {
    assert.equal(fieldConfig({}).kind, "date");
    assert.equal(fieldConfig({ granularity: "minute" }).kind, "datetime");
    assert.equal(fieldConfig({ time: true, granularity: "day" }).granularity, "minute");
    assert.equal(fieldConfig({ time: true, granularity: "second" }).kind, "time");
    assert.strictEqual(fieldConfig({ locale: "en-US" }), fieldConfig({ locale: "en-US" }), "configuración en caché");
  });
  test("valuesFrom y fieldValue son inversos; lo que no se entiende queda vacío", () => {
    const date = fieldConfig({ locale: "en-US" });
    assert.deepEqual(valuesFrom("2026-11-13", date), { month: 11, day: 13, year: 2026 });
    assert.equal(fieldValue(valuesFrom("2026-11-13", date), date), "2026-11-13");
    assert.deepEqual(valuesFrom("2026-02-30", date), {});
    assert.deepEqual(valuesFrom(null, date), {});
    const dt = fieldConfig({ locale: "en-US", granularity: "minute" });
    assert.equal(fieldValue(valuesFrom("2026-11-13T21:05", dt), dt), "2026-11-13T21:05");
    assert.equal(fieldValue(valuesFrom("2026-11-13 21:05:44", dt), dt), "2026-11-13T21:05");
    const hours = fieldConfig({ locale: "en-GB", granularity: "hour" });
    assert.equal(fieldValue(valuesFrom("2026-11-13T21:05", hours), hours), "2026-11-13T21:00");
    const time = fieldConfig({ locale: "en-GB", time: true, granularity: "second" });
    assert.equal(fieldValue(valuesFrom("21:05:09", time), time), "21:05:09");
    assert.equal(fieldValue({ hour: 1 }, time), null);
    assert.equal(fieldValue({ year: 2026, month: 2, day: 31 }, date), null);
  });
  test("límites de cada segmento", () => {
    const c = fieldConfig({ locale: "en-US", granularity: "minute" });
    assert.deepEqual(bounds("day", { month: 2, year: 2026 }, c), [1, 28]);
    assert.deepEqual(bounds("day", { month: 2 }, c), [1, 29]);
    assert.deepEqual(bounds("day", { month: 2 }, c, true), [1, 31]);
    assert.deepEqual(bounds("hour", {}, c), [1, 12]);
    assert.deepEqual(bounds("dayPeriod", {}, c), [0, 1]);
    assert.deepEqual(bounds("year", {}, c), [1, 9999]);
    assert.deepEqual(bounds("minute", {}, c), [0, 59]);
  });
  test("texto visible y texto para el lector", () => {
    const c = fieldConfig({ locale: "en-US", granularity: "minute" });
    const state: FieldState = { values: { year: 26, month: 3, day: 4, hour: 9, minute: 5, dayPeriod: 1 }, typed: null };
    assert.equal(segmentText("year", state, c), "0026");
    assert.equal(segmentText("month", state, c), "03");
    assert.equal(segmentText("dayPeriod", state, c), "PM");
    assert.equal(segmentText("second", state, c), null);
    assert.equal(segmentText("year", { ...state, typed: { type: "year", text: "26" } }, c), "26");
    assert.equal(segmentValueText("month", state, c), "03 – March");
    assert.equal(segmentValueText("hour", state, c), "09 PM");
    assert.equal(segmentValueText("day", { values: {}, typed: null }, c), null);
    const loose = fieldConfig({ locale: "en-US", forceLeadingZeros: false, granularity: "minute" });
    assert.equal(segmentText("month", state, loose), "3");
    assert.equal(segmentText("minute", state, loose), "05", "los minutos van siempre rellenos");
  });
  test("validez: vacío, incompleto, fecha que no existe, fuera de rango y válido", () => {
    const c = fieldConfig({ locale: "en-US", min: "2026-01-01", max: "2026-12-31" });
    assert.equal(validity({}, c), "empty");
    assert.equal(validity({ month: 2 }, c), "incomplete");
    assert.equal(validity({ year: 2026, month: 2, day: 31 }, c), "invalid");
    assert.equal(validity({ year: 2027, month: 2, day: 1 }, c), "outOfRange");
    assert.equal(validity({ year: 2026, month: 2, day: 1 }, c), "valid");
    assert.ok(isEmpty({}) && !isEmpty({ day: 1 }) && isComplete({ year: 1, month: 1, day: 1 }, c));
    const dt = fieldConfig({ granularity: "minute", min: "2026-11-13", max: "2026-11-13T18:00" });
    assert.ok(inBounds("2026-11-13T00:00", dt) && inBounds("2026-11-13T18:00", dt));
    assert.ok(!inBounds("2026-11-12T23:59", dt) && !inBounds("2026-11-13T18:01", dt));
    const night = fieldConfig({ time: true, min: "22:00", max: "02:00" });
    assert.ok(inBounds("23:00", night) && !inBounds("12:00", night));
    const bad = fieldConfig({ min: "nope", max: "2026-13-01" });
    assert.equal(bad.min, null);
    assert.equal(bad.max, null);
    assert.equal(fieldConfig({ granularity: "minute", min: "2026-01-01T25:00" }).min, null);
    assert.equal(fieldConfig({ time: true, min: "25:00" }).min, null);
  });
  test("firstEditable: el primer segmento vacío", () => {
    const c = fieldConfig({ locale: "en-US" });
    assert.equal(firstEditable({}, c), 0);
    assert.equal(firstEditable({ month: 1 }, c), 1);
    assert.equal(firstEditable({ month: 1, day: 1, year: 1 }, c), 0);
  });
});

describe("segments: teclado de spinbutton", () => {
  const date = fieldConfig({ locale: "en-US", placeholderValue: "2026-11-13" });
  test("flechas con ciclo, RePág/AvPág e Inicio/Fin", () => {
    const at = (values: Values, type: SegmentType, key: string) => keys(date, { values, typed: null }, [[type, key]]).state.values[type];
    assert.equal(at({ month: 12 }, "month", "ArrowUp"), 1);
    assert.equal(at({ month: 1 }, "month", "ArrowDown"), 12);
    assert.equal(at({ month: 11 }, "month", "PageUp"), 2);
    assert.equal(at({ year: 2026 }, "year", "PageDown"), 2016);
    assert.equal(at({ year: 9999 }, "year", "ArrowUp"), 1);
    assert.equal(at({ day: 28, month: 2, year: 2026 }, "day", "ArrowUp"), 1, "28 de febrero sube a 1");
    assert.equal(at({ day: 31, month: 2, year: 2026 }, "day", "ArrowDown"), 27, "un día imposible baja desde el máximo");
    assert.equal(at({ day: 5, month: 4 }, "day", "End"), 30);
    assert.equal(at({ day: 5 }, "day", "Home"), 1);
    assert.equal(at({}, "month", "ArrowUp"), 11, "vacío: siembra placeholderValue");
    assert.equal(at({}, "year", "ArrowDown"), 2026);
  });
  test("pasos de minuto y segundo, alineados al paso", () => {
    const c = fieldConfig({ locale: "en-GB", time: true, granularity: "second", minuteStep: 15, secondStep: 10 });
    const at = (values: Values, type: SegmentType, key: string) => keys(c, { values, typed: null }, [[type, key]]).state.values[type];
    assert.equal(at({ minute: 45 }, "minute", "ArrowUp"), 0);
    assert.equal(at({ minute: 0 }, "minute", "ArrowDown"), 45);
    assert.equal(at({ minute: 7 }, "minute", "ArrowUp"), 15);
    assert.equal(at({ minute: 7 }, "minute", "ArrowDown"), 0);
    assert.equal(at({ minute: 0 }, "minute", "PageUp"), 15);
    assert.equal(at({ minute: 0 }, "minute", "End"), 45);
    assert.equal(at({ second: 50 }, "second", "ArrowUp"), 0);
    assert.equal(at({}, "minute", "ArrowUp"), 0);
    assert.equal(at({ hour: 23 }, "hour", "ArrowUp"), 0);
    assert.equal(at({}, "hour", "ArrowUp"), 0, "vacío: 00");
    const h12 = fieldConfig({ locale: "en-US", time: true });
    assert.equal(keys(h12, empty(), [["hour", "ArrowUp"]]).state.values.hour, 12, "vacío en 12 h: 12 (medianoche)");
    assert.equal(keys(h12, { values: { dayPeriod: 0 }, typed: null }, [["dayPeriod", "ArrowUp"]]).state.values.dayPeriod, 1);
    assert.equal(keys(h12, { values: { dayPeriod: 1 }, typed: null }, [["dayPeriod", "PageDown"]]).state.values.dayPeriod, 0);
  });
  test("dígitos: escriben y avanzan al completar o cuando no cabe otra cifra", () => {
    let run = keys(date, empty(), [["month", "1"]]);
    assert.equal(run.focus, undefined);
    assert.deepEqual(run.state.typed, { type: "month", text: "1" });
    run = keys(date, run.state, [["month", "2"]]);
    assert.equal(run.focus, "next");
    assert.equal(run.state.values.month, 12);
    assert.equal(keys(date, empty(), [["month", "3"]]).focus, "next", "3 no admite segunda cifra");
    assert.equal(
      keys(date, empty(), [
        ["month", "1"],
        ["month", "5"],
      ]).state.values.month,
      5,
      "15 no cabe: vuelve a empezar",
    );
    const zero = keys(date, empty(), [["month", "0"]]);
    assert.equal(zero.state.values.month, undefined);
    assert.equal(zero.state.typed?.text, "0");
    assert.equal(keys(date, zero.state, [["month", "0"]]).state, zero.state, "00 no se escribe");
    assert.equal(keys(date, zero.state, [["month", "7"]]).state.values.month, 7);
    run = keys(date, empty(), [
      ["year", "2"],
      ["year", "0"],
      ["year", "2"],
    ]);
    assert.equal(run.focus, undefined);
    run = keys(date, run.state, [["year", "6"]]);
    assert.equal(run.state.values.year, 2026);
    assert.equal(run.focus, "next");
    assert.equal(
      keys(date, empty(), [
        ["day", "3"],
        ["day", "1"],
      ]).state.values.day,
      31,
      "31 se acepta al teclear",
    );
    assert.equal(keys(date, empty(), [["year", "٢"]]).state.values.year, 2, "dígitos de otros sistemas");
  });
  test("AM/PM con a y p (y la inicial del locale), los dígitos no cuentan", () => {
    const en = fieldConfig({ locale: "en-US", time: true });
    assert.equal(keys(en, empty(), [["dayPeriod", "p"]]).state.values.dayPeriod, 1);
    assert.equal(keys(en, empty(), [["dayPeriod", "A"]]).state.values.dayPeriod, 0);
    assert.deepEqual(keys(en, empty(), [["dayPeriod", "x"]]).state.values, {});
    assert.deepEqual(keys(en, empty(), [["dayPeriod", "1"]]).state.values, {});
    const ko = fieldConfig({ locale: "ko", time: true });
    assert.equal(keys(ko, empty(), [["dayPeriod", "p"]]).state.values.dayPeriod, 1);
  });
  test("Retroceso y Supr vacían; con el segmento vacío, Retroceso vuelve al anterior", () => {
    const filled: FieldState = { values: { month: 3, day: 4 }, typed: null };
    const cleared = keys(date, filled, [["day", "Backspace"]]);
    assert.deepEqual(cleared.state.values, { month: 3 });
    assert.equal(cleared.focus, undefined);
    assert.equal(keys(date, cleared.state, [["day", "Backspace"]]).focus, "prev");
    assert.equal(keys(date, cleared.state, [["day", "Delete"]]).focus, undefined);
    assert.deepEqual(keys(date, filled, [["month", "Delete"]]).state.values, { day: 4 });
    const typing = keys(date, empty(), [["month", "0"]]).state;
    assert.equal(keys(date, typing, [["month", "Backspace"]]).state.typed, null, "lo tecleado también se borra");
  });
  test("flechas laterales, solo lectura y teclas ajenas", () => {
    assert.equal(segmentKey(empty(), "day", "ArrowLeft", date).focus, "prev");
    assert.equal(segmentKey(empty(), "day", "ArrowRight", date).focus, "next");
    const filled: FieldState = { values: { month: 3 }, typed: null };
    for (const key of ["ArrowUp", "5", "Backspace"]) assert.equal(segmentKey(filled, "month", key, date, true).state, filled, key);
    assert.equal(segmentKey(filled, "month", "x", date).handled, true, "un carácter no se escribe");
    assert.equal(segmentKey(filled, "month", "F5", date).handled, false);
    assert.equal(segmentKey(filled, "month", "Tab", date).handled, false);
  });
  test("digitOf", () => {
    assert.equal(digitOf("7"), 7);
    assert.equal(digitOf("٧"), 7);
    assert.equal(digitOf("７"), 7);
    assert.equal(digitOf("७"), 7);
    assert.equal(digitOf("x"), null);
    assert.equal(digitOf("12"), null);
  });
});

describe("segments: pegar", () => {
  test("ISO y formato del locale; una fecha que no existe o un texto cualquiera no se pegan", () => {
    const us = fieldConfig({ locale: "en-US" });
    assert.deepEqual(parsePasted("2026-11-13", us), { month: 11, day: 13, year: 2026 });
    assert.deepEqual(parsePasted(" 11/13/2026 ", us), { month: 11, day: 13, year: 2026 });
    assert.equal(parsePasted("2026-02-30", us), null);
    assert.equal(parsePasted("13/13/2026", us), null);
    assert.equal(parsePasted("hello", us), null);
    assert.equal(parsePasted("", us), null);
    assert.equal(parsePasted("11/13/12345", us), null);
    assert.deepEqual(parsePasted("2026-11-13T09:30", us), { month: 11, day: 13, year: 2026 }, "en un campo de fecha, solo la fecha");
    const de = fieldConfig({ locale: "de" });
    assert.deepEqual(parsePasted("13.11.2026", de), { day: 13, month: 11, year: 2026 });
    const ar = fieldConfig({ locale: "ar-EG" });
    assert.equal(fieldValue(parsePasted("١٣/١١/٢٠٢٦", ar)!, ar), "2026-11-13");
  });
  test("fecha y hora, 12 h con AM/PM y solo hora", () => {
    const dt = fieldConfig({ locale: "en-US", granularity: "minute" });
    assert.equal(fieldValue(parsePasted("11/13/2026, 9:30 PM", dt)!, dt), "2026-11-13T21:30");
    assert.equal(fieldValue(parsePasted("2026-11-13T09:30", dt)!, dt), "2026-11-13T09:30");
    assert.deepEqual(parsePasted("11/13/2026", dt), { month: 11, day: 13, year: 2026 }, "solo la fecha: la hora queda como estaba");
    assert.equal(parsePasted("11/13/2026 13:30 PM", dt), null);
    assert.equal(parsePasted("2026-11-13T25:00", dt), null);
    const time = fieldConfig({ locale: "en-US", time: true });
    assert.equal(fieldValue(parsePasted("21:05", time)!, time), "21:05");
    assert.equal(fieldValue(parsePasted("9:05 pm", time)!, time), "21:05");
    assert.equal(fieldValue(parsePasted("12:00 AM", time)!, time), "00:00");
    assert.equal(parsePasted("25:00", time), null);
    assert.equal(parsePasted("noon", time), null);
    const gb = fieldConfig({ locale: "en-GB", time: true, granularity: "second" });
    assert.equal(fieldValue(parsePasted("21:05:09", gb)!, gb), "21:05:09");
    assert.equal(fieldValue(parsePasted("21.05.09", gb)!, gb), "21:05:09");
  });
});

/* ---------- Propiedades ---------- */

const LOCALES = ["en-US", "en-GB", "de", "es", "ja", "ko", "ar-EG", "he", "fr"];
const CYCLES: HourCycle[] = ["h11", "h12", "h23", "h24"];
const isoDate = fc
  .tuple(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 0, max: 11 }), fc.integer({ min: 1, max: 31 }))
  .map(([y, m, d]) => {
    const date = new Date(0);
    date.setUTCFullYear(y, m, Math.min(d, daysInMonth(y, m)));
    return format(date);
  });
const isoTime = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }), fc.integer({ min: 0, max: 59 }))
  .map(([hour, minute, second]) => formatTime({ hour, minute, second }, true));
const SEGMENTS: SegmentType[] = ["year", "month", "day", "hour", "minute", "second", "dayPeriod"];

describe("propiedades: DateField y TimeField", () => {
  test("cualquier fecha y hora, en cualquier locale y ciclo, se lee y se escribe igual", () => {
    fc.assert(
      fc.property(isoDate, isoTime, fc.constantFrom(...LOCALES), fc.constantFrom(12, 24), (date, time, locale, hourCycle) => {
        const c = fieldConfig({ locale, granularity: "second", hourCycle: hourCycle as 12 | 24 });
        assert.equal(fieldValue(valuesFrom(`${date}T${time}`, c), c), `${date}T${time}`);
        const t = fieldConfig({ locale, time: true, hourCycle: hourCycle as 12 | 24 });
        assert.equal(fieldValue(valuesFrom(time, t), t), time.slice(0, 5));
      }),
      { numRuns: 200 },
    );
  });
  test("la hora mostrada en cualquier ciclo vuelve a la misma hora de 24 h", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 23 }), fc.constantFrom(...CYCLES), (hour, cycle) => {
        const shown = toDisplayHour(hour, cycle);
        const [lo, hi] = hourBounds(cycle);
        assert.ok(shown.hour >= lo && shown.hour <= hi);
        assert.equal(fromDisplayHour(shown.hour, shown.period, cycle), hour);
      }),
    );
  });
  test("ninguna secuencia de teclas deja un segmento fuera de sus límites ni rompe el estado", () => {
    const c = fieldConfig({ locale: "en-US", granularity: "second", minuteStep: 5 });
    const key = fc.constantFrom(
      "0",
      "1",
      "2",
      "3",
      "5",
      "9",
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      "Backspace",
      "Delete",
      "a",
      "p",
      "x",
    );
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom(...SEGMENTS), key), { maxLength: 40 }), (steps) => {
        const { state } = keys(c, empty(), steps as Array<[SegmentType, string]>);
        for (const type of SEGMENTS) {
          const value = state.values[type];
          if (value === undefined) continue;
          const [lo, hi] = bounds(type, {}, c, true);
          assert.ok(Number.isInteger(value) && value >= lo && value <= hi, `${type}=${value}`);
        }
        const iso = fieldValue(state.values, c);
        if (iso !== null) assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      }),
    );
  });
  test("flecha arriba y flecha abajo se anulan en un valor alineado al paso", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SegmentType>("year", "month", "hour", "minute", "second"),
        fc.integer({ min: 0, max: 9999 }),
        fc.constantFrom(1, 5, 15),
        (type, raw, step) => {
          const c = fieldConfig({ locale: "en-GB", granularity: "second", minuteStep: step, secondStep: step });
          const [lo, hi] = bounds(type, {}, c);
          const s = type === "minute" || type === "second" ? step : 1;
          const value = lo + Math.floor((raw % (hi - lo + 1)) / s) * s;
          const up = keys(c, { values: { [type]: value }, typed: null }, [[type, "ArrowUp"]]).state;
          assert.equal(keys(c, up, [[type, "ArrowDown"]]).state.values[type], value);
        },
      ),
    );
  });
  test("pegar una fecha ISO la rellena entera; ningún texto hace fallar el pegado", () => {
    fc.assert(
      fc.property(isoDate, fc.constantFrom(...LOCALES), (date, locale) => {
        const c = fieldConfig({ locale });
        assert.equal(fieldValue(parsePasted(date, c)!, c), date);
      }),
    );
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), fc.constantFrom(...LOCALES), fc.boolean(), (text, locale, time) => {
        const c = fieldConfig({ locale, time, granularity: time ? "minute" : "minute" });
        const pasted = parsePasted(text, c);
        if (pasted) for (const [type, value] of Object.entries(pasted)) assert.ok(Number.isInteger(value), type);
      }),
    );
  });
  test("una franja que cruza la medianoche admite justo lo que la franja normal deja fuera", () => {
    fc.assert(
      fc.property(isoTime, isoTime, isoTime, (t, a, b) => {
        fc.pre(a !== b);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const inside = inTimeRange(t, lo, hi);
        const night = inTimeRange(t, hi, lo);
        // Los extremos pertenecen a las dos franjas; el resto, solo a una.
        if (t === lo || t === hi) assert.ok(inside && night);
        else assert.notEqual(inside, night);
      }),
    );
  });
  test("las franjas quedan dentro de min/max, sin repetir y separadas por el paso", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 240 }), fc.option(isoTime), fc.option(isoTime), (step, min, max) => {
        const slots = timeSlots(step, min, max);
        assert.equal(new Set(slots).size, slots.length);
        for (const slot of slots) assert.ok(validTime(slot) && inTimeRange(slot, min, max), slot);
        const minutes = slots.map((s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3)));
        for (let i = 1; i < minutes.length; i++) assert.equal(((minutes[i]! - minutes[i - 1]! + 1440) % 1440) % step, 0);
      }),
      { numRuns: 150 },
    );
  });
});
