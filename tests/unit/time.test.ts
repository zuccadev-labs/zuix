// Tiempo y hora: duraciones, relojes, cuenta atrás, zonas y el temporizador compartido; y los árboles de Clock,
// AnalogClock, WorldClock, Countdown y DurationField (lo que pintan React y el modo DOM).
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";
import fc from "fast-check";
import { balance, formatDuration, parseISODuration, partsToMs, toISODuration, toMs } from "../../zui/src/core/duration.ts";
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
  polar,
  zoneDifference,
  zonedISO,
} from "../../zui/src/core/clock.ts";
import {
  autoAnnounceStep,
  countdownMilestone,
  countdownSpoken,
  countdownTarget,
  countdownUnits,
  unitDigits,
  until,
} from "../../zui/src/core/countdown.ts";
import { groupZones, listTimeZones, offsetText, zoneMatches, zoneOptions, zoneRegion } from "../../zui/src/core/timezones.ts";
import { resetTicker, subscribeTick, tickerState } from "../../zui/src/core/ticker.ts";
import { analogClockWidget, clockWidget, worldClockWidget } from "../../zui/src/core/clock-widget.ts";
import { countdownWidget } from "../../zui/src/core/countdown-widget.ts";
import { durationFieldWidget, segmentMax, segmentValues, withSegment } from "../../zui/src/core/duration-widget.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";

const T = Date.parse("2026-11-21T10:42:07Z");
const html = <P, C, S>(w: { configure(p: P): C; initial(c: C): S; tree(c: C, s: S, uid: string): unknown }, props: P) => {
  const c = w.configure(props);
  return toHTML(w.tree(c, w.initial(c), "t") as never);
};

