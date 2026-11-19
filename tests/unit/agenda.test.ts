// Agenda: zonas horarias (con y sin Temporal), RRULE, solapes, carriles, partir por días, mover y redimensionar, y
// navegación espacial. Propiedades con fast-check donde las hay.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  _setTemporal,
  deviceTimeZone,
  fromWall,
  instantText,
  offsetAt,
  parseDateTime,
  safeTimeZone,
  toWall,
  validTimeZone,
  wallStatus,
  wallText,
  zoneCity,
  zoneLabel,
} from "../../zui/src/core/zone.ts";
import { expandDates, formatRRule, parseRRule } from "../../zui/src/core/rrule.ts";
import {
  canEdit,
  clockMinutes,
  clockText,
  dateOf,
  dayStart,
  eventSpan,
  expandEvents,
  layoutRow,
  layoutTimed,
  minuteOfDay,
  moveSpan,
  nowIn,
  overlaps,
  resizeSpan,
  rewriteSpan,
  shiftDate,
  slotAt,
  snap,
  splitByDay,
  visibleDays,
  type CalendarEvent,
} from "../../zui/src/core/agenda.ts";
import { arrowDirection, nextInDirection } from "../../zui/src/core/spatial.ts";

const MAD = "Europe/Madrid";
const NY = "America/New_York";
const ZONES = [MAD, NY, "Australia/Lord_Howe", "Asia/Kolkata", "Pacific/Apia", "UTC"];
const wall = (date: string, hour: number, minute = 0, second = 0) => ({ date, hour, minute, second });

describe("zone: instante ↔ reloj", () => {
  for (const temporal of [true, false]) {
    describe(temporal ? "con Temporal" : "sin Temporal (Intl)", () => {
      test("reloj de una zona y desfase", () => {
        _setTemporal(temporal);
        const ms = Date.parse("2026-11-19T09:00:00Z");
        assert.deepEqual(toWall(ms, MAD), wall("2026-11-19", 10));
        assert.deepEqual(toWall(ms, NY), wall("2026-11-19", 4));
        assert.deepEqual(toWall(ms, "Asia/Kolkata"), wall("2026-11-19", 14, 30));
        assert.equal(offsetAt(ms, MAD), 60);
        assert.equal(offsetAt(Date.parse("2026-07-01T00:00:00Z"), MAD), 120);
        assert.equal(offsetAt(ms, "Australia/Lord_Howe"), 660, "DST de 30 minutos (+11:00 en verano austral)");
        _setTemporal(true);
      });
      test("hora que no existe (29 de marzo en Madrid) y hora repetida (25 de octubre)", () => {
        _setTemporal(temporal);
        const gap = wall("2026-03-29", 2, 30);
        assert.equal(wallStatus(gap, MAD), "gap");
        assert.equal(instantText(fromWall(gap, MAD)!), "2026-03-29T01:30:00Z", "compatible: avanza (03:30 local)");
        assert.equal(instantText(fromWall(gap, MAD, "earlier")!), "2026-03-29T00:30:00Z");
        assert.equal(fromWall(gap, MAD, "reject"), null);
        const twice = wall("2026-10-25", 2, 30);
        assert.equal(wallStatus(twice, MAD), "overlap");
        assert.equal(instantText(fromWall(twice, MAD)!), "2026-10-25T00:30:00Z", "compatible: la primera");
        assert.equal(instantText(fromWall(twice, MAD, "later")!), "2026-10-25T01:30:00Z");
        assert.equal(fromWall(twice, MAD, "reject"), null);
        assert.equal(wallStatus(wall("2026-11-19", 10), MAD), "ok");
        // Lord Howe: salto de media hora el 4 de octubre de 2026 a las 02:00 → 02:30.
        assert.equal(wallStatus(wall("2026-10-04", 2, 15), "Australia/Lord_Howe"), "gap");
        _setTemporal(true);
      });
    });
  }
  test("propiedad: las dos rutas (Temporal e Intl) dan lo mismo, ida y vuelta", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.parse("1990-01-01T00:00:00Z"), max: Date.parse("2040-01-01T00:00:00Z") }),
        fc.constantFrom(...ZONES),
        (ms0, tz) => {
          const ms = Math.floor(ms0 / 1000) * 1000;
          _setTemporal(true);
          const a = toWall(ms, tz);
          const ta = fromWall(a, tz, "compatible");
          const tl = fromWall(a, tz, "later");
          _setTemporal(false);
          const b = toWall(ms, tz);
          const tb = fromWall(b, tz, "compatible");
          const tl2 = fromWall(b, tz, "later");
          _setTemporal(true);
          assert.deepEqual(a, b);
          assert.equal(ta, tb);
          assert.equal(tl, tl2);
          // El instante original es una de las lecturas del reloj (la primera o la segunda si se repite).
          assert.ok(ta === ms || tl === ms);
        },
      ),
      { numRuns: 400 },
    );
  });
  test("propiedad: un reloj que no existe se resuelve hacia delante, igual en las dos rutas", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 59 }), fc.constantFrom("2026-03-29", "2027-03-28"), (minute, date) => {
        const w = wall(date, 2, minute);
        _setTemporal(true);
        const a = fromWall(w, MAD);
        _setTemporal(false);
        const b = fromWall(w, MAD);
        _setTemporal(true);
        assert.equal(a, b);
        assert.deepEqual(toWall(a!, MAD), wall(date, 3, minute));
      }),
    );
  });
  test("texto y zonas", () => {
    assert.deepEqual(parseDateTime("2026-11-19T10:00"), { wall: wall("2026-11-19", 10), offset: null });
    assert.equal(parseDateTime("2026-11-19T10:00:30+05:30")?.offset, 330);
    assert.equal(parseDateTime("2026-11-19T10:00-0300")?.offset, -180);
    assert.equal(parseDateTime("2026-11-19T25:00"), null);
    assert.equal(parseDateTime("nope"), null);
    assert.equal(wallText(wall("2026-11-19", 9, 5)), "2026-11-19T09:05");
    assert.equal(wallText(wall("2026-11-19", 9, 5, 7)), "2026-11-19T09:05:07");
    assert.ok(validTimeZone(MAD));
    assert.ok(!validTimeZone("Mars/Base"));
    assert.ok(!validTimeZone(""));
    assert.equal(safeTimeZone("Mars/Base"), deviceTimeZone());
    assert.equal(zoneCity("America/New_York"), "New York");
    assert.match(zoneLabel(MAD, Date.parse("2026-11-19T09:00:00Z"), "en-US"), /GMT\+1/);
    assert.equal(zoneLabel("Mars/Base", 0), "Mars/Base");
    _setTemporal(false);
    assert.deepEqual(toWall(Date.parse("0001-06-01T00:00:00Z"), "UTC").date, "0001-06-01");
    _setTemporal(true);
  });
});

