// Vistas de la agenda: año perpetuo, mapa de calor y rachas, línea temporal (escalas, filas, dependencias, camino
// crítico), «buscar hueco», ventana virtual y franjas de cita. Propiedades con fast-check donde las hay.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { monthColumn, perpetualLookup, perpetualYear, weekdayOf } from "../../zui/src/core/perpetual.ts";
import {
  busiestWeekday,
  habitStreak,
  heatmapLevel,
  heatmapThresholds,
  heatmapTotal,
  heatmapWeeks,
  monthStarts,
  streaks,
} from "../../zui/src/core/heatmap.ts";
import {
  barPosition,
  columnAt,
  criticalPath,
  dependencyEdges,
  isMilestone,
  pathOf,
  resizeTask,
  routeDependency,
  shiftTask,
  taskDays,
  timelineColumns,
  timelineRows,
  unitStart,
  type TimelineTask,
} from "../../zui/src/core/timeline.ts";
import {
  busyOf,
  commonFree,
  findSlots,
  firstSlot,
  freeOf,
  intersectIntervals,
  mergeIntervals,
  subtractIntervals,
  workingIntervals,
  type Attendee,
} from "../../zui/src/core/freebusy.ts";
import { indexAt, offsets, virtualWindow } from "../../zui/src/core/virtual.ts";
import { availabilitySlots, localeHourCycle, slotLabel, slotsByDay } from "../../zui/src/core/slots.ts";
import { addDays } from "../../zui/src/core/date.ts";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dateArb = fc.date({ min: new Date("1900-01-01T00:00:00Z"), max: new Date("2100-12-31T00:00:00Z"), noInvalidDate: true }).map(iso);

describe("perpetual: lámina de una página", () => {
  test("la fila del número y la columna del mes dan el día de la semana (contra Date, 1900–2100)", () => {
    fc.assert(
      fc.property(dateArb, fc.integer({ min: 0, max: 6 }), (date, ws) => {
        const cell = perpetualLookup(date, ws)!;
        const model = perpetualYear(Number(date.slice(0, 4)), ws);
        assert.equal(cell.weekday, new Date(`${date}T00:00:00Z`).getUTCDay());
        assert.equal(model.weekdays[cell.row]![cell.column], cell.weekday);
        assert.ok(model.numbers[cell.row]!.includes(Number(date.slice(8, 10))));
        assert.ok(model.columns[cell.column]!.some((m) => m.month === Number(date.slice(5, 7))));
      }),
      { numRuns: 400 },
    );
  });
  test("2026: noviembre en la columna del domingo (semana desde lunes) y 19 → jueves", () => {
    const model = perpetualYear(2026, 1);
    assert.equal(monthColumn(2026, 11, 1), 6);
    assert.deepEqual(
      model.columns[6]!.map((m) => m.month),
      [2, 3, 11],
    );
    assert.deepEqual(model.columns.flat().length, 12);
    assert.deepEqual(perpetualLookup("2026-11-19", 1), { row: 4, column: 6, weekday: 4 });
    assert.equal(perpetualLookup("nope"), null);
    assert.equal(weekdayOf("2026-11-19"), 4);
    assert.deepEqual(model.numbers[0], [1, 8, 15, 22, 29]);
    assert.deepEqual(model.numbers[6], [7, 14, 21, 28]);
    assert.equal(perpetualYear(2024, 8).weekStart, 1);
    assert.equal(model.columns.flat().find((m) => m.month === 2)!.days, 28);
    assert.equal(
      perpetualYear(2028)
        .columns.flat()
        .find((m) => m.month === 2)!.days,
      29,
    );
  });
});