describe("duraciones", () => {
  test("ISO 8601 de unidades fijas", () => {
    assert.deepEqual(parseISODuration("PT1H30M"), { hours: 1, minutes: 30 });
    assert.deepEqual(parseISODuration("P1W"), { weeks: 1 });
    assert.deepEqual(parseISODuration("P2DT4H5.5S"), { days: 2, hours: 4, seconds: 5.5 });
    assert.deepEqual(parseISODuration("pt0,5h"), { hours: 0.5 });
    for (const bad of ["", "P", "PT", "P1M", "1H", "PT1H30", null, undefined])
      assert.equal(parseISODuration(bad as string), null, String(bad));
  });
  test("cualquier forma → milisegundos", () => {
    assert.equal(toMs("PT1H30M"), 5_400_000);
    assert.equal(toMs("1:30"), 5_400_000);
    assert.equal(toMs("1:30:15"), 5_415_000);
    assert.equal(toMs("90m"), 5_400_000);
    assert.equal(toMs("1h 30min"), 5_400_000);
    assert.equal(toMs("2d"), 172_800_000);
    assert.equal(toMs({ minutes: 2, seconds: 3 }), 123_000);
    assert.equal(toMs(-5), 0);
    assert.equal(toMs(Number.NaN), 0);
    assert.equal(toMs("tomorrow"), 0);
    assert.equal(toMs("1h tomorrow"), 0, "solo si todo el texto son unidades");
    assert.equal(toMs(null), 0);
    assert.equal(partsToMs({ hours: -1, minutes: 1 }), 60_000);
  });
  test("reparto entre unidades", () => {
    assert.deepEqual(balance(90_061_000, "days"), { weeks: 0, days: 1, hours: 1, minutes: 1, seconds: 1 });
    assert.deepEqual(balance(90_061_000, "hours"), { weeks: 0, days: 0, hours: 25, minutes: 1, seconds: 1 });
    assert.deepEqual(balance(61_500, "minutes", "minutes", "ceil"), { weeks: 0, days: 0, hours: 0, minutes: 2, seconds: 0 });
    assert.deepEqual(balance(-3, "hours"), { weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
  test("escritura ISO", () => {
    assert.equal(toISODuration(5_400_000), "PT1H30M");
    assert.equal(toISODuration(0), "PT0S");
    assert.equal(toISODuration(93_784_000), "P1DT2H3M4S");
    assert.equal(toISODuration({ weeks: 2 }), "P2W");
    assert.equal(toISODuration({ seconds: 1, milliseconds: 500 }), "PT1.5S");
  });
  test("ISO → ms → ISO es estable (fast-check)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 * 86_400 }), (seconds) => {
        const iso = toISODuration(seconds * 1000);
        assert.equal(toMs(iso), seconds * 1000);
        assert.equal(toISODuration(toMs(iso)), iso);
      }),
    );
  });
  test("el reparto conserva el total (fast-check)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 ** 10 }),
        fc.constantFrom("weeks", "days", "hours", "minutes", "seconds" as const),
        (ms, largest) => {
          const parts = balance(ms * 1000, largest);
          assert.equal(partsToMs(parts), ms * 1000);
        },
      ),
    );
  });
  test("texto legible en cada estilo, con y sin Intl.DurationFormat", () => {
    assert.equal(formatDuration("PT1H30M", { style: "digital", locale: "en-US" }), "1:30:00");
    assert.equal(formatDuration("PT26H", { style: "digital", locale: "en-US", smallestUnit: "minutes" }), "26:00");
    assert.equal(formatDuration(65_000, { style: "digital", locale: "ar-EG" }), "٠:٠١:٠٥");
    const long = formatDuration("PT1H30M", { style: "long", locale: "en-US" });
    assert.match(long, /1 hour.*30 minutes/);
    assert.match(formatDuration("P1DT2H", { style: "long", locale: "en-US" }), /1 day.*2 hours/);
    assert.match(formatDuration("PT26H", { style: "long", locale: "en-US", largestUnit: "hours" }), /26 hours/);
    assert.match(formatDuration(0, { locale: "en-US" }), /0/);
    const DF = (Intl as { DurationFormat?: unknown }).DurationFormat;
    try {
      (Intl as { DurationFormat?: unknown }).DurationFormat = undefined;
      assert.equal(formatDuration("PT1H30M", { style: "long", locale: "en-US" }), "1 hour, 30 minutes");
      assert.equal(formatDuration("PT1H30M", { style: "narrow", locale: "en-US" }), "1h 30m");
      assert.equal(formatDuration(0, { style: "short", locale: "en-US" }), "0 sec");
      assert.equal(formatDuration("PT2M", { style: "short", locale: "es" }), "2 min");
    } finally {
      (Intl as { DurationFormat?: unknown }).DurationFormat = DF;
    }
  });
  test("con Temporal.Duration, el mismo reparto", { skip: !(globalThis as { Temporal?: unknown }).Temporal }, () => {
    const Temporal = (globalThis as { Temporal: { Duration: { from(o: object): { round(o: object): Record<string, number> } } } }).Temporal;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 ** 7 }), (seconds) => {
        const d = Temporal.Duration.from({ seconds }).round({ largestUnit: "hours" });
        const p = balance(seconds * 1000, "hours");
        assert.deepEqual([d.hours, d.minutes, d.seconds], [p.hours, p.minutes, p.seconds]);
      }),
    );
  });
});