describe("rrule: subconjunto de RFC 5545", () => {
  const ex = (rule: string, start: string, from: string, to: string, opts = {}) => expandDates(parseRRule(rule)!, start, from, to, opts);
  test("análisis", () => {
    assert.deepEqual(parseRRule("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10"), {
      freq: "WEEKLY",
      interval: 2,
      wkst: 1,
      count: 10,
      byDay: [{ day: 1 }, { day: 3 }],
    });
    assert.deepEqual(parseRRule("FREQ=MONTHLY;BYDAY=-1FR")?.byDay, [{ day: 5, n: -1 }]);
    assert.equal(parseRRule("FREQ=YEARLY;UNTIL=20301231T235959Z")?.until, "2030-12-31T23:59:59Z");
    assert.equal(parseRRule("FREQ=DAILY;UNTIL=20301231")?.until, "2030-12-31");
    assert.deepEqual(parseRRule("FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO")?.unsupported, ["BYSETPOS"]);
    assert.deepEqual(parseRRule("FREQ=HOURLY")?.unsupported, ["FREQ=HOURLY"]);
    assert.equal(parseRRule("BYDAY=MO"), null);
    assert.equal(parseRRule(null), null);
    assert.equal(parseRRule("FREQ=WEEKLY;WKST=SU")?.wkst, 0);
    assert.equal(
      formatRRule(parseRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10;WKST=SU")!),
      "FREQ=WEEKLY;INTERVAL=2;COUNT=10;BYDAY=MO,WE;WKST=SU",
    );
    assert.equal(
      formatRRule({ freq: "MONTHLY", interval: 1, byMonthDay: [-1], until: "2027-01-01" }),
      "FREQ=MONTHLY;UNTIL=20270101;BYMONTHDAY=-1",
    );
  });
  test("diario, semanal con intervalo, COUNT y UNTIL (RFC 5545 §3.8.5.3)", () => {
    assert.deepEqual(ex("FREQ=DAILY;COUNT=3", "2026-11-19", "2026-11-01", "2026-12-31"), ["2026-11-19", "2026-11-20", "2026-11-21"]);
    assert.deepEqual(ex("FREQ=DAILY;INTERVAL=10;COUNT=3", "2026-01-01", "2026-01-01", "2026-12-31"), [
      "2026-01-01",
      "2026-01-11",
      "2026-01-21",
    ]);
    assert.deepEqual(ex("FREQ=WEEKLY;UNTIL=20261210", "2026-11-19", "2026-11-01", "2027-01-31"), [
      "2026-11-19",
      "2026-11-26",
      "2026-12-03",
      "2026-12-10",
    ]);
    // Cada dos semanas lunes y miércoles desde un miércoles (WKST=MO).
    assert.deepEqual(ex("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE", "2026-11-18", "2026-11-01", "2026-12-10"), [
      "2026-11-18",
      "2026-11-30",
      "2026-12-02",
    ]);
    // Días laborables.
    assert.equal(ex("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "2026-11-16", "2026-11-16", "2026-11-29").length, 10);
    assert.deepEqual(ex("FREQ=DAILY;BYMONTH=1", "2026-12-30", "2026-12-28", "2027-01-03"), [
      "2026-12-30",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
  test("mensual: BYMONTHDAY negativo, día 31 que se salta, ordinales", () => {
    assert.deepEqual(ex("FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=4", "2026-01-31", "2026-01-01", "2026-12-31"), [
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    assert.deepEqual(ex("FREQ=MONTHLY;COUNT=4", "2026-01-31", "2026-01-01", "2026-12-31"), [
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
      "2026-07-31",
    ]);
    assert.deepEqual(ex("FREQ=MONTHLY;BYDAY=2TU;COUNT=3", "2026-11-10", "2026-01-01", "2027-12-31"), [
      "2026-11-10",
      "2026-12-08",
      "2027-01-12",
    ]);
    assert.deepEqual(ex("FREQ=MONTHLY;BYDAY=-1FR;COUNT=2", "2026-11-27", "2026-01-01", "2027-12-31"), ["2026-11-27", "2026-12-25"]);
    // Viernes 13 (BYDAY y BYMONTHDAY se cruzan).
    assert.deepEqual(ex("FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13;COUNT=3", "2026-02-13", "2026-01-01", "2030-12-31"), [
      "2026-02-13",
      "2026-03-13",
      "2026-11-13",
    ]);
    assert.deepEqual(ex("FREQ=MONTHLY;BYMONTH=6,12;BYMONTHDAY=1", "2026-06-01", "2026-01-01", "2027-06-30"), [
      "2026-06-01",
      "2026-12-01",
      "2027-06-01",
    ]);
  });
  test("anual: 29 de febrero, BYMONTH con ordinal, ordinal en el año", () => {
    assert.deepEqual(ex("FREQ=YEARLY;COUNT=3", "2024-02-29", "2024-01-01", "2040-12-31"), ["2024-02-29", "2028-02-29", "2032-02-29"]);
    assert.deepEqual(ex("FREQ=YEARLY;BYMONTH=11;BYDAY=4TH;COUNT=3", "2026-11-26", "2026-01-01", "2030-12-31"), [
      "2026-11-26",
      "2027-11-25",
      "2028-11-23",
    ]);
    assert.deepEqual(ex("FREQ=YEARLY;BYDAY=1MO;COUNT=2", "2026-01-05", "2026-01-01", "2030-12-31"), ["2026-01-05", "2027-01-04"]);
    assert.equal(ex("FREQ=YEARLY;BYMONTHDAY=1", "2026-01-01", "2026-01-01", "2026-12-31").length, 12);
  });
  test("UNTIL con hora en UTC frente al reloj de la serie; no admitida: solo la primera", () => {
    const toWallMad = (until: string) => wallText(toWall(Date.parse(until), MAD), true);
    assert.deepEqual(
      ex("FREQ=DAILY;UNTIL=20261121T080000Z", "2026-11-19", "2026-11-01", "2026-11-30", { time: "09:00", untilToWall: toWallMad }),
      ["2026-11-19", "2026-11-20", "2026-11-21"],
      "08:00Z = 09:00 en Madrid: el día 21 entra",
    );
    assert.deepEqual(
      ex("FREQ=DAILY;UNTIL=20261121T075959Z", "2026-11-19", "2026-11-01", "2026-11-30", { time: "09:00", untilToWall: toWallMad }),
      ["2026-11-19", "2026-11-20"],
    );
    assert.deepEqual(ex("FREQ=HOURLY", "2026-11-19", "2026-11-01", "2026-11-30"), ["2026-11-19"]);
    assert.deepEqual(ex("FREQ=DAILY", "nope", "2026-11-01", "2026-11-30"), []);
    assert.deepEqual(ex("FREQ=DAILY;COUNT=1", "2026-11-19", "2026-11-01", "2026-11-30"), ["2026-11-19"]);
    assert.equal(ex("FREQ=DAILY", "2026-01-01", "2026-01-01", "2030-12-31", { limit: 10 }).length, 10);
  });
  test("propiedad: semanal sin BYDAY = cada 7·INTERVAL días; todas en rango y en orden", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3000 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 40 }),
        (offset, interval, count) => {
          const start = dateOf(dayStart("2020-01-01") + offset * 1440);
          const dates = expandDates(parseRRule(`FREQ=WEEKLY;INTERVAL=${interval};COUNT=${count}`)!, start, "2000-01-01", "2040-12-31");
          assert.equal(dates.length, count);
          for (const [i, d] of dates.entries()) assert.equal(d, dateOf(dayStart(start) + i * 7 * interval * 1440));
        },
      ),
    );
  });
  test("propiedad: expandir por trozos da lo mismo que de una vez", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "FREQ=DAILY;INTERVAL=3",
          "FREQ=WEEKLY;BYDAY=MO,FR",
          "FREQ=MONTHLY;BYMONTHDAY=-1",
          "FREQ=MONTHLY;BYDAY=2WE",
          "FREQ=YEARLY",
        ),
        fc.integer({ min: 1, max: 700 }),
        (text, cut) => {
          const rule = parseRRule(text)!;
          const all = expandDates(rule, "2026-01-07", "2026-01-01", "2028-12-31");
          const mid = dateOf(dayStart("2026-01-01") + cut * 1440);
          const a = expandDates(rule, "2026-01-07", "2026-01-01", mid);
          const b = expandDates(rule, "2026-01-07", dateOf(dayStart(mid) + 1440), "2028-12-31");
          assert.deepEqual([...a, ...b], all);
        },
      ),
    );
  });
});