describe("heatmap: semanas, niveles y rachas", () => {
  test("semanas de un año: columnas de 7 con lo de fuera a null y meses al principio", () => {
    const weeks = heatmapWeeks("2026-01-01", "2026-12-31", 1);
    assert.equal(weeks.length, 53);
    assert.deepEqual(weeks[0]!.slice(0, 4), [null, null, null, "2026-01-01"]);
    assert.ok(weeks.every((w) => w.length === 7));
    assert.equal(weeks.flat().filter(Boolean).length, 365);
    const months = monthStarts(weeks);
    assert.equal(months.length, 12);
    assert.deepEqual(months[0], { column: 0, month: "2026-01" });
    assert.deepEqual(heatmapWeeks("2026-02-01", "2026-01-01"), []);
  });
  test("niveles: 0 sin actividad, crecientes con el valor (propiedad)", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 60 }), { minLength: 1, maxLength: 200 }), (values) => {
        const t = heatmapThresholds(values, 4);
        assert.equal(t.length, 4);
        for (let i = 1; i < t.length; i++) assert.ok(t[i]! > t[i - 1]!, "umbrales estrictamente crecientes");
        const sorted = [...values].sort((a, b) => a - b);
        let prev = 0;
        for (const v of sorted) {
          const l = heatmapLevel(v, t);
          assert.ok(l >= prev && l <= 4);
          assert.equal(l === 0, v <= 0);
          prev = l;
        }
      }),
    );
    assert.deepEqual(heatmapThresholds([0, 0]), [1, 2, 3, 4]);
    assert.equal(heatmapLevel(Number.NaN, [1, 2, 3, 4]), 0);
    assert.equal(heatmapLevel(100, [1, 2, 3, 4]), 4);
  });
  test("rachas, día más activo y total", () => {
    const values: Record<string, number> = {};
    for (let i = 0; i < 27; i++) values[addDays("2026-03-01", i)] = 1;
    for (let i = 0; i < 12; i++) values[addDays("2026-11-08", i)] = 2;
    values["2026-12-01"] = 9; // futuro: no cuenta
    const s = streaks(values, "2026-11-19");
    assert.equal(s.longest, 27);
    assert.equal(s.current, 12);
    assert.deepEqual(s.currentRange, { from: "2026-11-08", to: "2026-11-19" });
    assert.deepEqual(s.longestRange, { from: "2026-03-01", to: "2026-03-27" });
    // Hoy aún sin actividad: la racha que acabó ayer sigue.
    assert.equal(streaks(values, "2026-11-20").current, 12);
    assert.equal(streaks(values, "2026-11-22").current, 0);
    assert.equal(streaks({}, "2026-11-19").currentRange, null);
    assert.equal(busiestWeekday({ "2026-11-17": 5, "2026-11-19": 3 }), 2);
    assert.equal(busiestWeekday({}), null);
    assert.equal(heatmapTotal(values, "2026-11-01", "2026-11-30"), 24);
  });
  test("hábitos: el descanso no rompe, el fallo sí, hoy en curso no", () => {
    const states = {
      "2026-11-02": "done",
      "2026-11-03": "done",
      "2026-11-04": "missed",
      "2026-11-05": "done",
      "2026-11-06": "done",
      "2026-11-07": "done",
      "2026-11-08": "rest",
      "2026-11-09": "done",
      "2026-11-10": "done",
      "2026-11-11": "missed",
      "2026-11-12": "done",
      "2026-11-13": "done",
      "2026-11-14": "done",
      "2026-11-15": "rest",
      "2026-11-16": "done",
      "2026-11-17": "done",
      "2026-11-18": "done",
      "2026-11-19": { progress: 60 },
    } as const;
    const s = habitStreak(states, "2026-11-19");
    assert.equal(s.current, 6);
    assert.deepEqual(s.run, ["2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18"]);
    assert.equal(s.longest, 6);
    assert.equal(habitStreak({ ...states, "2026-11-19": "done" }, "2026-11-19").current, 7);
    assert.equal(habitStreak({ ...states, "2026-11-19": "missed" }, "2026-11-19").current, 0);
    assert.equal(habitStreak({ "2026-11-17": "done" }, "2026-11-19").current, 0, "un día vacío en el pasado rompe");
    assert.equal(habitStreak({}, "2026-11-19").longest, 0);
    assert.equal(habitStreak({ "2026-11-19": { progress: 100 } }, "2026-11-19").current, 1);
  });
});

const TASKS: TimelineTask[] = [
  { id: "interviews", title: "User interviews", start: "2026-11-09", end: "2026-11-14", group: "discovery", progress: 100 },
  { id: "synthesis", title: "Synthesis", start: "2026-11-14", end: "2026-11-18", group: "discovery", dependsOn: ["interviews"] },
  { id: "tokens", title: "Tokens v2", start: "2026-11-16", end: "2026-11-24", group: "ds", dependsOn: ["synthesis"] },
  { id: "calendar", title: "Calendar components", start: "2026-11-20", end: "2026-12-03", group: "ds", dependsOn: ["tokens"] },
  { id: "docs", title: "Docs site", start: "2026-11-24", end: "2026-12-03", group: "ds", dependsOn: ["tokens"] },
  { id: "beta", title: "Beta release", start: "2026-12-03", milestone: true, group: "ds", dependsOn: ["calendar"] },
  { id: "guide", title: "Migration guide", start: "2026-12-04", end: "2026-12-10", group: "rollout", dependsOn: ["beta"] },
  { id: "launch", title: "Launch", start: "2026-12-12", group: "rollout", dependsOn: ["guide"] },
];