describe("relojes", () => {
  test("ángulos de las agujas", () => {
    assert.deepEqual(handAngles({ hour: 3, minute: 0, second: 0 }), { hour: 90, minute: 0, second: 0 });
    assert.deepEqual(handAngles({ hour: 15, minute: 30, second: 0 }), { hour: 105, minute: 180, second: 0 });
    assert.equal(handAngles({ hour: 0, minute: 0, second: 30 }, 500, true).second, 183);
    assert.equal(handAngles({ hour: 0, minute: 0, second: 30 }, 500).second, 180, "sin smooth, a saltos");
  });
  test("las agujas giran en el sentido del reloj sin saltos dentro de una vuelta (fast-check)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 86_398 }), (s) => {
        const at = (n: number) => handAngles({ hour: Math.floor(n / 3600), minute: Math.floor(n / 60) % 60, second: n % 60 });
        const a = at(s);
        const b = at(s + 1);
        if (s % 43_200 !== 43_199) assert.ok(b.hour > a.hour);
        assert.ok(a.hour >= 0 && a.hour < 360 && a.minute >= 0 && a.minute < 360 && a.second < 360);
      }),
    );
  });
  test("geometría de la esfera", () => {
    assert.equal(faceMarks("hours").length, 12);
    const minutes = faceMarks("minutes");
    assert.equal(minutes.length, 60);
    assert.equal(minutes.filter((m) => m.major).length, 12);
    assert.deepEqual(faceMarks("none"), []);
    assert.deepEqual(polar(0, 40), { x: 50, y: 10 });
    assert.deepEqual(polar(90, 40), { x: 90, y: 50 });
    assert.deepEqual(
      faceNumerals("quarters").map((n) => n.value),
      [12, 3, 6, 9],
    );
    assert.equal(faceNumerals("all").length, 12);
    assert.deepEqual(faceNumerals("none"), []);
  });
  test("texto del reloj por partes, zona y ciclo", () => {
    const parts = clockParts(T, { timeZone: "Europe/Madrid", locale: "en-US", seconds: true });
    assert.deepEqual(
      parts.map((p) => p.type),
      ["hour", "separator", "minute", "separator", "second", "literal", "dayPeriod"],
    );
    assert.equal(clockText(T, { timeZone: "Europe/Madrid", locale: "en-GB" }), "11:42");
    assert.equal(clockText(T, { timeZone: "Asia/Tokyo", locale: "en-US", hourCycle: "h23" }), "19:42");
    assert.equal(clockText(T, { timeZone: "UTC", locale: "en-US" }).replace(/\s/g, " "), "10:42 AM");
    assert.equal(
      clockText(T, { timeZone: "No/Such_Zone", locale: "en-GB" }),
      clockText(T, { locale: "en-GB" }),
      "zona inválida → la del dispositivo",
    );
    assert.equal(clockDate(T, { timeZone: "Pacific/Kiritimati", locale: "en-GB" }), "Sunday 22 November");
  });
  test("ISO con desfase para <time datetime>", () => {
    assert.equal(zonedISO(T, "Asia/Kolkata"), "2026-11-21T16:12:07+05:30");
    assert.equal(zonedISO(T, "UTC"), "2026-11-21T10:42:07Z");
    assert.equal(zonedISO(T, "America/Caracas", false), "2026-11-21T06:42-04:00");
  });
  test("diferencia con la referencia, día y noche", () => {
    assert.deepEqual(zoneDifference(T, "Asia/Tokyo", "Europe/Madrid"), { minutes: 480, day: 0 });
    assert.deepEqual(zoneDifference(Date.parse("2026-11-21T20:00:00Z"), "Asia/Tokyo", "Europe/Madrid"), { minutes: 480, day: 1 });
    assert.deepEqual(zoneDifference(Date.parse("2026-11-21T02:00:00Z"), "America/Los_Angeles", "Europe/Madrid"), {
      minutes: -540,
      day: -1,
    });
    assert.equal(differenceText(0), "±0");
    assert.equal(differenceText(360, "en-US"), "+6 hr");
    assert.equal(differenceText(-210, "en-US"), "−3 hr 30 min");
    assert.equal(differenceSpoken(-210, "en-US"), "3 hours, 30 minutes");
    assert.equal(differenceSpoken(60, "en-US"), "1 hour");
    assert.equal(isDaytime(7), true);
    assert.equal(isDaytime(19), false);
    assert.equal(isDaytime(3), false);
  });
});

