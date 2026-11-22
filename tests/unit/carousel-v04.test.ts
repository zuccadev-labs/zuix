// v0.4, oleada 1: anunciador central, ejes del carrusel (layout y effect), keylines de Material 3, bucle sin
// réplicas, historias, zoom del visor y skeletons por patrón. Lógica pura; reloj y temporizadores inyectados.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { announce, announceTo, createLiveQueue } from "../../zui/src/core/announcer.ts";
import {
  carouselMode,
  clampProgress,
  deckCommits,
  deckOffset,
  depthOf,
  isEffect,
  isLayout,
  isVertical,
  nearestPoint,
  needsFace,
  perMoveOf,
  slideProgress,
  snapAlign,
  snapPoints,
} from "../../zui/src/core/carousel-effects.ts";
import { canPark, parking, visualOrder, wrap } from "../../zui/src/core/carousel-loop.ts";
import { arrange, endBlend, frameAtSlot, keylineFrame } from "../../zui/src/core/keylines.ts";
import { isAnimation, isPattern, patternOptions, seeded, SKELETON_PATTERNS, skeletonTree, widthAt } from "../../zui/src/core/skeleton.ts";
import {
  barFill,
  durationOf,
  goToGroup,
  initialStories,
  jumpGroup,
  nextStory,
  prevStory,
  storyText,
  tickStories,
  type StoriesShape,
} from "../../zui/src/core/stories.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";
import { clampZoom, containSize, IDENTITY, MAX_SCALE, pan, panLimits, zoomAt, zoomStep } from "../../zui/src/core/zoom.ts";

/** Reloj falso: `advance(ms)` dispara lo vencido. */
function clock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    setTimer: (fn: () => void, ms: number) => {
      timers.set(++seq, { at: now + ms, fn });
      return seq;
    },
    clearTimer: (id: unknown) => {
      timers.delete(id as number);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}

describe("core/announcer", () => {
  test("vacía al momento y escribe tras el retraso; en una ráfaga solo habla el último", () => {
    const c = clock();
    const writes: string[] = [];
    const q = createLiveQueue({ ...c, delay: 100, write: (t, p) => writes.push(`${p}:${t}`) });
    q.push("Slide 1 of 3");
    q.push("Slide 2 of 3");
    q.push("Slide 3 of 3");
    c.advance(99);
    assert.deepEqual(writes, ["polite:", "polite:", "polite:"]);
    c.advance(1);
    assert.deepEqual(writes.at(-1), "polite:Slide 3 of 3");
    assert.equal(writes.filter((w) => w !== "polite:").length, 1);
  });

  test("las dos urgencias van por separado y un texto vacío solo vacía", () => {
    const c = clock();
    const writes: string[] = [];
    const q = createLiveQueue({ ...c, write: (t, p) => writes.push(`${p}:${t}`) });
    q.push("Saved", "polite");
    q.push("Connection lost", "assertive");
    q.push("   ", "polite");
    c.advance(1000);
    assert.deepEqual(writes, ["polite:", "assertive:", "polite:", "assertive:Connection lost"]);
  });

  test("espera a que la persona deje de escribir", () => {
    const c = clock();
    const writes: string[] = [];
    const q = createLiveQueue({ ...c, delay: 50, quiet: 400, write: (t) => t && writes.push(t) });
    q.typing();
    q.push("3 results");
    c.advance(300);
    assert.deepEqual(writes, []);
    c.advance(100);
    assert.deepEqual(writes, ["3 results"]);
  });

  test("clear cancela lo pendiente y dispose deja de hablar", () => {
    const c = clock();
    const writes: string[] = [];
    const q = createLiveQueue({ ...c, write: (t) => writes.push(t) });
    q.push("A");
    q.clear();
    c.advance(1000);
    assert.ok(!writes.includes("A"));
    q.dispose();
    q.push("B");
    c.advance(1000);
    assert.ok(!writes.includes("B"));
  });

  test("propiedad: tras cualquier secuencia, el último texto no vacío es lo último que se lee", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ minLength: 0, maxLength: 6 }), { minLength: 1, maxLength: 12 }), (texts) => {
        const c = clock();
        let region = "";
        const q = createLiveQueue({ ...c, write: (t) => (region = t) });
        for (const t of texts) q.push(t);
        c.advance(10_000);
        const last = texts.at(-1)!.trim();
        assert.equal(region, last);
      }),
    );
  });

  test("announce crea una región educada y otra asertiva una vez por documento y calla en árboles inertes", async () => {
    announce("Hello");
    announce("Now", { politeness: "assertive", delay: 0 });
    const boxes = document.querySelectorAll("[data-z-announcer]");
    assert.equal(boxes.length, 1);
    assert.equal(boxes[0]!.querySelector('[role="status"]')!.getAttribute("aria-live"), "polite");
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(boxes[0]!.querySelector('[role="status"]')!.textContent, "Hello");
    assert.equal(boxes[0]!.querySelector('[role="alert"]')!.textContent, "Now");
    const hidden = document.createElement("div");
    hidden.setAttribute("inert", "");
    const inner = document.createElement("span");
    hidden.append(inner);
    document.body.append(hidden);
    announce("Secret", { source: inner, delay: 0 });
    await new Promise((r) => setTimeout(r, 20));
    assert.notEqual(boxes[0]!.querySelector('[role="status"]')!.textContent, "Secret");
    hidden.remove();
  });

  test("announceTo escribe en la región de la pieza con vaciado previo", async () => {
    const live = document.createElement("p");
    live.textContent = "old";
    announceTo(live, "Slide 2 of 4", 10);
    assert.equal(live.textContent, "");
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(live.textContent, "Slide 2 of 4");
  });
});

