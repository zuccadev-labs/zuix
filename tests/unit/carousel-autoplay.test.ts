// Carousel ampliado (core/carousel): reproducción automática con pausa, posiciones del modo snap e
// indicadores. Temporizadores inyectados: sin esperas reales.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  autoplayInterval,
  barProgress,
  createAutoplay,
  DEFAULT_INTERVAL,
  isIndicators,
  MIN_INTERVAL,
  fitPerPage,
  perPageOf,
  slideText,
  snapIndexAt,
  snapPositions,
  stepIndex,
} from "../../zui/src/core/carousel.ts";

/** Reloj falso: `advance(ms)` dispara lo vencido. */
function clock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
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
    get pending() {
      return timers.size;
    },
  };
}

describe("Carousel · reproducción automática", () => {
  test("intervalo: true, número acotado o nada", () => {
    assert.equal(autoplayInterval(true), DEFAULT_INTERVAL);
    assert.equal(autoplayInterval(200), MIN_INTERVAL);
    assert.equal(autoplayInterval(6000.4), 6000);
    for (const off of [false, undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(autoplayInterval(off), null);
  });
  test("avanza cada intervalo, se retiene por motivos y la pausa de la persona manda", () => {
    const c = clock();
    let ticks = 0;
    const states: boolean[] = [];
    const a = createAutoplay({ interval: 2000, onTick: () => ticks++, onChange: (p) => states.push(p), ...c });
    assert.equal(a.playing, true);
    c.advance(4100);
    assert.equal(ticks, 2);
    a.hold("hover", true);
    assert.equal(a.playing, false);
    c.advance(10_000);
    assert.equal(ticks, 2, "con el puntero encima no avanza");
    a.hold("focus", true);
    a.hold("hover", false);
    assert.equal(a.playing, false, "sigue retenida por el foco");
    a.hold("focus", false);
    c.advance(1999);
    assert.equal(ticks, 2, "al reanudar cuenta un intervalo entero");
    c.advance(1);
    assert.equal(ticks, 3);
    a.pause();
    assert.equal(a.wanted, false);
    c.advance(10_000);
    assert.equal(ticks, 3);
    a.hold("offscreen", true);
    a.play();
    assert.equal(a.playing, false, "la persona la enciende, pero fuera de pantalla sigue retenida");
    a.hold("offscreen", false);
    assert.equal(a.playing, true);
    a.toggle();
    assert.equal(a.wanted, false);
    a.toggle();
    assert.equal(a.wanted, true);
    assert.deepEqual(states, [true, false, true, false, true, false, true]);
    a.dispose();
    assert.equal(c.pending, 0);
    assert.equal(a.playing, false);
  });
  test("reproducir quita la retención del foco y del puntero (pulsar el botón no la deja quieta)", () => {
    const c = clock();
    const a = createAutoplay({ interval: 1500, onTick: () => {}, ...c }, false);
    assert.equal(a.playing, false, "con movimiento reducido no arranca");
    a.hold("focus", true);
    a.hold("hover", true);
    a.play();
    assert.equal(a.playing, true);
  });
  test("restart vuelve a contar", () => {
    const c = clock();
    let ticks = 0;
    const a = createAutoplay({ interval: 2000, onTick: () => ticks++, ...c });
    c.advance(1500);
    a.restart();
    c.advance(1500);
    assert.equal(ticks, 0);
    c.advance(500);
    assert.equal(ticks, 1);
    a.pause();
    a.restart();
    assert.equal(c.pending, 0);
  });
  test("sin temporizadores inyectados usa los del entorno", () => {
    const a = createAutoplay({ interval: 1500, onTick: () => {} });
    assert.equal(a.playing, true);
    a.dispose();
  });
});

describe("Carousel · modo snap e indicadores", () => {
  test("posiciones y slides por página", () => {
    assert.equal(snapPositions(6, 3), 4);
    assert.equal(snapPositions(2, 3), 1);
    assert.equal(snapPositions(0, 1), 1);
    assert.equal(perPageOf(undefined), 1);
    assert.equal(perPageOf(2.7), 2);
    assert.equal(perPageOf(20), 8);
    assert.equal(perPageOf(0), 1);
  });
  test("slides que caben: los pedidos o menos en una tira estrecha, nunca menos de uno", () => {
    // 3 pedidas de 176 px con 24 de hueco: caben en 576, en 300 solo una y en 400 dos.
    assert.equal(fitPerPage(3, 576, 176, 24), 3);
    assert.equal(fitPerPage(3, 1200, 176, 24), 3);
    assert.equal(fitPerPage(3, 300, 176, 24), 1);
    assert.equal(fitPerPage(3, 400, 176, 24), 2);
    assert.equal(fitPerPage(3, 100, 176, 24), 1);
    // Sin medida (sin ancho mínimo o sin vista) se usan las pedidas, acotadas a 1–8.
    assert.equal(fitPerPage(3, 300, 0, 24), 3);
    assert.equal(fitPerPage(20, 0, 176, 24), 8);
  });
  test("posición por desplazamiento (también negativo en RTL)", () => {
    assert.equal(snapIndexAt(0, 100, 4), 0);
    assert.equal(snapIndexAt(249, 100, 4), 2);
    assert.equal(snapIndexAt(-310, 100, 4), 3);
    assert.equal(snapIndexAt(900, 100, 4), 3);
    assert.equal(snapIndexAt(50, 0, 4), 0);
    assert.equal(snapIndexAt(50, 100, 1), 0);
  });
  test("propiedad: el paso queda dentro de las posiciones; con bucle da la vuelta", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 0, max: 19 }),
        fc.constantFrom(1, -1),
        fc.boolean(),
        (n, i, d, loop) => {
          const index = Math.min(i, n - 1);
          const next = stepIndex(index, d as 1 | -1, n, loop);
          assert.ok(next >= 0 && next < n);
          if (!loop && index === n - 1 && d === 1) assert.equal(next, n - 1);
          if (loop && n > 1 && index === n - 1 && d === 1) assert.equal(next, 0);
        },
      ),
    );
    assert.equal(stepIndex(0, -1, 4, true), 3);
    assert.equal(stepIndex(0, -1, 4, false), 0);
  });
  test("barra, tipos de indicador y texto", () => {
    assert.equal(barProgress(0, 4), 0.25);
    assert.equal(barProgress(3, 4), 1);
    assert.equal(barProgress(0, 1), 1);
    assert.ok(isIndicators("dots") && isIndicators("thumbnails") && !isIndicators("pips"));
    assert.equal(slideText("Slide {index} of {count}", 1, 5), "Slide 2 of 5");
  });
});