describe("cuenta atrás", () => {
  test("partes que faltan, con la mayor absorbiendo lo que no se pide", () => {
    const to = T + ((2 * 24 + 3) * 60 + 5) * 60_000 + 9000;
    assert.deepEqual(until(to, T).parts, { days: 2, hours: 3, minutes: 5, seconds: 9 });
    assert.deepEqual(until(to, T, ["hours", "minutes"]).parts, { hours: 51, minutes: 6 }, "sin segundos, el minuto redondea hacia arriba");
    assert.deepEqual(until(T + 400, T).parts, { days: 0, hours: 0, minutes: 0, seconds: 1 }, "1 s visible hasta el final");
    const done = until(T - 5000, T);
    assert.equal(done.done, true);
    assert.equal(done.ms, 0);
    assert.deepEqual(countdownUnits(["seconds", "days", "bad"]), ["days", "seconds"]);
    assert.deepEqual(countdownUnits([]), ["days", "hours", "minutes", "seconds"]);
    assert.equal(countdownTarget("2026-11-21T10:42:07Z"), T);
    assert.equal(countdownTarget("nope"), null);
    assert.equal(unitDigits("hours", 3), "03");
    assert.equal(unitDigits("days", 3), "3");
  });
  test("las partes suman lo que falta (fast-check)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 ** 9 }), (s) => {
        const p = until(T + s * 1000, T).parts;
        assert.equal((((p.days ?? 0) * 24 + (p.hours ?? 0)) * 60 + (p.minutes ?? 0)) * 60 + (p.seconds ?? 0), s);
        assert.ok((p.hours ?? 0) < 24 && (p.minutes ?? 0) < 60 && (p.seconds ?? 0) < 60);
      }),
    );
  });
  test("hitos: cada hora, cada cuarto en la última hora, cada minuto al final; nunca cada segundo", () => {
    assert.equal(autoAnnounceStep(5 * 3_600_000), 3600);
    assert.equal(autoAnnounceStep(30 * 60_000), 900);
    assert.equal(autoAnnounceStep(4 * 60_000), 60);
    assert.equal(countdownMilestone(3_601_000, 3_600_000), 3_600_000);
    assert.equal(countdownMilestone(3_600_400, 3_600_100), null, "mismo segundo mostrado");
    assert.equal(countdownMilestone(1_801_000, 1_799_000), 1_799_000, "cruza la media hora");
    assert.equal(countdownMilestone(61_000, 59_000), 59_000);
    assert.equal(countdownMilestone(59_000, 58_000), null);
    assert.equal(countdownMilestone(5000, 0), null, "el final se anuncia aparte");
    assert.equal(countdownMilestone(5000, 6000), null, "hacia atrás no");
    assert.equal(countdownMilestone(61_000, 59_000, 0), null, "0 desactiva los hitos");
    assert.equal(countdownMilestone(11_000, 9000, 10), 9000, "paso fijo");
    assert.equal(countdownMilestone(7_200_000, 60_000), 60_000, "un salto largo cuenta como uno");
  });
  test("en una cuenta atrás de un minuto a cero hay a lo sumo un anuncio por minuto (fast-check)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 60, max: 4000 }), (start) => {
        let hits = 0;
        for (let s = start; s > 0; s--) if (countdownMilestone(s * 1000, (s - 1) * 1000) !== null) hits++;
        assert.ok(hits <= Math.ceil(start / 60) + 1, `${hits} hitos en ${start} s`);
      }),
      { numRuns: 40 },
    );
  });
  test("texto hablado: segundos solo en el último minuto", () => {
    assert.equal(countdownSpoken(until(T + 3_725_000, T), "en-US"), "1 hour, 3 minutes");
    assert.equal(countdownSpoken(until(T + 42_000, T), "en-US"), "42 seconds");
    assert.match(countdownSpoken(until(T + 2 * 86_400_000, T), "en-US"), /2 days/);
  });
});

describe("zonas horarias", () => {
  test("lista, región y desfase", () => {
    const zones = listTimeZones();
    assert.ok(zones.includes("UTC") && zones.includes("Europe/Madrid") && zones.length > 50);
    assert.equal(zoneRegion("America/Argentina/Buenos_Aires"), "America");
    assert.equal(zoneRegion("Etc/GMT+3"), "UTC");
    assert.equal(zoneRegion("UTC"), "UTC");
    assert.equal(offsetText(0), "GMT");
    assert.equal(offsetText(60), "GMT+1");
    assert.equal(offsetText(330), "GMT+5:30");
    assert.equal(offsetText(-180), "GMT−3");
  });
  test("opciones con ciudad, desfase y hora; ordenadas y agrupadas", () => {
    const options = zoneOptions({
      zones: ["Asia/Tokyo", "Europe/Madrid", "America/Argentina/Buenos_Aires", "Bad/Zone", "UTC"],
      at: T,
      locale: "en-GB",
    });
    assert.deepEqual(
      options.map((o) => o.label),
      ["Buenos Aires · GMT−3 · 07:42", "UTC · 10:42", "Madrid · GMT+1 · 11:42", "Tokyo · GMT+9 · 19:42"],
    );
    const bare = zoneOptions({ zones: ["Europe/Madrid"], at: T, showOffset: false, showTime: false, names: { "Europe/Madrid": "Office" } });
    assert.equal(bare[0]!.label, "Office");
    const groups = groupZones(options);
    assert.deepEqual(
      groups.map((g) => g.label),
      ["UTC", "America", "Asia", "Europe"],
    );
    assert.deepEqual(
      groupZones(options, "offset").map((g) => g.label),
      ["GMT−3", "GMT", "GMT+1", "GMT+9"],
    );
  });
  test("búsqueda por ciudad, identificador o desfase", () => {
    const [madrid] = zoneOptions({ zones: ["Europe/Madrid"], at: T });
    assert.ok(zoneMatches(madrid!, "madr"));
    assert.ok(zoneMatches(madrid!, "europe"));
    assert.ok(zoneMatches(madrid!, "gmt+1"));
    assert.ok(zoneMatches(madrid!, ""));
    assert.ok(!zoneMatches(madrid!, "tokyo"));
    const [kolkata] = zoneOptions({ zones: ["Asia/Kolkata"], at: T });
    assert.ok(zoneMatches(kolkata!, "+5:30"));
    const [ba] = zoneOptions({ zones: ["America/Argentina/Buenos_Aires"], at: T });
    assert.ok(zoneMatches(ba!, "buenos aires"));
    assert.ok(zoneMatches(ba!, "gmt-3"));
  });
});