describe("core/carousel-effects", () => {
  test("motor por layout y efecto: la tira con lente sigue en el motor propio", () => {
    assert.equal(carouselMode({}), "engine");
    assert.equal(carouselMode({ effect: "none" }), "engine");
    assert.equal(carouselMode({ effect: "prism" }), "snap");
    assert.equal(carouselMode({ effect: "lens", perPage: 3 }), "snap");
    assert.equal(carouselMode({ perPage: "auto" }), "snap");
    assert.equal(carouselMode({ vertical: true }), "snap");
    assert.equal(carouselMode({ layout: "hero" }), "snap");
    assert.equal(carouselMode({ effect: "wheel" }), "snap");
    assert.equal(carouselMode({ effect: "fade" }), "deck");
    assert.equal(carouselMode({ layout: "stack", effect: "prism" }), "deck");
  });

  test("ajuste, orientación, cara y lecturas tolerantes", () => {
    assert.equal(snapAlign("strip", "prism"), "center");
    assert.equal(snapAlign("hero-center", "none"), "center");
    assert.equal(snapAlign("multi-browse", "none"), "start");
    assert.ok(isVertical(undefined, "wheel"));
    assert.ok(!isVertical("horizontal", "prism"));
    assert.ok(needsFace("hero", "none") && needsFace("strip", "coverflow") && !needsFace("strip", "parallax"));
    assert.ok(isLayout("multi-browse") && !isLayout("grid"));
    assert.ok(isEffect("prism") && !isEffect("cube"));
    assert.equal(depthOf("3"), 2);
    assert.equal(depthOf(undefined), 1);
    assert.equal(depthOf("x"), 1);
    assert.equal(perMoveOf("page", 3), 3);
    assert.equal(perMoveOf("2", 3), 2);
    assert.equal(perMoveOf(undefined, 3), 1);
    assert.equal(perMoveOf(20, 1), 8);
    assert.equal(clampProgress(9), 3);
    assert.equal(clampProgress(Number.NaN), 0);
  });

  test("progreso: 0 en el punto de ajuste, ±1 a un paso", () => {
    assert.equal(slideProgress(0, 300, 0, 800, 316, "start"), 0);
    assert.equal(slideProgress(316, 300, 0, 800, 316, "start"), 1);
    assert.equal(slideProgress(250, 300, 0, 800, 316, "center"), 0);
    assert.equal(slideProgress(-66, 300, 0, 800, 316, "center"), -1);
    assert.equal(slideProgress(10, 10, 0, 10, 0, "start"), 0);
  });

  test("puntos de ajuste: los finales se juntan en el tope de la tira", () => {
    const points = snapPoints([0, 316, 632, 948, 1264], 700);
    assert.deepEqual(points, [
      { at: 0, first: 0 },
      { at: 316, first: 1 },
      { at: 632, first: 2 },
      { at: 700, first: 3 },
    ]);
    assert.equal(nearestPoint(points, 650), 2);
    assert.equal(nearestPoint(points, 690), 3);
    assert.deepEqual(snapPoints([], 0), [{ at: 0, first: 0 }]);
  });

  test("propiedad: los puntos crecen y caben en [0, max]", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -100, max: 5000 }), { maxLength: 20 }), fc.integer({ min: 0, max: 4000 }), (raw, max) => {
        const offsets = [...raw].sort((a, b) => a - b);
        const points = snapPoints(offsets, max);
        for (let i = 1; i < points.length; i++) assert.ok(points[i]!.at > points[i - 1]!.at);
        for (const p of points) assert.ok(p.at >= 0 && p.at <= max);
      }),
    );
  });

  test("mazo: distancia más corta con bucle y umbral del arrastre", () => {
    assert.equal(deckOffset(0, 4, 5, true), 1);
    assert.equal(deckOffset(4, 0, 5, true), -1);
    assert.equal(deckOffset(4, 0, 5, false), 4);
    assert.equal(deckOffset(1, 0, 2, true), 1);
    assert.ok(deckCommits(-120, 400));
    assert.ok(!deckCommits(-50, 400));
    assert.ok(deckCommits(-20, 400, -0.9));
    assert.ok(!deckCommits(10, 0));
  });

  test("propiedad: con bucle, cada slide queda a menos de media vuelta del actual", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 30 }), fc.nat(), fc.nat(), (count, a, b) => {
        const d = deckOffset(a % count, b % count, count, true);
        assert.ok(Math.abs(d) <= count / 2);
        assert.equal(wrap(b + d, count), a % count);
      }),
    );
  });
});