const ev = (over: Partial<CalendarEvent> & Pick<CalendarEvent, "id" | "start" | "end">): CalendarEvent => ({
  title: over.id,
  calendarId: "work",
  ...over,
});

describe("agenda: eventos en el tiempo", () => {
  test("minutos de pared, reloj y días", () => {
    const d = dayStart("2026-11-19");
    assert.equal(dateOf(d + 600), "2026-11-19");
    assert.equal(minuteOfDay(d + 615), 615);
    assert.equal(minuteOfDay(-5), 1435);
    assert.equal(clockMinutes("24:00"), 1440);
    assert.equal(clockMinutes("8:30"), 510);
    assert.equal(clockMinutes("nope", 7), 7);
    assert.equal(clockMinutes("25:00", 0), 0);
    assert.equal(clockText(615), "10:15");
  });
  test("formas del tiempo: todo el día, zona, flotante, instante", () => {
    const tz = MAD;
    assert.deepEqual(eventSpan(ev({ id: "a", start: "2026-11-19", end: "2026-11-20" }), tz), {
      start: dayStart("2026-11-19"),
      end: dayStart("2026-11-20"),
      allDay: true,
      ambiguous: false,
    });
    const ny = eventSpan(ev({ id: "b", start: "2026-11-19T10:00", end: "2026-11-19T11:00", timeZone: NY }), tz)!;
    assert.equal(minuteOfDay(ny.start), 16 * 60, "10:00 en Nueva York son las 16:00 en Madrid");
    const floating = eventSpan(ev({ id: "c", start: "2026-11-19T09:00", end: "2026-11-19T09:30" }), NY)!;
    assert.equal(minuteOfDay(floating.start), 9 * 60, "flotante: misma hora en cualquier zona");
    const z = eventSpan(ev({ id: "d", start: "2026-11-19T09:00:00Z", end: "2026-11-19T10:00:00+01:00" }), tz)!;
    assert.equal(minuteOfDay(z.start), 600);
    assert.equal(z.end - z.start, 0);
    assert.equal(eventSpan(ev({ id: "e", start: "2026-11-19", end: "" }), tz)!.end, dayStart("2026-11-20"), "todo el día sin fin: un día");
    assert.equal(eventSpan(ev({ id: "f", start: "nope", end: "nope" }), tz), null);
    const rep = eventSpan(ev({ id: "g", start: "2026-10-25T00:30:00Z", end: "2026-10-25T01:00:00Z" }), tz)!;
    assert.ok(rep.ambiguous, "02:30 del 25 de octubre en Madrid se repite");
    assert.equal(
      eventSpan(ev({ id: "h", start: "2026-11-19T10:00", end: "2026-11-19T09:00" }), tz)!.end,
      eventSpan(ev({ id: "h", start: "2026-11-19T10:00", end: "2026-11-19T09:00" }), tz)!.start,
    );
  });
  test("expandir: rango, series con excepción y exdate, ocultos y cancelados", () => {
    const events: CalendarEvent[] = [
      ev({
        id: "standup",
        start: "2026-11-16T09:00",
        end: "2026-11-16T09:15",
        timeZone: MAD,
        rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
        exdate: ["2026-11-18"],
      }),
      ev({
        id: "moved",
        seriesId: "standup",
        recurrenceId: "2026-11-19T09:00",
        start: "2026-11-19T09:30",
        end: "2026-11-19T09:45",
        timeZone: MAD,
      }),
      ev({ id: "trip", start: "2026-11-14", end: "2026-11-17", calendarId: "travel" }),
      ev({ id: "gone", start: "2026-11-17T12:00", end: "2026-11-17T13:00", status: "cancelled" }),
      ev({ id: "private", start: "2026-11-17T12:00", end: "2026-11-17T13:00", calendarId: "secret" }),
      ev({ id: "later", start: "2026-12-17T12:00", end: "2026-12-17T13:00" }),
      ev({ id: "zero", start: "2026-11-22T00:00", end: "2026-11-22T00:00" }),
    ];
    const occ = expandEvents({ events, from: "2026-11-16", to: "2026-11-22", timeZone: MAD, hidden: ["secret"] });
    assert.deepEqual(
      occ.map((o) => o.key),
      ["trip", "standup::2026-11-16T09:00", "standup::2026-11-17T09:00", "moved", "standup::2026-11-20T09:00", "zero"],
    );
    assert.equal(occ[1]!.seriesId, "standup");
    assert.equal(occ[3]!.seriesId, "standup");
    assert.equal(occ[1]!.startText, "2026-11-16T09:00");
    // La serie sigue a las 09:00 de Madrid tras el cambio de hora, aunque se mire desde Nueva York.
    const spring = expandEvents({
      events: [ev({ id: "s", start: "2026-03-27T09:00", end: "2026-03-27T10:00", timeZone: MAD, rrule: "FREQ=DAILY;COUNT=3" })],
      from: "2026-03-27",
      to: "2026-03-29",
      timeZone: MAD,
    });
    assert.deepEqual(
      spring.map((o) => minuteOfDay(o.start)),
      [540, 540, 540],
    );
    const fromNY = expandEvents({
      events: [ev({ id: "s", start: "2026-03-27T09:00", end: "2026-03-27T10:00", timeZone: MAD, rrule: "FREQ=DAILY;COUNT=3" })],
      from: "2026-03-27",
      to: "2026-03-29",
      timeZone: NY,
    });
    assert.deepEqual(
      fromNY.map((o) => clockText(minuteOfDay(o.start))),
      ["04:00", "04:00", "03:00"],
    );
    // Serie de varios días que empieza antes del rango.
    const long = expandEvents({
      events: [ev({ id: "w", start: "2026-11-01", end: "2026-11-04", rrule: "FREQ=WEEKLY" })],
      from: "2026-11-16",
      to: "2026-11-16",
      timeZone: MAD,
      hidden: new Set(),
    });
    assert.deepEqual(
      long.map((o) => o.key),
      ["w::2026-11-15"],
    );
  });
  test("solapes en columnas: tres a la vez, ensanche y grupos independientes", () => {
    const a = { start: 600, end: 720 }; // 10:00–12:00
    const b = { start: 600, end: 660 }; // 10:00–11:00
    const c = { start: 630, end: 690 }; // 10:30–11:30
    const d = { start: 690, end: 720 }; // 11:30–12:00
    const e = { start: 800, end: 860 };
    const z = { start: 900, end: 900 };
    const p = layoutTimed([c, b, a, d, e, z], 15);
    assert.deepEqual(p.get(a), { col: 0, n: 3, w: 1, side: true });
    assert.deepEqual(p.get(b), { col: 1, n: 3, w: 1, side: true });
    assert.deepEqual(p.get(c), { col: 2, n: 3, w: 1, side: false });
    assert.deepEqual(p.get(d), { col: 1, n: 3, w: 2, side: false }, "11:30 cabe en la columna 1 y se ensancha a la 2");
    assert.deepEqual(p.get(e), { col: 0, n: 1, w: 1, side: false });
    assert.deepEqual(p.get(z), { col: 0, n: 1, w: 1, side: false });
  });
  test("propiedad: dos del mismo grupo que se solapan nunca comparten columna; ancho dentro de n", () => {
    const interval = fc
      .tuple(fc.integer({ min: 0, max: 1400 }), fc.integer({ min: 0, max: 240 }))
      .map(([s, d]) => ({ start: s, end: s + d }));
    fc.assert(
      fc.property(fc.array(interval, { maxLength: 30 }), (items) => {
        const p = layoutTimed(items, 15);
        for (const x of items) {
          const px = p.get(x)!;
          assert.ok(px.col >= 0 && px.col + px.w <= px.n);
          for (const y of items) {
            if (x === y) continue;
            const py = p.get(y)!;
            const sx = { start: x.start, end: Math.max(x.end, x.start + 15) };
            const sy = { start: y.start, end: Math.max(y.end, y.start + 15) };
            if (overlaps(sx, sy)) {
              assert.equal(px.n, py.n, "mismo grupo, mismas columnas");
              assert.ok(px.col + px.w <= py.col || py.col + py.w <= px.col, "columnas disjuntas");
            }
          }
        }
      }),
    );
  });
  test("partir por días: cruza la medianoche, cero minutos", () => {
    const d = dayStart("2026-11-19");
    const night = { start: d + 22 * 60, end: d + 1440 + 2 * 60 };
    const segs = splitByDay([night], ["2026-11-19", "2026-11-20"]);
    assert.deepEqual(
      segs.map(({ date, start, end, contStart, contEnd }) => ({ date, start, end, contStart, contEnd })),
      [
        { date: "2026-11-19", start: 1320, end: 1440, contStart: false, contEnd: true },
        { date: "2026-11-20", start: 0, end: 120, contStart: true, contEnd: false },
      ],
    );
    assert.equal(splitByDay([{ start: d + 600, end: d + 600 }], ["2026-11-19", "2026-11-20"]).length, 1);
  });
  test("carriles: varios días primero, «+N» en el carril reservado", () => {
    const days = visibleDays("week", "2026-11-19", 1);
    const d0 = dayStart(days[0]!);
    const day = (i: number, h = 0, len = 60) => ({ start: d0 + i * 1440 + h * 60, end: d0 + i * 1440 + h * 60 + len });
    const sprint = { start: d0 - 1440 * 3, end: d0 + 1440 * 2, allDay: true };
    const trip = { start: d0 + 1440 * 3, end: d0 + 1440 * 10, allDay: true };
    const items = [day(0, 9), day(0, 10), day(0, 11), day(0, 12), sprint, trip, day(4, 9)];
    const all = layoutRow(items, days);
    assert.equal(all.lanes, 5);
    const s = all.bars.find((b) => b.item === sprint)!;
    assert.deepEqual([s.from, s.span, s.lane, s.contStart, s.contEnd], [0, 2, 0, true, false]);
    const t = all.bars.find((b) => b.item === trip)!;
    assert.deepEqual([t.from, t.span, t.lane, t.contStart, t.contEnd], [3, 4, 0, false, true]);
    const capped = layoutRow(items, days, 3);
    assert.equal(capped.hidden[0]!.length, 3, "lunes: 4 de un día + sprint en 3 carriles → 2 visibles y +3");
    assert.equal(capped.hidden[4]!.length, 0, "viernes: el único que no cabía entra en el carril reservado");
    assert.equal(capped.lanes, 3);
    assert.equal(layoutRow([{ start: d0 - 5000, end: d0 - 4000 }], days).bars.length, 0);
  });
  test("propiedad: en una fila, dos barras del mismo carril no se pisan y nada se pierde", () => {
    const days = visibleDays("week", "2026-11-19", 1);
    const d0 = dayStart(days[0]!);
    const item = fc.tuple(fc.integer({ min: -3, max: 8 }), fc.integer({ min: 0, max: 5 }), fc.boolean()).map(([from, len, allDay]) => ({
      start: d0 + from * 1440 + (allDay ? 0 : 600),
      end: d0 + (from + len) * 1440 + (allDay ? 1440 : 660),
      allDay,
    }));
    fc.assert(
      fc.property(fc.array(item, { maxLength: 20 }), fc.integer({ min: 1, max: 6 }), (items, max) => {
        const row = layoutRow(items, days, max);
        for (const a of row.bars)
          for (const b of row.bars) if (a !== b && a.lane === b.lane) assert.ok(a.from + a.span <= b.from || b.from + b.span <= a.from);
        assert.ok(row.bars.every((b) => b.lane < max));
        const visible = items.filter((i) => i.end > d0 && i.start < d0 + 7 * 1440);
        for (const i of visible) assert.ok(row.bars.some((b) => b.item === i) || row.hidden.some((h) => h.includes(i)));
      }),
    );
  });
  test("rejilla: ajustar, punto → franja, mover y redimensionar", () => {
    assert.equal(snap(607, 15), 600);
    assert.equal(snap(608, 15), 615);
    assert.equal(snap(608, 0), 608);
    assert.equal(slotAt(96, 48, 480, 30), 600, "dos horas por debajo de las 08:00");
    assert.equal(slotAt(-50, 48, 480, 30), 480);
    assert.equal(slotAt(99999, 48, 480, 30, 1200), 1170);
    assert.deepEqual(moveSpan({ start: 600, end: 660 }, 45), { start: 645, end: 705 });
    assert.deepEqual(resizeSpan({ start: 600, end: 660 }, "end", -60, 15), { start: 600, end: 615 });
    assert.deepEqual(resizeSpan({ start: 600, end: 660 }, "start", 90, 15), { start: 645, end: 660 });
    assert.deepEqual(resizeSpan({ start: 600, end: 660 }, "start", -30, 15), { start: 570, end: 660 });
    assert.ok(canEdit(ev({ id: "x", start: "", end: "" }), undefined, true, "start"));
    assert.ok(!canEdit(ev({ id: "x", start: "", end: "", startEditable: false }), undefined, true, "start"));
    assert.ok(!canEdit(ev({ id: "x", start: "", end: "" }), { id: "work", name: "W", color: "1", editable: false }, true, "duration"));
    assert.ok(canEdit(ev({ id: "x", start: "", end: "", editable: true }), undefined, false, "duration"));
  });
  test("propiedad: mover conserva la duración; redimensionar nunca baja del mínimo", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 15, max: 600 }),
        fc.integer({ min: -2000, max: 2000 }),
        (s, d, delta) => {
          const span = { start: s, end: s + d };
          const m = moveSpan(span, delta);
          assert.equal(m.end - m.start, d);
          for (const edge of ["start", "end"] as const) {
            const r = resizeSpan(span, edge, delta, 15);
            assert.ok(r.end - r.start >= 15);
          }
        },
      ),
    );
  });
  test("reescribir en la forma del evento, con la hora que no existe", () => {
    const d = dayStart("2026-11-20");
    assert.deepEqual(rewriteSpan(ev({ id: "a", start: "2026-11-19", end: "2026-11-21" }), { start: d, end: d + 2 * 1440 }, MAD), {
      start: "2026-11-20",
      end: "2026-11-22",
    });
    const zoned = ev({ id: "b", start: "2026-11-19T10:00", end: "2026-11-19T11:00", timeZone: NY });
    assert.deepEqual(rewriteSpan(zoned, { start: d + 16 * 60 + 30, end: d + 17 * 60 + 30 }, MAD), {
      start: "2026-11-20T10:30",
      end: "2026-11-20T11:30",
    });
    assert.deepEqual(
      rewriteSpan(ev({ id: "c", start: "2026-11-19T09:00:00Z", end: "2026-11-19T10:00:00Z" }), { start: d + 600, end: d + 660 }, MAD),
      {
        start: "2026-11-20T09:00:00Z",
        end: "2026-11-20T10:00:00Z",
      },
    );
    assert.deepEqual(
      rewriteSpan(ev({ id: "f", start: "2026-11-19T09:00", end: "2026-11-19T09:30:00" }), { start: d + 600, end: d + 630 }, MAD),
      {
        start: "2026-11-20T10:00",
        end: "2026-11-20T10:30:00",
      },
    );
    const gap = dayStart("2026-03-29") + 150; // 02:30, no existe en Madrid
    const moved = rewriteSpan(
      ev({ id: "g", start: "2026-03-28T10:00", end: "2026-03-28T11:00", timeZone: MAD }),
      { start: gap, end: gap + 60 },
      MAD,
    );
    assert.deepEqual(moved, { start: "2026-03-29T03:30", end: "2026-03-29T03:30", shifted: { asked: "02:30", saved: "03:30" } });
  });
  test("rango visible y navegación", () => {
    assert.deepEqual(visibleDays("day", "2026-11-19", 1), ["2026-11-19"]);
    assert.deepEqual(visibleDays("week", "2026-11-19", 1)[0], "2026-11-16");
    assert.deepEqual(visibleDays("week", "2026-11-19", 0)[0], "2026-11-15");
    assert.equal(visibleDays("week", "2026-11-19", 1, { hiddenDays: [0, 6] }).length, 5);
    assert.deepEqual(visibleDays("workweek", "2026-11-19", 0), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
    assert.equal(visibleDays("month", "2026-11-19", 1).length, 42, "noviembre de 2026 empieza en domingo: 6 semanas");
    assert.equal(visibleDays("month", "2026-02-10", 0).length, 28, "febrero de 2026 empieza en domingo: 4 semanas justas");
    assert.equal(visibleDays("month", "2026-02-10", 0, { fixedWeeks: true }).length, 42);
    assert.equal(visibleDays("agenda", "2026-11-19", 1, { listDays: 7 }).length, 7);
    assert.equal(shiftDate("day", "2026-11-19", 1), "2026-11-20");
    assert.equal(shiftDate("workweek", "2026-11-19", -1), "2026-11-12");
    assert.equal(shiftDate("month", "2026-01-31", 1), "2026-02-01");
    assert.equal(shiftDate("month", "2026-01-15", -1), "2025-12-01");
    assert.equal(shiftDate("agenda", "2026-11-19", 1, 7), "2026-11-26");
    assert.equal(clockText(minuteOfDay(nowIn(Date.parse("2026-11-19T09:42:00Z"), MAD))), "10:42");
  });
});

