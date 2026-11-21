// Timer: reloj con pausas, texto de la pantalla, texto hablado, cadencia y anuncios por hitos. Y las piezas que
// cerraron la familia de fecha: rango de semanas, horas del día límite y elegir una semana por su número.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  durationParts,
  elapsedOf,
  idleClock,
  isoDuration,
  milestone,
  nextTick,
  parseDuration,
  pauseClock,
  shownMs,
  spokenDuration,
  startClock,
  timerText,
} from "../../zui/src/core/stopwatch.ts";
import { weekRangeDays, weekRangeOf } from "../../zui/src/core/date.ts";
import { clampDateTime, dayTimeBounds } from "../../zui/src/core/time.ts";
import { chooseWeek, readSelection } from "../../zui/src/core/calendar.ts";

describe("Timer: reloj", () => {
  test("correr, pausar y reanudar acumula solo el tiempo corriendo", () => {
    let c = idleClock();
    assert.equal(elapsedOf(c, 1000), 0);
    c = startClock(c, 1000);
    assert.equal(startClock(c, 5000), c, "empezar dos veces no reinicia");
    assert.equal(elapsedOf(c, 4000), 3000);
    c = pauseClock(c, 4000);
    assert.equal(pauseClock(c, 9000), c);
    assert.equal(elapsedOf(c, 10_000), 3000);
    c = startClock(c, 10_000);
    assert.equal(elapsedOf(c, 12_500), 5500);
  });
  test("lo que se muestra: cuenta atrás sin negativos, cronómetro tal cual", () => {
    assert.equal(shownMs("countdown", 5000, 7000), 0);
    assert.equal(shownMs("countdown", 5000, 1200), 3800);
    assert.equal(shownMs("stopwatch", 0, 1200), 1200);
  });
  test("texto de la pantalla", () => {
    assert.equal(timerText(65_000), "01:05");
    assert.equal(timerText(3_725_000), "1:02:05");
    assert.equal(timerText(5_000, { hours: true }), "0:00:05");
    assert.equal(timerText(400, { mode: "countdown" }), "00:01", "la cuenta atrás redondea hacia arriba");
    assert.equal(timerText(1_950, { precision: "tenth" }), "00:01.9");
    assert.equal(timerText(65_000, { locale: "ar-EG" }), "٠١:٠٥");
    assert.equal(timerText(65_000, { locale: "bad locale!!" }), "01:05");
    assert.deepEqual(durationParts(-5), { hours: 0, minutes: 0, seconds: 0, tenths: 0 });
  });
  test("texto hablado", () => {
    assert.match(spokenDuration(270_000, "en-US"), /4 minutes,? (and )?30 seconds/);
    assert.match(spokenDuration(0, "en-US"), /0 seconds/);
    assert.match(spokenDuration(3_600_000, "en-US"), /1 hour/);
  });
  test("cadencia alineada al cambio de cifra", () => {
    assert.equal(nextTick("countdown", 10_000, 2_300), 700);
    assert.equal(nextTick("countdown", 10_000, 3_000), 1000);
    assert.equal(nextTick("countdown", 10_000, 12_000), 0);
    assert.equal(nextTick("stopwatch", 0, 2_300), 700);
    assert.equal(nextTick("stopwatch", 0, 2_340, "tenth"), 60);
  });
  test("hitos: cada minuto, los últimos segundos, nunca en cada segundo", () => {
    assert.equal(milestone("countdown", 121_000, 120_000), 120);
    assert.equal(milestone("countdown", 119_000, 118_000), null);
    assert.equal(milestone("countdown", 6_000, 5_000, 60, 5), 5);
    assert.equal(milestone("countdown", 1_000, 0, 60, 5), null, "el fin se anuncia aparte");
    assert.equal(milestone("countdown", 125_000, 95_000), 95, "salto de una pestaña oculta");
    assert.equal(milestone("countdown", 121_000, 120_000, 0), null);
    assert.equal(milestone("stopwatch", 59_000, 60_000), 60);
    assert.equal(milestone("stopwatch", 60_000, 61_000), null);
  });
  test("propiedad: una cuenta atrás de N segundos anuncia como mucho N/every + final hitos", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 900 }),
        fc.integer({ min: 1, max: 120 }),
        fc.integer({ min: 0, max: 10 }),
        (n, every, final) => {
          let count = 0;
          for (let s = n; s > 0; s--) if (milestone("countdown", s * 1000, (s - 1) * 1000, every, final) !== null) count++;
          assert.ok(count <= Math.floor(n / every) + final);
        },
      ),
    );
  });
  test("duraciones ISO 8601", () => {
    assert.equal(parseDuration("PT5M"), 300_000);
    assert.equal(parseDuration("PT1H2M3S"), 3_723_000);
    assert.equal(parseDuration("90"), 90_000);
    assert.equal(parseDuration(1.5), 1500);
    assert.equal(parseDuration("PT"), 0);
    assert.equal(parseDuration("nope"), 0);
    assert.equal(parseDuration(-3), 0);
    assert.equal(parseDuration(undefined), 0);
    assert.equal(isoDuration(300_000), "PT5M");
    assert.equal(isoDuration(0), "PT0S");
    assert.equal(isoDuration(3_723_000), "PT1H2M3S");
  });
});