describe("core/carousel-loop", () => {
  test("aparca el último delante en los dos primeros índices y el primero detrás en los dos últimos", () => {
    assert.deepEqual(parking(0, 5), { first: 0, last: -1 });
    assert.deepEqual(parking(2, 5), { first: 0, last: 0 });
    assert.deepEqual(parking(4, 5), { first: 1, last: 0 });
    assert.deepEqual(parking(1, 3), { first: 0, last: 0 });
    assert.deepEqual(parking(2, 3), { first: 1, last: 0 });
    assert.deepEqual(parking(0, 2), { first: 0, last: 0 });
    assert.deepEqual(visualOrder(0, 5), [4, 0, 1, 2, 3]);
    assert.deepEqual(visualOrder(4, 5), [1, 2, 3, 4, 0]);
    assert.deepEqual(visualOrder(null, 4), [0, 1, 2, 3]);
    assert.ok(!canPark(2) && canPark(3));
    assert.equal(wrap(-1, 5), 4);
    assert.equal(wrap(3, 0), 0);
  });

  test("propiedad: el orden visual es una permutación y el actual siempre tiene vecino a cada lado", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 40 }), fc.nat(), (count, n) => {
        const current = n % count;
        const order = visualOrder(current, count);
        assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i));
        const at = order.indexOf(current);
        assert.ok(at >= 1 && at <= count - 2, `current ${current} of ${count} at ${at}`);
        // Los vecinos visuales son los de la secuencia (el bucle no salta).
        assert.equal(order[at + 1], wrap(current + 1, count));
        assert.equal(order[at - 1], wrap(current - 1, count));
      }),
    );
  });
});