describe("timeline: escalas, filas y camino crítico", () => {
  test("columnas por día, semana y mes y posición de las barras", () => {
    const days = timelineColumns("2026-11-09", "2026-12-14", "day");
    assert.equal(days.length, 35);
    assert.deepEqual(barPosition("2026-11-10", "2026-11-12", days), { from: 1, span: 2 });
    const weeks = timelineColumns("2026-11-11", "2026-12-14", "week", 1);
    assert.equal(weeks[0]!.date, "2026-11-09");
    assert.equal(weeks.length, 5);
    assert.equal(columnAt("2026-11-12", weeks), 3 / 7);
    const months = timelineColumns("2026-11-15", "2027-01-02", "month");
    assert.deepEqual(
      months.map((m) => [m.date, m.days]),
      [
        ["2026-11-01", 30],
        ["2026-12-01", 31],
        ["2027-01-01", 31],
      ],
    );
    assert.equal(columnAt("2026-12-16", months), 1 + 15 / 31);
    assert.equal(columnAt("2026-10-31", months), -1 / 30);
    assert.equal(columnAt("2027-02-01", months), 3);
    assert.equal(columnAt("2026-01-01", []), 0);
    assert.deepEqual(timelineColumns("2026-02-01", "2026-01-01", "day"), []);
    assert.equal(unitStart("2026-11-19", "month"), "2026-11-01");
    assert.equal(unitStart("2026-11-19", "day"), "2026-11-19");
  });
  test("filas con fases plegables y tareas sueltas al final", () => {
    const groups = [
      { id: "discovery", title: "Discovery" },
      { id: "ds", title: "Design system" },
      { id: "rollout", title: "Rollout", collapsed: true },
      { id: "empty", title: "Empty" },
    ];
    const loose: TimelineTask = { id: "x", title: "Loose", start: "2026-11-10", end: "2026-11-11" };
    const rows = timelineRows([...TASKS, loose], groups, ["discovery"]);
    assert.deepEqual(
      rows.map((r) => (r.kind === "group" ? `[${r.group.id}${r.collapsed ? "+" : ""}]` : r.task.id)),
      ["[discovery+]", "[ds]", "tokens", "calendar", "docs", "beta", "[rollout+]", "x"],
    );
    const ds = rows[1]!;
    assert.ok(ds.kind === "group" && ds.start === "2026-11-16" && ds.end === "2026-12-03");
    // `!id` despliega una fase plegada por defecto.
    assert.ok(timelineRows(TASKS, groups, ["!rollout"]).some((r) => r.kind === "task" && r.task.id === "launch"));
  });
  test("hitos, duración, mover y redimensionar", () => {
    const beta = TASKS.find((t) => t.id === "beta")!;
    assert.ok(isMilestone(beta));
    assert.equal(taskDays(beta), 0);
    assert.equal(taskDays(TASKS[0]!), 5);
    assert.deepEqual(shiftTask(TASKS[0]!, 2), { start: "2026-11-11", end: "2026-11-16" });
    assert.deepEqual(resizeTask(TASKS[0]!, -10), { start: "2026-11-09", end: "2026-11-10" });
    assert.deepEqual(resizeTask(TASKS[0]!, 1), { start: "2026-11-09", end: "2026-11-15" });
    assert.deepEqual(resizeTask(beta, 3), { start: "2026-12-03", end: "2026-12-03" });
  });
  test("camino crítico: la cadena sin holgura hasta el lanzamiento", () => {
    const cp = criticalPath(TASKS);
    // Las tareas solapadas con su previa se empujan (inicio temprano = fin de la previa): toda la cadena queda sin holgura menos «docs».
    assert.deepEqual([...cp.tasks].sort(), ["beta", "calendar", "guide", "interviews", "launch", "synthesis", "tokens"]);
    assert.ok(cp.edges.has("tokens→calendar"));
    assert.ok(!cp.edges.has("tokens→docs"));
    assert.equal(cp.end, "2026-12-15");
    assert.equal(criticalPath([]).end, null);
  });
  test("aristas: sin ciclos, sin referencias rotas, sin bucles", () => {
    const tasks: TimelineTask[] = [
      { id: "a", title: "A", start: "2026-01-01", end: "2026-01-02", dependsOn: ["c", "zz", "a"] },
      { id: "b", title: "B", start: "2026-01-02", end: "2026-01-03", dependsOn: ["a"] },
      { id: "c", title: "C", start: "2026-01-03", end: "2026-01-04", dependsOn: ["b"] },
    ];
    const edges = dependencyEdges(tasks);
    assert.equal(edges.length, 2, JSON.stringify(edges));
    assert.ok(criticalPath(tasks).tasks.size >= 1);
  });
  test("ruta en codo: directa o rodeando, siempre con tramos horizontales o verticales", () => {
    assert.deepEqual(routeDependency({ x: 100, y: 10 }, { x: 160, y: 50 }), [
      { x: 100, y: 10 },
      { x: 108, y: 10 },
      { x: 108, y: 50 },
      { x: 160, y: 50 },
    ]);
    const back = routeDependency({ x: 100, y: 10 }, { x: 60, y: 50 }, 8, 20);
    assert.equal(back.length, 6);
    assert.equal(pathOf(back), "M100 10 L108 10 L108 30 L52 30 L52 50 L60 50");
    assert.equal(routeDependency({ x: 100, y: 50 }, { x: 60, y: 10 }, 8, 20)[2]!.y, 30);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 900 }),
        fc.integer({ min: 0, max: 900 }),
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: 0, max: 40 }),
        (x1, x2, r1, r2) => {
          const pts = routeDependency({ x: x1, y: r1 * 40 }, { x: x2, y: r2 * 40 });
          for (let i = 1; i < pts.length; i++) assert.ok(pts[i]!.x === pts[i - 1]!.x || pts[i]!.y === pts[i - 1]!.y);
          assert.deepEqual(pts.at(-1), { x: x2, y: r2 * 40 });
        },
      ),
    );
  });
});