describe("temporizador compartido", () => {
  afterEach(() => {
    resetTicker();
    mock.timers.reset();
  });
  test("un solo temporizador, alineado al borde del segundo, y la baja lo libera", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_250 });
    const seen: number[] = [];
    const minute: number[] = [];
    const a = subscribeTick(null, "second", (now) => seen.push(now));
    const b = subscribeTick(null, "minute", (now) => minute.push(now));
    assert.deepEqual(tickerState(), { subscribers: 2, scheduled: true });
    mock.timers.tick(760);
    assert.equal(seen.length, 1);
    assert.ok(seen[0]! % 1000 < 50, "despierta justo tras el borde");
    for (let i = 0; i < 60; i++) mock.timers.tick(1000);
    assert.ok(seen.length >= 60 && minute.length === 1, `${seen.length} segundos, ${minute.length} minutos`);
    a();
    a();
    b();
    assert.deepEqual(tickerState(), { subscribers: 0, scheduled: false });
  });
  test("con la pestaña oculta se para, y al volver se pone al día", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"], now: 2_000_000 });
    const seen: number[] = [];
    subscribeTick(null, "second", (now) => seen.push(now));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(tickerState().scheduled, false);
    mock.timers.tick(10_000);
    assert.equal(seen.length, 0);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(seen.length, 1, "se pone al día en el acto");
    assert.equal(tickerState().scheduled, true);
  });
  test("un elemento desconectado no recibe pasos", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"], now: 3_000_000 });
    const el = document.createElement("div");
    let runs = 0;
    subscribeTick(el, "second", () => runs++);
    mock.timers.tick(3000);
    assert.equal(runs, 0);
  });
});