describe("cierre de la familia de fecha", () => {
  test("rango de semanas ISO ↔ días", () => {
    assert.deepEqual(weekRangeDays({ from: "2026-W46", to: "2026-W48" }), { from: "2026-11-09", to: "2026-11-29" });
    assert.deepEqual(weekRangeDays({ from: "2026-W48", to: "2026-W46" }), { from: "2026-11-09", to: "2026-11-29" });
    assert.deepEqual(weekRangeDays({ from: "2026-W46", to: null }), { from: "2026-11-09", to: null });
    assert.deepEqual(weekRangeDays({ from: "nope" }), { from: null, to: null });
    assert.deepEqual(weekRangeOf({ from: "2026-11-09", to: "2026-11-29" }), { from: "2026-W46", to: "2026-W48" });
    assert.deepEqual(weekRangeOf({ from: "2020-12-28", to: "2021-01-10" }), { from: "2020-W53", to: "2021-W01" });
  });
  test("horas del día límite de un DateTimePicker", () => {
    assert.deepEqual(dayTimeBounds("2026-11-19", "2026-11-19T09:30", "2026-11-20T18:00"), { min: "09:30", max: null });
    assert.deepEqual(dayTimeBounds("2026-11-20", "2026-11-19T09:30", "2026-11-20T18:00"), { min: null, max: "18:00" });
    assert.deepEqual(dayTimeBounds("2026-11-21", "2026-11-19", "2026-11-25"), { min: null, max: null });
    assert.deepEqual(dayTimeBounds(null, "2026-11-19T09:30"), { min: null, max: null });
    assert.equal(clampDateTime("2026-11-19", "08:00", "2026-11-19T09:30"), "2026-11-19T09:30");
    assert.equal(clampDateTime("2026-11-20", "19:15", null, "2026-11-20T18:00"), "2026-11-20T18:00");
    assert.equal(clampDateTime("2026-11-20", "12:00:30", "2026-11-19T09:30", "2026-11-20T18:00", true), "2026-11-20T12:00:30");
    assert.equal(clampDateTime("2026-11-20", "12:00", "2026-11-19", "2026-11-21"), "2026-11-20T12:00");
  });
  test("elegir una semana por su número", () => {
    const empty = readSelection("range", null);
    const rules = { min: "2026-11-11" };
    assert.deepEqual(chooseWeek("range", empty, "2026-11-09", rules), { from: "2026-11-11", to: "2026-11-15" });
    assert.equal(chooseWeek("single", readSelection("single", null), "2026-11-16", {}), "2026-11-16");
    const multi = chooseWeek("multiple", readSelection("multiple", []), "2026-11-16", {}) as string[];
    assert.equal(multi.length, 7);
    assert.deepEqual(chooseWeek("multiple", readSelection("multiple", multi), "2026-11-16", {}), [], "otra vez la quita");
    assert.equal(chooseWeek("multiple", readSelection("multiple", []), "2026-11-16", { maxSelected: 3 }), undefined);
    assert.equal(chooseWeek("range", empty, "2026-11-02", rules), undefined);
  });
});