const H = 3_600_000;
const T0 = Date.parse("2026-11-19T00:00:00Z");
const intervalArb = fc
  .array(fc.tuple(fc.integer({ min: 0, max: 200 }), fc.integer({ min: 1, max: 40 })), { maxLength: 12 })
  .map((list) => list.map(([s, d]) => ({ start: s, end: s + d })));

describe("freebusy: libres comunes", () => {
  test("unir, restar e intersecar (propiedades)", () => {
    fc.assert(
      fc.property(intervalArb, intervalArb, (a, b) => {
        const m = mergeIntervals(a);
        for (let i = 1; i < m.length; i++) assert.ok(m[i]!.start > m[i - 1]!.end, "disjuntos y ordenados");
        const minus = subtractIntervals(a, b);
        assert.deepEqual(intersectIntervals(minus, b), []);
        assert.deepEqual(intersectIntervals(a, b), intersectIntervals(b, a));
        const covered = (list: { start: number; end: number }[], x: number) => list.some((i) => x >= i.start && x < i.end);
        for (let x = 0; x < 240; x += 7) assert.equal(covered(minus, x), covered(a, x) && !covered(b, x));
      }),
    );
    assert.deepEqual(
      mergeIntervals([
        { start: 5, end: 5 },
        { start: Number.NaN, end: 3 },
      ]),
      [],
    );
  });
  test("horas de trabajo en la zona de cada persona y la franja común", () => {
    const madrid = workingIntervals({ start: "09:00", end: "18:00" }, "Europe/Madrid", T0, T0 + 24 * H);
    assert.deepEqual(madrid, [{ start: T0 + 8 * H, end: T0 + 17 * H }]);
    const tokyo = workingIntervals({ start: "09:00", end: "18:00" }, "Asia/Tokyo", T0, T0 + 24 * H);
    // Jueves en Tokio 09:00–18:00 = 00:00–09:00 UTC; el viernes empieza a las 24:00 UTC.
    assert.deepEqual(tokyo, [{ start: T0, end: T0 + 9 * H }]);
    assert.deepEqual(workingIntervals(null, "UTC", 0, 10), [{ start: 0, end: 10 }]);
    assert.deepEqual(workingIntervals({ start: "x", end: "18:00" }, "UTC", 0, 10), [{ start: 0, end: 10 }]);
    assert.equal(workingIntervals({ start: "09:00", end: "18:00", days: [0] }, "UTC", T0, T0 + 24 * H).length, 0);
    assert.equal(workingIntervals({ start: "22:00", end: "06:00", days: [4] }, "UTC", T0, T0 + 48 * H)[0]!.end, T0 + 30 * H);
    assert.equal(workingIntervals({ start: "08:00", end: "24:00", days: [4] }, "UTC", T0, T0 + 48 * H)[0]!.end, T0 + 24 * H);
    const people: Attendee[] = [
      {
        id: "m",
        name: "Marta",
        timeZone: "Europe/Madrid",
        workingHours: { start: "09:00", end: "18:00" },
        busy: [{ start: "2026-11-19T08:00:00Z", end: "2026-11-19T09:30:00Z" }],
      },
      {
        id: "d",
        name: "Dana",
        timeZone: "America/New_York",
        workingHours: { start: "08:00", end: "17:00" },
        busy: [{ start: T0 + 15 * H, end: T0 + 16 * H }],
      },
      { id: "o", name: "Optional", timeZone: "UTC", busy: [{ start: T0, end: T0 + 24 * H }], optional: true },
    ];
    // Dana empieza a las 13:00 UTC; Marta acaba a las 17:00 UTC; Dana está ocupada 15–16 UTC.
    const common = commonFree(people, T0, T0 + 24 * H);
    assert.deepEqual(common, [
      { start: T0 + 13 * H, end: T0 + 15 * H },
      { start: T0 + 16 * H, end: T0 + 17 * H },
    ]);
    assert.deepEqual(firstSlot(people, T0, T0 + 24 * H, 60), { start: T0 + 13 * H, end: T0 + 14 * H });
    assert.equal(findSlots(people, T0, T0 + 24 * H, 60, { step: 30 }).length, 4);
    assert.deepEqual(findSlots(people, T0, T0 + 24 * H, 600), []);
    assert.equal(busyOf(people[0]!).length, 1);
    assert.equal(freeOf({ id: "x", name: "X", busy: [] }, 0, 10).length, 1);
  });
});