describe("árboles de la familia", () => {
  test("Clock: <time> con desfase, partes y metadatos", () => {
    const out = html(clockWidget, {
      value: T,
      timeZone: "Europe/Madrid",
      locale: "en-GB",
      seconds: true,
      date: true,
      zone: true,
      label: "Madrid",
      blink: true,
    });
    assert.match(out, /<time class="z-clock__time" datetime="2026-11-21T11:42:07\+01:00">/);
    assert.match(out, /<span class="z-clock__sep">:<\/span>/);
    assert.match(out, /z-clock__date">Saturday 21 November</);
    assert.match(out, /z-clock__zone">GMT\+1</);
    assert.ok(!out.includes("data-blink"), "un reloj fijo no late");
    assert.ok(!/aria-live|role="status"/.test(out), "un reloj no es región viva");
  });
  test("AnalogClock: imagen con nombre por minuto y segundero decorativo", () => {
    const out = html(analogClockWidget, {
      value: T,
      timeZone: "UTC",
      label: "London",
      locale: "en-GB",
      numerals: "quarters",
      marks: "minutes",
    });
    assert.match(out, /role="img" aria-label="10:42, London"/);
    assert.equal((out.match(/class="z-analog-clock__mark"/g) ?? []).length, 60);
    assert.equal((out.match(/data-major/g) ?? []).length, 12);
    assert.match(out, /data-hand="second"/);
    assert.match(out, /data-hand="minute"[^>]*rotate\(252.7 50 50\)/, "minutero a las 42:07");
    const smooth = html(analogClockWidget, { value: T, timeZone: "UTC", smooth: true, seconds: true });
    assert.match(smooth, /--z-clock-second-delay: -7000ms/);
    const plain = html(analogClockWidget, { value: T, timeZone: "UTC", seconds: false, marks: "none" });
    assert.ok(!plain.includes('data-hand="second"') && !plain.includes("z-analog-clock__marks"));
  });
  test("WorldClock: frase completa por ciudad, diferencia y día", () => {
    const out = html(worldClockWidget, {
      value: Date.parse("2026-11-21T20:00:00Z"),
      reference: "Europe/Madrid",
      locale: "en-GB",
      removable: true,
      zones: [{ timeZone: "Asia/Tokyo", label: "Tokyo" }, { timeZone: "Europe/Madrid" }, { timeZone: "America/New_York" }],
    });
    assert.match(out, /z-sr-only">Tokyo, 05:00, 8 hours ahead, Tomorrow, Night</);
    assert.match(out, /z-sr-only">Madrid, 21:00, Same time, Night</);
    assert.match(out, /New York, 15:00, 6 hours behind, Day/);
    assert.match(out, /aria-label="Remove Tokyo"/);
    assert.match(out, /<ul class="z-world-clock__list" aria-label="World clock" role="list">/);
  });
  test("Countdown: temporizador con nombre, cajas ocultas al lector y región aparte", () => {
    const out = html(countdownWidget, { to: T + 3_725_000, now: T, locale: "en-US", showTarget: true, timeZone: "UTC" });
    assert.match(out, /role="timer" aria-label="Countdown: 1 hour, 3 minutes"/);
    assert.match(out, /z-countdown__units" aria-hidden="true"/);
    assert.match(out, /data-unit="hours"><span class="z-countdown__value">01</);
    assert.match(out, /role="status" data-live/);
    assert.match(out, /z-countdown__target" datetime="2026-11-21T11:44:12Z">Ends /);
    const done = html(countdownWidget, { to: T - 1, now: T, labels: { complete: "Launched" } });
    assert.match(done, /data-state="done"/);
    assert.match(done, /aria-label="Countdown: Launched"/);
    const flip = html(countdownWidget, { to: T + 65_000, now: T, variant: "flip", units: ["minutes", "seconds"] });
    assert.equal((flip.match(/z-countdown__digit/g) ?? []).length, 4);
  });
  test("DurationField: un spinbutton por unidad, una parada de Tab y valor ISO en el campo oculto", () => {
    const out = html(durationFieldWidget, { defaultValue: "PT1H5M", name: "len", presets: ["PT15M", "PT1H5M"], locale: "en-US" });
    assert.equal((out.match(/role="spinbutton"/g) ?? []).length, 2);
    assert.equal((out.match(/tabindex="0"/g) ?? []).length, 1);
    assert.match(out, /aria-valuetext="1 hour"/);
    assert.match(out, /aria-valuetext="5 minutes"/);
    assert.match(out, /name="len" value="PT1H5M"/);
    assert.match(out, /aria-pressed="true"[^>]*>1 hr, 5 min</);
  });
  test("DurationField: segmentos, topes y vuelta", () => {
    const units = ["hours", "minutes"] as const;
    assert.equal(segmentMax(units, "hours", null), 99);
    assert.equal(segmentMax(["minutes", "seconds"], "minutes", null), 999);
    assert.equal(segmentMax(units, "hours", toMs("PT8H")), 8);
    assert.equal(segmentMax(units, "minutes", null), 59);
    assert.deepEqual(segmentValues(toMs("PT2H30M"), units), { hours: 2, minutes: 30, seconds: 0 });
    assert.equal(withSegment(toMs("PT2H30M"), units, "minutes", 75, null), toMs("PT2H59M"));
    assert.equal(withSegment(toMs("PT2H30M"), units, "hours", 9, toMs("PT8H")), toMs("PT8H"));
  });
});