describe("core/keylines", () => {
  test("multi-browse, hero y hero centrado llenan la vista", () => {
    for (const layout of ["multi-browse", "hero", "hero-center"] as const) {
      for (const view of [320, 390, 768, 1100, 1440]) {
        const a = arrange(layout, view, { gap: 8 });
        const total = a.lines.reduce((n, s) => n + s, 0) + a.gap * (a.lines.length - 1);
        assert.ok(Math.abs(total - view) < 0.01, `${layout} ${view}: ${total}`);
        assert.ok(a.lines.every((s) => s > 0));
        assert.equal(Math.max(...a.lines), a.item);
      }
    }
    assert.equal(arrange("hero-center", 800).focal, 1);
    assert.equal(arrange("multi-browse", 1100, { gap: 8 }).lines.length, 4);
  });

  test("en su punto de ajuste el slide se ve entero y sin traslación", () => {
    const a = arrange("multi-browse", 1100, { gap: 8 });
    const f = keylineFrame(a, 0);
    assert.ok(Math.abs(f.shift) < 1e-9 && f.inset === 0 && f.size === a.item);
    const h = arrange("hero-center", 900, { gap: 8 });
    const g = keylineFrame(h, 0);
    assert.ok(Math.abs(g.shift) < 1e-9 && g.inset === 0);
    assert.equal(endBlend(a, 0, 3000), 0);
    assert.equal(endBlend(a, 3000, 3000), 1);
    assert.equal(endBlend(h, 10, 3000), 0);
  });

  test("propiedad: entre dos slides vecinos el hueco es siempre el mismo (las máscaras no se pisan)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("multi-browse" as const, "hero" as const, "hero-center" as const),
        fc.integer({ min: 280, max: 1600 }),
        fc.double({ min: -3, max: 4, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (layout, view, p, e) => {
          const a = arrange(layout, view, { gap: 8 });
          const step = a.item + a.gap;
          // Inicio visible de la máscara = sitio natural + traslación + recorte.
          const start = (q: number, f: ReturnType<typeof keylineFrame>) =>
            (a.align === "center" ? view / 2 - a.item / 2 : 0) + q * step + f.shift + f.inset;
          const f0 = keylineFrame(a, p, e, p + 1.3);
          const f1 = keylineFrame(a, p + 1, e, p + 2.3);
          const gapBetween = start(p + 1, f1) - (start(p, f0) + f0.size);
          if (f0.size > 0 && f1.size > 0) assert.ok(Math.abs(gapBetween - a.gap) < 1e-6, `${gapBetween}`);
          assert.ok(f0.size >= 0 && f0.inset >= 0);
        },
      ),
    );
  });

  test("fuera de la vista los slides encogen hasta desaparecer", () => {
    const lines = [300, 150, 50];
    assert.deepEqual(frameAtSlot(lines, 50, 8, 0), { x: 0, size: 300 });
    assert.equal(frameAtSlot(lines, 50, 8, -1).size, 50);
    assert.equal(frameAtSlot(lines, 50, 8, -2).size, 0);
    assert.equal(frameAtSlot(lines, 50, 8, 5).size, 0);
    assert.equal(frameAtSlot(lines, 50, 8, 0.5).size, 225);
  });
});