describe("virtual: ventana visible", () => {
  test("alto fijo y variable cubren lo visible (propiedad)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3000 }),
        fc.integer({ min: 8, max: 120 }),
        fc.integer({ min: 0, max: 200_000 }),
        fc.integer({ min: 0, max: 2000 }),
        fc.boolean(),
        (count, row, scroll, viewport, variable) => {
          const size = variable ? (i: number) => row + (i % 5) * 3 : row;
          const w = virtualWindow({ count, size, scroll, viewport, overscan: 2 });
          const pos = offsets(count, size);
          assert.equal(w.total, pos[count]);
          assert.ok(w.start < w.end && w.end <= count);
          assert.equal(w.before, pos[w.start]);
          assert.equal(w.after, w.total - pos[w.end]!);
          const top = Math.min(scroll, Math.max(0, w.total - 1));
          if (scroll < w.total) assert.ok(pos[w.start]! <= top, "la primera fila visible está pintada");
          if (scroll + viewport <= w.total && viewport > 0) assert.ok(pos[w.end]! >= scroll + viewport - 1 || w.end === count);
        },
      ),
    );
    assert.deepEqual(virtualWindow({ count: 0, size: 10, scroll: 0, viewport: 100 }), { start: 0, end: 0, before: 0, after: 0, total: 0 });
    assert.equal(indexAt([0], 5), 0);
    assert.equal(indexAt(offsets(10, 10), 55), 5);
  });
});

describe("slots: franjas de cita", () => {
  test("disponibilidad del anfitrión, días del visitante y horas en 12/24 h", () => {
    const slots = availabilitySlots(
      [{ days: [1, 2, 3, 4, 5], start: "09:00", end: "11:00" }],
      "Europe/Madrid",
      "2026-11-19",
      "2026-11-22",
      30,
      {
        busy: [{ start: Date.parse("2026-11-19T08:30:00Z"), end: Date.parse("2026-11-19T09:00:00Z") }],
      },
    );
    // Jueves y viernes, cuatro franjas cada uno, menos la ocupada.
    assert.equal(slots.length, 7);
    assert.equal(new Date(slots[0]!).toISOString(), "2026-11-19T08:00:00.000Z");
    assert.deepEqual(availabilitySlots([], "UTC", "2026-11-20", "2026-11-19", 30), []);
    assert.equal(availabilitySlots([{ days: [4], start: "x", end: "10:00" }], "UTC", "2026-11-19", "2026-11-19", 30).length, 0);
    assert.equal(
      availabilitySlots([{ days: [4], start: "09:00", end: "10:00" }], "UTC", "2026-11-19", "2026-11-19", 30, {
        notBefore: Date.parse("2026-11-19T09:10:00Z"),
      }).length,
      1,
    );
    // Una franja de las 00:30 del anfitrión cae el día anterior del visitante de Nueva York.
    const late = availabilitySlots([{ days: [5], start: "00:30", end: "01:00" }], "Europe/Madrid", "2026-11-20", "2026-11-20", 30);
    const byDay = slotsByDay([...late, "2026-11-19T10:00:00Z", "bad"], "America/New_York");
    assert.deepEqual([...byDay.keys()], ["2026-11-19"]);
    assert.equal(byDay.get("2026-11-19")!.length, 2);
    assert.equal(slotLabel(Date.parse("2026-11-19T14:30:00Z"), "Europe/Madrid", "en-GB", "h23"), "15:30");
    assert.match(slotLabel(Date.parse("2026-11-19T14:30:00Z"), "Europe/Madrid", "en-US", "h12"), /^3:30\sPM$/);
    assert.equal(slotLabel(Date.parse("2026-11-19T14:30:00Z"), "UTC", "en-GB"), "14:30");
    assert.equal(localeHourCycle("en-US"), "h12");
    assert.equal(localeHourCycle("es-ES"), "h23");
  });
});