describe("navegación espacial", () => {
  const box = (left: number, top: number, w = 100, h = 40) => ({ left, top, right: left + w, bottom: top + h });
  test("borde cercano más allá del lejano; alineados primero; sin candidato, -1", () => {
    const current = box(100, 100);
    const cands = [current, box(210, 100), box(210, 300), box(100, 150), box(0, 0, 90)];
    assert.equal(nextInDirection(current, cands, "right"), 1);
    assert.equal(nextInDirection(current, cands, "down"), 3);
    assert.equal(nextInDirection(current, cands, "left"), 4);
    assert.equal(nextInDirection(current, cands, "up"), 4, "no alineado, pero por encima del todo");
    assert.equal(nextInDirection(current, [current, box(150, 90)], "up"), -1, "se solapa en el eje: no está arriba");
  });
  test("no alineado: distancia más peso del desvío", () => {
    const current = box(0, 0);
    assert.equal(nextInDirection(current, [box(150, 300), box(400, 60)], "right"), 1);
    assert.equal(nextInDirection(current, [box(150, 300), box(400, 600)], "right"), 0);
    assert.equal(arrowDirection("ArrowUp"), "up");
    assert.equal(arrowDirection("ArrowLeft"), "left");
    assert.equal(arrowDirection("ArrowRight"), "right");
    assert.equal(arrowDirection("ArrowDown"), "down");
    assert.equal(arrowDirection("Enter"), null);
  });
});