describe("core/stories", () => {
  const shape: StoriesShape = { sizes: [3, 1, 2], duration: (g) => (g === 1 ? 2000 : 1000) };

  test("el reloj llena la barra y pasa a la siguiente historia y al siguiente grupo", () => {
    let s = initialStories(0, shape.sizes);
    let e: ReturnType<typeof tickStories>[1];
    [s, e] = tickStories(shape, s, 500);
    assert.equal(barFill(shape, s, 0), 0.5);
    assert.equal(e, null);
    [s, e] = tickStories(shape, s, 600);
    assert.deepEqual([s.group, s.item, e?.type], [0, 1, "item"]);
    [s] = nextStory(shape, s);
    [s, e] = nextStory(shape, s);
    assert.deepEqual([s.group, s.item, e?.type], [1, 0, "group"]);
    [s, e] = jumpGroup(shape, s, 1);
    [s, e] = nextStory(shape, s);
    [s, e] = nextStory(shape, s);
    assert.ok(s.done);
    assert.equal(e?.type, "complete");
    assert.equal(barFill(shape, s, 1), 1);
  });

  test("pausa y retención paran el reloj; atrás vuelve al grupo anterior", () => {
    const paused = { ...initialStories(0, shape.sizes), paused: true };
    assert.equal(tickStories(shape, paused, 5000)[0], paused);
    const held = { ...initialStories(0, shape.sizes), held: true };
    assert.equal(tickStories(shape, held, 5000)[0], held);
    let s = goToGroup(shape, initialStories(0, shape.sizes), 2);
    [s] = prevStory(shape, s);
    assert.deepEqual([s.group, s.item], [1, 0]);
    const [first, none] = prevStory(shape, initialStories(0, shape.sizes));
    assert.equal(none, null);
    assert.equal(first.item, 0);
    assert.equal(jumpGroup(shape, initialStories(0, shape.sizes), -1)[1], null);
    assert.equal(goToGroup(shape, initialStories(0, shape.sizes), 99).group, 2);
    assert.equal(durationOf(200), 1000);
    assert.equal(durationOf("x"), 5000);
    assert.equal(storyText("Story {index} of {count}, {author}", 1, 5, "Ana"), "Story 2 of 5, Ana");
    assert.equal(initialStories(9, [1, 1]).group, 1);
  });

  test("propiedad: siguiente y anterior se deshacen fuera de los extremos, y las barras son 1…f…0", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 6 }),
        fc.nat(),
        fc.nat(),
        fc.nat({ max: 999 }),
        (sizes, g, i, elapsed) => {
          const sh: StoriesShape = { sizes, duration: () => 1000 };
          const group = g % sizes.length;
          const s = { ...initialStories(group, sizes), item: i % sizes[group]!, elapsed };
          const [n, ev] = nextStory(sh, s);
          if (ev?.type !== "complete") {
            const [back] = prevStory(sh, n);
            assert.deepEqual([back.group, back.item], [s.group, s.item]);
          }
          const fills = Array.from({ length: sizes[group]! }, (_, k) => barFill(sh, s, k));
          for (let k = 1; k < fills.length; k++) assert.ok(fills[k]! <= fills[k - 1]!);
        },
      ),
    );
  });
});

describe("core/zoom", () => {
  const box = { vw: 800, vh: 600, w: 800, h: 500 };

  test("acota escala y encuadre; el zoom sobre un punto lo deja quieto", () => {
    assert.deepEqual(clampZoom(box, { scale: 0.5, x: 30, y: 30 }), IDENTITY);
    assert.equal(clampZoom(box, { scale: 99, x: 0, y: 0 }).scale, MAX_SCALE);
    assert.deepEqual(panLimits(box, 2), { x: 400, y: 200 });
    const z = zoomAt(box, IDENTITY, 2, 100, 50);
    // El punto (100, 50) de la vista: antes era (100, 50) de la imagen; ahora (100 − x) / 2 sigue en 100.
    assert.equal((100 - z.x) / z.scale, 100);
    assert.equal(zoomStep(box, IDENTITY, 1).scale, 1.5);
    assert.equal(zoomStep(box, IDENTITY, -1).scale, 1);
    assert.deepEqual(pan(box, IDENTITY, 50, 50), IDENTITY);
    assert.deepEqual(containSize(1600, 1000, 800, 800), { w: 800, h: 500 });
    assert.deepEqual(containSize(0, 0, 800, 600), { w: 800, h: 600 });
    assert.deepEqual(clampZoom(box, { scale: Number.NaN, x: Number.NaN, y: 0 }), IDENTITY);
  });

  test("propiedad: nunca se ve el fondo por un lado de la imagen ampliada", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.2, max: 8, noNaN: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true }),
        (scale, x, y) => {
          const z = clampZoom(box, { scale, x, y });
          const lim = panLimits(box, z.scale);
          assert.ok(Math.abs(z.x) <= lim.x + 1e-9 && Math.abs(z.y) <= lim.y + 1e-9);
          assert.ok(z.scale >= 1 && z.scale <= MAX_SCALE);
        },
      ),
    );
  });
});