import {
  belowMinimum,
  buildCalendar,
  choose,
  rangeBlocked,
  rangeNights,
  readSelection,
  stepRange,
  type CalendarRules,
} from "../../zui/src/core/calendar.ts";
import { perpetualTree, yearGrid, PERPETUAL_LABELS } from "../../zui/src/core/agenda-year.ts";
import { conflicts, resourceTimeline, taskTimeline, TIMELINE_LABELS } from "../../zui/src/core/timeline-view.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";
import { heatmapWidget } from "../../zui/src/core/heatmap-widget.ts";
import { habitWidget } from "../../zui/src/core/habit-widget.ts";
import { slotPickerWidget } from "../../zui/src/core/slots-widget.ts";
import { freeBusyWidget } from "../../zui/src/core/freebusy-widget.ts";
import { perpetualWidget } from "../../zui/src/core/perpetual-widget.ts";
import { timelineWidget } from "../../zui/src/core/timeline-widget.ts";

describe("calendar: estancia", () => {
  const booked = new Set(["2026-11-20", "2026-11-21", "2026-11-22"]);
  const rules: CalendarRules = {
    nights: true,
    minRange: 2,
    allowSingleDayRange: false,
    isDateUnavailable: (d) => booked.has(d),
    isDateCheckoutOnly: (d) => d === "2026-11-20" || d === "2026-12-04",
  };
  const sel = (from: string | null, to: string | null = null) => readSelection("range", { from, to });
  test("solo salida: no empieza, sí cierra (también el primer día reservado)", () => {
    assert.equal(choose("range", sel(null), "2026-12-04", rules), undefined);
    assert.deepEqual(choose("range", sel("2026-11-17"), "2026-11-20", rules), { from: "2026-11-17", to: "2026-11-20" });
    assert.deepEqual(choose("range", sel("2026-11-30"), "2026-12-04", rules), { from: "2026-11-30", to: "2026-12-04" });
    assert.equal(choose("range", sel("2026-12-06"), "2026-12-04", rules), undefined, "solo salida antes del inicio");
    assert.equal(choose("range", sel("2026-11-24"), "2026-11-24", rules), undefined, "sin rango de un día con noches");
  });
  test("mínimo de noches, noches del rango y ajuste ±1", () => {
    assert.ok(belowMinimum("2026-11-24", "2026-11-25", rules));
    assert.ok(!belowMinimum("2026-11-24", "2026-11-26", rules));
    assert.ok(rangeBlocked("2026-11-24", "2026-11-25", rules));
    assert.equal(rangeNights({ from: "2026-11-24", to: "2026-11-29" }), 5);
    assert.equal(rangeNights({ from: "2026-11-24", to: null }), null);
    assert.deepEqual(stepRange({ from: "2026-11-24", to: "2026-11-29" }, 1, rules), { from: "2026-11-24", to: "2026-11-30" });
    assert.equal(stepRange({ from: "2026-11-24", to: "2026-11-26" }, -1, rules), null, "bajo el mínimo");
    assert.equal(stepRange({ from: "2026-11-17", to: "2026-11-19" }, 2, rules), null, "cruza lo reservado");
    assert.deepEqual(
      stepRange({ from: "2026-11-17", to: "2026-11-19" }, 1, rules),
      { from: "2026-11-17", to: "2026-11-20" },
      "hasta el día de solo salida",
    );
    assert.equal(stepRange({ from: null, to: null }, 1, rules), null);
    assert.equal(stepRange({ from: "2026-11-24", to: "2026-11-26" }, 3, { ...rules, maxRange: 3 }), null, "máximo");
  });
  test("modelo: solo salida deshabilitado sin inicio, habilitado al cerrar, aviso del mínimo", () => {
    const base = {
      mode: "range" as const,
      rules,
      month: "2026-11",
      numberOfMonths: 2,
      weekStart: 1,
      today: "2026-11-19",
      labels: { checkoutOnly: "check-out only", minimum: "{n}-night minimum" },
    };
    const cell = (m: ReturnType<typeof buildCalendar>, d: string) =>
      m.months.flatMap((x) => x.weeks.flatMap((w) => w.cells)).find((c) => c.date === d && !c.outside)!;
    const idle = buildCalendar({ ...base, selection: sel("2026-11-24", "2026-11-29") });
    assert.ok(cell(idle, "2026-12-04").disabled && cell(idle, "2026-12-04").checkoutOnly);
    assert.match(cell(idle, "2026-12-04").ariaLabel, /check-out only/);
    const picking = buildCalendar({ ...base, selection: sel("2026-11-17"), preview: "2026-11-18" });
    assert.ok(!cell(picking, "2026-11-20").disabled, "el primer reservado de solo salida cierra");
    assert.ok(cell(picking, "2026-11-18").belowMinimum && cell(picking, "2026-11-18").disabled);
    assert.equal(cell(picking, "2026-11-18").hint, "2-night minimum");
    assert.match(cell(picking, "2026-11-18").ariaLabel, /2-night minimum/);
  });
});

