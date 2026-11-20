// Agenda, rendimiento: índice por intervalos y memoria por rango de expandEvents, carriles con tope, solapes con tope
// en la rejilla de horas («+N» por hora), índice por día, ventana virtual de la lista larga y trabajo tras pintar.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { dayStart, expandEvents, layoutRow, visibleDays, type CalendarEvent } from "../../zui/src/core/agenda.ts";
import {
  agendaTree,
  byDay,
  initialState,
  LIST_METRICS,
  mergeLabels,
  planTimeGrid,
  timeGridStack,
  type AgendaConfig,
  type AgendaState,
  type VEl,
  type VNode,
} from "../../zui/src/core/agenda-view.ts";
import { afterPaint, postTask } from "../../zui/src/core/idle.ts";

const MAD = "Europe/Madrid";
const pad = (n: number) => String(n).padStart(2, "0");
const at = (day: number, minute: number) => `2026-11-${pad(day)}T${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

/** Eventos deterministas de noviembre (como la etapa de rendimiento de la app de ejemplo). */
function many(n: number, perHour = false): CalendarEvent[] {
  let seed = 11;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: n }, (_, i) => {
    const day = perHour ? 19 : 1 + Math.floor(next() * 30);
    const start = (7 + Math.floor(next() * 12)) * 60 + [0, 15, 30, 45][Math.floor(next() * 4)]!;
    const length = [15, 30, 45, 60, 90, 120][Math.floor(next() * 6)]!;
    return {
      id: `p${i}`,
      title: `Event ${i}`,
      start: at(day, start),
      end: at(day, start + length),
      timeZone: MAD,
      calendarId: `c${i % 3}`,
    };
  });
}

function config(events: CalendarEvent[], extra: Partial<AgendaConfig> = {}): AgendaConfig {
  return {
    events,
    calendars: [
      { id: "c0", name: "Work", color: "1" },
      { id: "c1", name: "Team", color: "2" },
      { id: "c2", name: "Home", color: "3" },
    ],
    views: ["day", "week", "month", "agenda", "year"],
    timeZone: MAD,
    locale: "en-GB",
    weekStart: 1,
    dayStart: 0,
    dayEnd: 1440,
    slotDuration: 30,
    snapDuration: 15,
    editable: true,
    selectable: false,
    dayMaxEvents: 3,
    fixedWeeks: false,
    listDays: 30,
    sidebar: true,
    showWeekNumber: true,
    createButton: false,
    labels: mergeLabels(undefined),
    today: "2026-11-19",
    now: Date.parse("2026-11-19T09:42:00Z"),
    ...extra,
  };
}
const NOW = Date.parse("2026-11-19T09:42:00Z");

/** Todos los elementos del árbol que cumplen `pred`. */
function all(node: VNode, pred: (el: VEl) => boolean, out: VEl[] = []): VEl[] {
  if (!node || typeof node === "string" || "slot" in node) return out;
  if (pred(node)) out.push(node);
  for (const c of node.c ?? []) all(c, pred, out);
  return out;
}
const hasClass = (cls: string) => (el: VEl) =>
  String(el.a?.class ?? "")
    .split(" ")
    .includes(cls);

describe("expandEvents: índice por intervalos y memoria por rango", () => {
  test("propiedad: igual que expandir cada evento por separado (sueltos, series, ocultos, cancelados)", () => {
    const event = fc
      .record({
        day: fc.integer({ min: 1, max: 28 }),
        start: fc.integer({ min: 0, max: 1380 }),
        len: fc.integer({ min: 0, max: 3000 }),
        cal: fc.constantFrom("a", "b"),
        kind: fc.constantFrom("timed", "allday", "series", "cancelled"),
      })
      .map(({ day, start, len, cal, kind }, i): CalendarEvent => {
        const base = { id: `e${i}-${day}-${start}`, title: `E${start}`, calendarId: cal };
        if (kind === "allday") return { ...base, start: `2026-11-${pad(day)}`, end: `2026-11-${pad(Math.min(30, day + 1 + (len % 3)))}` };
        const s = dayStart(`2026-11-${pad(day)}`) + start;
        const iso = (m: number) => {
          const d = new Date(m * 60_000);
          return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
        };
        return {
          ...base,
          start: iso(s),
          end: iso(s + len),
          timeZone: MAD,
          ...(kind === "series" ? { rrule: "FREQ=DAILY;COUNT=5" } : {}),
          ...(kind === "cancelled" ? { status: "cancelled" as const } : {}),
        };
      });
    fc.assert(
      fc.property(
        fc.array(event, { maxLength: 25 }),
        fc.integer({ min: 1, max: 25 }),
        fc.integer({ min: 0, max: 9 }),
        fc.boolean(),
        (events, from, span, hide) => {
          const range = {
            from: `2026-11-${pad(from)}`,
            to: `2026-11-${pad(Math.min(30, from + span))}`,
            timeZone: MAD,
            hidden: hide ? ["b"] : [],
          };
          const got = expandEvents({ events, ...range }).map((o) => o.key);
          const want = events
            .flatMap((e) => expandEvents({ events: [e], ...range }))
            .sort((a, b) => a.start - b.start || b.end - a.end || a.event.title.localeCompare(b.event.title))
            .map((o) => o.key);
          assert.deepEqual([...got].sort(), [...want].sort());
        },
      ),
      { numRuns: 120 },
    );
  });
  test("el mismo rango da la misma lista; un evento cambiado en su sitio se vuelve a indexar", () => {
    const events = many(400);
    const range = { from: "2026-11-16", to: "2026-11-22", timeZone: MAD };
    const a = expandEvents({ events, ...range });
    assert.equal(expandEvents({ events, ...range }), a, "memoria por rango");
    assert.notEqual(expandEvents({ events, ...range, hidden: ["c1"] }), a, "otros calendarios ocultos, otra lista");
    const moved = a[0]!.event;
    moved.start = "2026-12-01T10:00";
    moved.end = "2026-12-01T11:00";
    const b = expandEvents({ events, ...range });
    assert.notEqual(b, a);
    assert.ok(!b.some((o) => o.event === moved), "el evento movido fuera del rango ya no sale");
    events.push({ id: "late", title: "Late", start: "2026-11-18T20:00", end: "2026-11-18T21:00", timeZone: MAD, calendarId: "c0" });
    assert.ok(
      expandEvents({ events, ...range }).some((o) => o.key === "late"),
      "una lista que crece en su sitio también",
    );
  });
  test("el que empieza antes del rango y lo pisa sale (duración máxima en el índice)", () => {
    const events: CalendarEvent[] = [
      { id: "long", title: "Long", start: "2026-11-02T10:00", end: "2026-11-20T10:00", timeZone: MAD, calendarId: "c0" },
      ...many(50),
    ];
    assert.ok(expandEvents({ events, from: "2026-11-19", to: "2026-11-19", timeZone: MAD }).some((o) => o.key === "long"));
    assert.ok(!expandEvents({ events, from: "2026-11-21", to: "2026-11-21", timeZone: MAD }).some((o) => o.key === "long"));
  });
});

describe("carriles con tope", () => {
  test("propiedad: con tope, los carriles visibles son los mismos que sin tope", () => {
    const days = visibleDays("week", "2026-11-19", 1);
    const d0 = dayStart(days[0]!);
    const item = fc
      .tuple(fc.integer({ min: -2, max: 7 }), fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 20 }))
      .map(([from, len, h]) => ({
        start: d0 + from * 1440 + h * 60,
        end: d0 + (from + len) * 1440 + h * 60 + 30,
      }));
    fc.assert(
      fc.property(fc.array(item, { maxLength: 40 }), fc.integer({ min: 1, max: 5 }), (items, max) => {
        const free = layoutRow(items, days);
        const capped = layoutRow(items, days, max);
        for (const bar of capped.bars) {
          const same = free.bars.find((b) => b.item === bar.item)!;
          assert.equal(bar.lane, same.lane);
        }
        assert.equal(capped.lanes, Math.min(free.lanes, max));
        assert.deepEqual(
          capped.hidden.map((h) => h.length),
          layoutRowReference(free, days.length, max),
        );
      }),
    );
  });
});

/** «+N» por día a partir de la distribución sin tope (lo que hacía el algoritmo antes del corte por carriles). */
function layoutRowReference(free: ReturnType<typeof layoutRow>, n: number, max: number): number[] {
  if (free.lanes <= max) return Array(n).fill(0);
  const visible = max - 1;
  const hidden: unknown[][] = Array.from({ length: n }, () => []);
  for (const bar of free.bars) if (bar.lane >= visible) for (let c = bar.from; c < bar.from + bar.span; c++) hidden[c]!.push(bar.item);
  for (const bar of free.bars) if (bar.lane === visible && bar.span === 1 && hidden[bar.from]!.length === 1) hidden[bar.from] = [];
  return hidden.map((h) => h.length);
}

describe("rejilla de horas con tope de solapes", () => {
  test("un día con 300 eventos pinta lo que cabe y el resto en «+N» por hora; nada se pierde", () => {
    const c = config(many(300, true));
    const state: AgendaState = { ...initialState(c, "week", "2026-11-19") };
    const { tree, model } = agendaTree(c, state, NOW);
    const plan = planTimeGrid(c, state, model);
    const thursday = plan.days.get("2026-11-19")!;
    const cap = timeGridStack(7);
    assert.ok(thursday.segs.every(({ p }) => p.n <= cap && p.col + p.w <= p.n));
    const shown = thursday.segs.length;
    const behind = thursday.chips.reduce((n, chip) => n + chip.count, 0);
    assert.equal(shown + behind, 300, "visibles + ocultos = todos");
    assert.ok(shown < 60, `pinta lo que cabe: ${shown}`);
    const chips = all(tree, hasClass("z-timegrid__overflow"));
    assert.equal(chips.length, thursday.chips.length);
    for (let i = 1; i < thursday.chips.length; i++) assert.ok(thursday.chips[i]!.start >= thursday.chips[i - 1]!.start + 30, "no se tapan");
    assert.match(String(chips[0]!.a?.["aria-label"]), /^\+\d+ more, Thursday 19 November, /);
    // Lo oculto no lleva el tabulador: si se pide, va al primero visible.
    const hiddenKey = [...plan.hidden][0]!;
    const again = agendaTree(c, { ...state, focus: `e:${hiddenKey}` }, NOW);
    assert.notEqual(again.model.focusId, `e:${hiddenKey}`);
    // El «+N» sí: y su popover lista el intervalo.
    const chipId = thursday.chips[0]!.id;
    const withChip = agendaTree(c, { ...state, focus: chipId, more: String(chips[0]!.a?.["data-more"]) }, NOW);
    assert.equal(withChip.model.focusId, chipId);
    const pop = all(withChip.tree, hasClass("z-agenda__pop"))[0]!;
    assert.match(String(pop.a?.["aria-label"]), /^Thursday 19 November, /);
    assert.ok(all(pop, hasClass("z-event")).length >= thursday.chips[0]!.count);
  });
  test("el que se mueve no desaparece detrás de «+N»", () => {
    const c = config(many(300, true));
    const base = initialState(c, "week", "2026-11-19");
    const { model } = agendaTree(c, base, NOW);
    const hiddenKey = [...planTimeGrid(c, base, model).hidden][0]!;
    const o = model.occurrences.find((x) => x.key === hiddenKey)!;
    const state = { ...base, grabbed: { key: o.key, mode: "move" as const, start: o.start, end: o.end } };
    const plan = planTimeGrid(c, state, agendaTree(c, state, NOW).model);
    assert.ok(!plan.hidden.has(hiddenKey));
    assert.ok(plan.days.get("2026-11-19")!.segs.some((s) => s.seg.item.key === hiddenKey && s.floating));
  });
  test("sin muchos solapes, todo igual que antes (ningún «+N»)", () => {
    const c = config(many(20));
    const state = initialState(c, "week", "2026-11-19");
    const plan = planTimeGrid(c, state, agendaTree(c, state, NOW).model);
    assert.equal(plan.hidden.size, 0);
    assert.equal(plan.chips.size, 0);
  });
});

describe("índice por día", () => {
  test("propiedad: igual que filtrar la lista por cada día", () => {
    const days = visibleDays("month", "2026-11-19", 1);
    const d0 = dayStart(days[0]!);
    const item = fc
      .tuple(fc.integer({ min: -3000, max: 60000 }), fc.integer({ min: 0, max: 5000 }))
      .map(([s, len]) => ({ start: d0 + s, end: d0 + s + len }));
    fc.assert(
      fc.property(fc.array(item, { maxLength: 60 }), (items) => {
        const map = byDay(items, days);
        for (const d of days) {
          const want = items.filter((o) => o.start < dayStart(d) + 1440 && Math.max(o.end, o.start + 1) > dayStart(d));
          assert.deepEqual(map.get(d), want);
        }
      }),
    );
  });
});

describe("lista larga con ventana virtual", () => {
  const c = config(many(3000), { views: ["agenda"] });
  const base = initialState(c, "agenda", "2026-11-01");
  test("pinta la ventana con margen y rellena el resto; el total de filas se anuncia", () => {
    const { tree } = agendaTree(c, base, NOW);
    const list = all(tree, hasClass("z-agendalist"))[0]!;
    assert.equal(list.a?.["data-virtual"], "");
    const rows = all(tree, hasClass("z-agendalist__item"));
    assert.ok(rows.length > 10 && rows.length < 60, `filas pintadas: ${rows.length}`);
    assert.ok(rows.every((r) => Number(r.a?.["aria-setsize"]) > 0 && Number(r.a?.["aria-posinset"]) >= 1));
    const spacers = all(tree, hasClass("z-agendalist__spacer"));
    const filled = spacers.reduce((n, s) => n + Number.parseFloat(String(s.s?.["--z-vl-size"])), 0);
    assert.ok(filled > 3000 * LIST_METRICS.row * 0.8, `relleno del alto de lo que no se pinta: ${filled}`);
  });
  test("al desplazar cambia la ventana; la fila con el foco se pinta siempre", () => {
    const top = agendaTree(c, base, NOW);
    const firstTop = all(top.tree, hasClass("z-agendalist__item"))[0]!.k;
    const scrolled = agendaTree(c, { ...base, listScroll: { top: 40_000, height: 600 } }, NOW);
    const firstScrolled = all(scrolled.tree, hasClass("z-agendalist__item"))[0]!.k;
    assert.notEqual(firstScrolled, firstTop);
    const lastKey = top.model.occurrences[top.model.occurrences.length - 1]!.key;
    const focused = agendaTree(c, { ...base, focus: `e:${lastKey}` }, NOW);
    assert.equal(focused.model.focusId, `e:${lastKey}`);
    assert.ok(all(focused.tree, (el) => el.a?.["data-focus-id"] === `e:${lastKey}`).length >= 1, "el foco tiene pieza");
  });
  test("pocas filas: la lista entera, sin ventana", () => {
    const small = config(many(40), { views: ["agenda"] });
    const { tree } = agendaTree(small, initialState(small, "agenda", "2026-11-01"), NOW);
    assert.equal(all(tree, hasClass("z-agendalist"))[0]!.a?.["data-virtual"], undefined);
    assert.equal(all(tree, hasClass("z-agendalist__spacer")).length, 0);
  });
});

describe("memoria del marcado de cada evento", () => {
  test("mover el foco reutiliza los nodos de los eventos que no cambian", () => {
    const c = config(many(200));
    const state = initialState(c, "week", "2026-11-19");
    const a = agendaTree(c, state, NOW);
    const evs = all(a.tree, hasClass("z-event"));
    const key = String(evs[3]!.a?.["data-key"]);
    const b = agendaTree(c, { ...state, focus: `e:${key}` }, NOW);
    const evsB = all(b.tree, hasClass("z-event"));
    const reused = evsB.filter((el) => evs.includes(el)).length;
    assert.ok(reused >= evsB.length - 2, `reutilizados ${reused} de ${evsB.length}`);
    assert.ok(
      evsB.every((el) => el.m),
      "marcados como memorizados",
    );
    const custom = agendaTree({ ...c, customEvents: true }, state, NOW);
    assert.ok(
      all(custom.tree, hasClass("z-event")).every((el) => !el.m),
      "con renderEvent no se memoriza",
    );
  });
});

describe("trabajo tras pintar", () => {
  test("postTask sin scheduler: una tarea nueva; abortado, no corre", async () => {
    const order: string[] = [];
    postTask(() => order.push("task"));
    order.push("sync");
    const abort = new AbortController();
    postTask(() => order.push("aborted"), { signal: abort.signal });
    abort.abort();
    postTask(() => order.push("never"), { signal: abort.signal });
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(order, ["sync", "task"]);
  });
  test("con scheduler.postTask, la prioridad y la señal llegan; afterPaint espera un fotograma", async () => {
    const g = globalThis as { scheduler?: unknown; requestAnimationFrame?: unknown };
    const calls: unknown[] = [];
    g.scheduler = {
      postTask(fn: () => void, options: unknown) {
        calls.push(options);
        return Promise.resolve().then(fn);
      },
    };
    const frames: (() => void)[] = [];
    g.requestAnimationFrame = (cb: () => void) => frames.push(cb);
    try {
      let ran = false;
      afterPaint(() => (ran = true), { priority: "background" });
      await Promise.resolve();
      assert.equal(ran, false, "antes del fotograma, nada");
      frames.shift()!();
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(ran, true);
      assert.deepEqual(calls, [{ priority: "background", signal: undefined }]);
      const abort = new AbortController();
      abort.abort();
      afterPaint(() => calls.push("no"), { signal: abort.signal });
      assert.equal(frames.length, 0);
    } finally {
      delete g.scheduler;
      delete g.requestAnimationFrame;
    }
  });
});