describe("core/skeleton", () => {
  test("anchos estables por semilla, dentro del rango", () => {
    assert.equal(seeded(1, 2), seeded(1, 2));
    assert.notEqual(seeded(1, 2), seeded(2, 2));
    fc.assert(
      fc.property(fc.integer(), fc.nat(1000), fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (seed, i, a, b) => {
        const [min, max] = a <= b ? [a, b] : [b, a];
        const w = widthAt(seed, i, min, max);
        assert.ok(w >= min && w <= max && Number.isInteger(w));
      }),
    );
  });

  test("cada patrón da el mismo árbol para las mismas opciones, oculto a lectores de pantalla", () => {
    for (const pattern of SKELETON_PATTERNS) {
      const a = toHTML(skeletonTree(pattern, { seed: 3 }));
      const b = toHTML(skeletonTree(pattern, { seed: 3 }));
      assert.equal(a, b);
      assert.match(a, new RegExp(`^<div class="z-skeleton-pattern" data-pattern="${pattern}" aria-hidden="true"`));
    }
    const list = toHTML(skeletonTree("list", { rows: 3, avatar: false, animation: "wave" }));
    assert.equal(list.match(/z-skeleton-pattern__row/g)?.length, 3);
    assert.ok(!list.includes("__avatar"));
    assert.ok(list.includes('data-animation="wave"'));
    const table = toHTML(skeletonTree("table", { rows: 2, columns: 3 }));
    assert.equal(table.match(/z-skeleton-pattern__cell/g)?.length, 9);
    assert.equal(toHTML(skeletonTree("calendar")).match(/__day/g)?.length, 42);
    assert.ok(toHTML(skeletonTree("chart", { type: "line" })).includes("<path"));
    assert.ok(toHTML(skeletonTree("chart", { type: "donut" })).includes("__donut"));
    assert.ok(!toHTML(skeletonTree("card", { media: false, actions: false })).includes("__media"));
    assert.ok(!toHTML(skeletonTree("profile", { cover: false })).includes("__cover"));
    assert.ok(!toHTML(skeletonTree("article", { image: false, paragraphs: 1 })).includes("__image"));
    assert.equal(toHTML(skeletonTree("chat", { messages: 4 })).match(/__message"/g)?.length, 4);
    assert.ok(toHTML(skeletonTree("table", { header: false })).indexOf("__head") < 0);
    assert.ok(toHTML(skeletonTree("list", { rows: 99 })).match(/__row/g)!.length <= 24);
  });

  test("opciones desde atributos data-*", () => {
    const el = document.createElement("div");
    el.dataset.rows = "3";
    el.dataset.avatar = "false";
    el.dataset.type = "donut";
    el.dataset.animation = "none";
    el.dataset.media = "";
    const o = patternOptions(el.dataset);
    assert.equal(o.rows, 3);
    assert.equal(o.avatar, false);
    assert.equal(o.media, true);
    assert.equal(o.type, "donut");
    assert.equal(o.animation, "none");
    assert.equal(patternOptions({ type: "pie" }).type, undefined);
    assert.ok(isPattern("chat") && !isPattern("grid"));
    assert.ok(isAnimation("wave") && !isAnimation("spin"));
  });
});