describe("vistas de la agenda: árboles", () => {
  test("año: 12 meses con densidad, hoy y una parada de Tab", () => {
    const html = toHTML(
      yearGrid({
        year: 2026,
        weekStart: 1,
        locale: "en-GB",
        today: "2026-11-19",
        focus: "2026-11-19",
        counts: new Map([
          ["2026-11-19", 4],
          ["2026-11-18", 1],
          ["2026-11-17", 2],
        ]),
        labels: { events: "{n} events", event: "1 event", title: "2026" },
      }),
    );
    assert.equal(html.match(/role="grid"/g)?.length, 12);
    assert.equal(html.match(/tabindex="0"/g)?.length, 1);
    assert.match(html, /data-date="2026-11-19"[^>]*data-load="3"[^>]*data-today/);
    assert.match(html, /Thursday, 19 November 2026, 4 events/);
    assert.match(html, /data-date="2026-11-18"[^>]*data-load="1"/);
    assert.match(html, /Tuesday, 17 November 2026, 2 events/);
    const custom = toHTML(
      yearGrid({
        year: 2026,
        weekStart: 0,
        today: "2026-01-01",
        focus: "2026-01-01",
        counts: new Map(),
        density: () => 2,
        labels: { events: "{n} events", event: "1 event", title: "2026" },
      }),
    );
    assert.match(custom, /data-load="2"/);
  });
  test("perpetuo: caption, cruz y resultado; sin resaltado fuera del año", () => {
    const html = toHTML(
      perpetualTree({ uid: "p", year: 2026, weekStart: 1, locale: "en-GB", highlight: "2026-11-19", labels: PERPETUAL_LABELS }),
    );
    assert.match(html, /<caption[^>]*>2026 · One-page calendar<\/caption>/);
    assert.equal(html.match(/data-hit/g)?.length, 2);
    assert.match(html, /19 Nov 2026 → Thursday/);
    const other = toHTML(perpetualTree({ uid: "p", year: 2025, weekStart: 0, highlight: "2026-11-19", labels: PERPETUAL_LABELS }));
    assert.ok(!other.includes("data-hit"));
  });
  test("Gantt: filas, dependencias, camino crítico, hitos, escala por semanas y meses", () => {
    const input = {
      uid: "g",
      tasks: TASKS,
      groups: [
        { id: "discovery", title: "Discovery" },
        { id: "ds", title: "Design system" },
        { id: "rollout", title: "Rollout" },
      ],
      from: "2026-11-09",
      to: "2026-12-14",
      today: "2026-11-19",
      locale: "en-GB",
      weekStart: 1,
      collapsed: [],
      focus: null,
      selected: "tokens",
      preview: { id: "docs", start: "2026-11-25", end: "2026-12-04" },
      grabbed: "docs",
      showCritical: true,
      showDependencies: true,
      editable: true,
      labels: TIMELINE_LABELS,
    };
    for (const scale of ["day", "week", "month"] as const) {
      const html = toHTML(taskTimeline({ ...input, scale }));
      assert.match(html, /role="treegrid"/);
      assert.equal(html.match(/data-group-id=/g)?.length, 3);
      assert.match(html, /data-critical/);
      assert.match(html, /Depends on Tokens v2/);
      assert.match(html, /marker-end="url\(#g-arrow-critical\)"/);
      assert.match(html, /aria-pressed="true"/);
    }
    const folded = toHTML(
      taskTimeline({ ...input, scale: "day", collapsed: ["ds"], showCritical: false, showDependencies: false, focus: "g:ds" }),
    );
    assert.ok(!folded.includes('data-task="tokens"'));
    assert.match(folded, /aria-expanded="false"/);
  });
  test("recursos: conflictos en mitades, ventana virtual y selección de creación", () => {
    const items = [
      { key: "a", resourceId: "r1", start: 600, end: 660 },
      { key: "b", resourceId: "r1", start: 630, end: 700 },
      { key: "c", resourceId: "r2", start: 700, end: 760 },
    ];
    assert.deepEqual(
      [...conflicts(items).entries()],
      [
        ["a", "top"],
        ["b", "bottom"],
      ],
    );
    const resources = Array.from({ length: 500 }, (_, i) => ({ id: `r${i}`, title: `Room ${i}` }));
    const html = toHTML(
      resourceTimeline({
        uid: "r",
        resources,
        items,
        dayStart: 480,
        dayEnd: 1140,
        now: 642,
        locale: "en-GB",
        scroll: { top: 0, height: 520 },
        creating: { resourceId: "r2", start: 780, end: 840 },
        labels: { resource: "Room", overlaps: "Overlaps", newBooking: "New booking" },
        renderItem: (it, layout) => ({ t: "button", a: { "data-key": it.key, "data-half": layout.half ?? undefined }, c: [it.key] }),
      }),
    );
    assert.match(html, /aria-rowcount="501"/);
    assert.ok((html.match(/role="row"/g)?.length ?? 0) < 30, "solo las filas visibles");
    assert.match(html, /z-timeline__spacer/);
    assert.match(html, /data-half="bottom"/);
    assert.match(html, /New booking/);
    assert.match(html, /z-timeline__now/);
  });
  test("piezas: configuración, estado inicial y árbol de cada una", () => {
    const run = <P, C, S>(
      w: { configure(p: P): C; initial(c: C): S; tree(c: C, s: S, uid: string): unknown; control?(c: C, s: S): S },
      props: P,
    ) => {
      const c = w.configure(props);
      const s = w.control ? w.control(c, w.initial(c)) : w.initial(c);
      return toHTML(w.tree(c, s, "u") as never);
    };
    const values = { "2026-11-12": 14, "2026-11-13": 2, "2026-11-18": 5 };
    assert.match(
      run(heatmapWidget, {
        values,
        range: { from: "2026-11-02", to: "2026-11-29" },
        today: "2026-11-19",
        locale: "en-GB",
        weekStartsOn: 1,
        title: "T",
      }),
      /14 contributions on Thursday 12 November/,
    );
    assert.match(
      run(heatmapWidget, {
        values,
        today: "2026-11-19",
        encoding: "size",
        outline: true,
        levels: [1, 3, 5, 10],
        defaultView: "table",
        showStats: false,
      }),
      /<table/,
    );
    assert.match(
      run(habitWidget, { states: { "2026-11-18": "done", "2026-11-19": { progress: 40 } }, today: "2026-11-19", locale: "en-GB" }),
      /Today 40%/,
    );
    assert.match(
      run(habitWidget, { states: { "2026-11-18": "done" }, today: "2026-11-19", variant: "week", subtitle: "German", note: "Go" }),
      /1 day streak/,
    );
    const slots = run(slotPickerWidget, {
      availability: [{ days: [1, 2, 3, 4, 5], start: "09:00", end: "11:00" }],
      hostTimeZone: "Europe/Madrid",
      duration: 30,
      from: "2026-11-23",
      to: "2026-11-24",
      timeZone: "America/New_York",
      timeZones: ["Europe/Madrid"],
      now: "2026-11-19T09:42:00Z",
      today: "2026-11-19",
      locale: "en-US",
      hourCycle: "h12",
      value: "2026-11-23T08:30:00Z",
    });
    assert.match(slots, /role="listbox"/);
    assert.match(slots, /aria-selected="true"/);
    assert.match(slots, /3:30\sAM/);
    assert.match(run(slotPickerWidget, { slots: [], today: "2026-11-19" }), /No times available/);
    assert.match(
      run(freeBusyWidget, {
        attendees: [
          {
            id: "a",
            name: "Ana Pérez",
            timeZone: "Asia/Tokyo",
            workingHours: { start: "09:00", end: "18:00" },
            busy: [{ start: "2026-11-19T00:00:00Z", end: "2026-11-19T01:00:00Z" }],
          },
        ],
        date: "2026-11-19",
        timeZone: "Europe/Madrid",
        dayStart: "00:00",
        dayEnd: "24:00",
        now: "2026-11-19T09:42:00Z",
      }),
      /Outside hours/,
    );
    assert.match(run(perpetualWidget, { defaultHighlight: "2026-11-19", today: "2026-11-19", locale: "en-GB" }), /data-shown-year="2026"/);
    assert.match(run(timelineWidget, { tasks: TASKS, groups: [], today: "2026-11-19", scale: "week", title: "Plan" }), /data-scale="week"/);
    assert.match(
      run(timelineWidget, {
        mode: "resources",
        resources: [{ id: "a", title: "Atlas" }],
        events: [
          {
            id: "x",
            title: "X",
            start: "2026-11-19T10:00",
            end: "2026-11-19T11:00",
            timeZone: "Europe/Madrid",
            calendarId: "w",
            resourceIds: ["a"],
          },
        ],
        date: "2026-11-19",
        timeZone: "Europe/Madrid",
        now: "2026-11-19T09:42:00Z",
      }),
      /data-key="x@a"/,
    );
  });
});
