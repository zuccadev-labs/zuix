// Oleada 6: patrones de DotMatrix (core/dotmatrix), pausa fuera de pantalla (core/visibility) y cálculos de los
// efectos (core/effects).
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import fc from "fast-check";
import {
  DOT_DIM,
  DOT_PATTERNS,
  dotDuration,
  dotGrid,
  dotHash,
  dotIntensity,
  dotMatrixCells,
  dotMotion,
  dotValue,
  isDotPattern,
} from "../../zui/src/core/dotmatrix.ts";
import { glowPoint, pieceCount, splitText } from "../../zui/src/core/effects.ts";
import { pauseOffscreen, resetVisibility, watchedCount } from "../../zui/src/core/visibility.ts";

describe("DotMatrix", () => {
  test("18 patrones propios, cada uno con movimiento y duración", () => {
    assert.equal(DOT_PATTERNS.length, 18);
    for (const p of DOT_PATTERNS) {
      assert.ok(isDotPattern(p));
      assert.ok(["trail", "breathe"].includes(dotMotion(p)));
      assert.ok(dotDuration(p) >= 1 && dotDuration(p) <= 3, `${p}: menos de tres destellos por segundo`);
    }
    assert.equal(isDotPattern("nope"), false);
  });
  test("rejilla acotada a 2–16 y cuadrada por defecto", () => {
    assert.deepEqual(dotGrid(), { cols: 5, rows: 5 });
    assert.deepEqual(dotGrid(7), { cols: 7, rows: 7 });
    assert.deepEqual(dotGrid(1, 40), { cols: 2, rows: 16 });
    assert.deepEqual(dotGrid(Number.NaN, 3), { cols: 5, rows: 3 });
  });
  test("propiedad: toda fase en [0,1), brillo quieto en [DIM,1] y tantas celdas como la rejilla", () => {
    fc.assert(
      fc.property(fc.constantFrom(...DOT_PATTERNS), fc.integer({ min: 2, max: 16 }), fc.integer({ min: 2, max: 16 }), (p, c, r) => {
        const cells = dotMatrixCells(p, c, r);
        assert.equal(cells.length, c * r);
        for (const cell of cells) {
          assert.ok(cell.phase >= 0 && cell.phase < 1);
          assert.ok(cell.rest >= DOT_DIM - 1e-9 && cell.rest <= 1 + 1e-9);
        }
      }),
    );
  });
  test("cada patrón dibuja algo distinto", () => {
    const sig = DOT_PATTERNS.map((p) =>
      dotMatrixCells(p)
        .map((c) => `${dotValue(c.phase)}${c.off ? "x" : ""}`)
        .join(),
    );
    assert.equal(new Set(sig).size, DOT_PATTERNS.length);
  });
  test("oleada 7: rombo simétrico, radar en el sentido de las agujas, hélice y corazón con silueta", () => {
    const diamond = dotMatrixCells("diamond", 5, 5);
    assert.equal(diamond[12]?.phase, 0, "el centro late primero");
    assert.equal(diamond[2]?.phase, diamond[10]?.phase, "simétrico");
    const radar = dotMatrixCells("radar", 5, 5);
    assert.ok(radar[2]!.phase < radar[14]!.phase && radar[14]!.phase < radar[22]!.phase, "arriba, derecha, abajo");
    const helix = dotMatrixCells("helix", 7, 5);
    assert.ok(helix.some((c) => c.off) && helix.some((c) => !c.off), "solo las curvas");
    const heart = dotMatrixCells("heart", 7, 7);
    assert.ok(heart[0]?.off && !heart[24]?.off, "esquina fuera, centro dentro");
    const zigzag = dotMatrixCells("zigzag", 3, 3);
    assert.ok(zigzag[1]!.phase > zigzag[7]!.phase, "la segunda columna sube");
  });
  test("órbita solo usa el borde; cruz, diagonales y ejes", () => {
    const orbit = dotMatrixCells("orbit", 5, 5);
    assert.equal(orbit.filter((c) => !c.off).length, 16);
    assert.ok(orbit[12]?.off, "el centro no gira");
    const cross = dotMatrixCells("cross", 5, 5);
    assert.ok(!cross[0]?.off && !cross[2]?.off && cross[1]?.off);
  });
  test("espiral y serpiente recorren todas las celdas una vez", () => {
    for (const p of ["spiral", "snake"] as const) {
      const phases = dotMatrixCells(p, 4, 3).map((c) => c.phase);
      assert.equal(new Set(phases.map(dotValue)).size, 12, p);
    }
  });
  test("intensidad: estela que cae y respiración simétrica", () => {
    assert.equal(dotIntensity("trail", 0), 1);
    assert.equal(dotIntensity("trail", 0.5), DOT_DIM);
    assert.equal(dotIntensity("breathe", 0.5), 1);
    assert.equal(dotIntensity("breathe", 0), DOT_DIM);
    assert.equal(dotIntensity("breathe", 1.25), dotIntensity("breathe", 0.25));
    assert.ok(dotHash(1, 2) >= 0 && dotHash(1, 2) < 1);
    assert.equal(dotHash(3, 4), dotHash(3, 4));
  });
});

describe("efectos", () => {
  test("glowPoint acota el punto a la caja", () => {
    const r = { left: 10, top: 20, width: 100, height: 50 };
    assert.deepEqual(glowPoint(r, 60, 45), { x: 50, y: 25 });
    assert.deepEqual(glowPoint(r, -5, 999), { x: 0, y: 50 });
  });
  test("splitText por palabras conserva los espacios", () => {
    const t = splitText("Hola  mundo azul");
    assert.deepEqual(t, [
      { word: "Hola", index: 0 },
      { space: "  " },
      { word: "mundo", index: 1 },
      { space: " " },
      { word: "azul", index: 2 },
    ]);
    assert.equal(pieceCount(t), 3);
  });
  test("splitText por letras cuenta grafemas y numera seguido", () => {
    const t = splitText("é👍🏽 ab", "letter");
    const first = t[0];
    assert.ok(first && "word" in first && first.letters?.length === 2, "letra con tilde y emoji compuesto");
    assert.equal(pieceCount(t), 4);
    const last = t[2];
    assert.ok(last && "word" in last && last.letters?.[1]?.index === 3);
  });
  test("propiedad: unir los trozos devuelve el texto", () => {
    fc.assert(
      fc.property(fc.string(), fc.constantFrom("word", "letter" as const), (s, by) => {
        const back = splitText(s, by)
          .map((t) => ("space" in t ? t.space : t.letters ? t.letters.map((l) => l.text).join("") : t.word))
          .join("");
        assert.equal(back, s);
      }),
    );
  });
});

describe("visibilidad", () => {
  afterEach(() => {
    resetVisibility();
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  });
  test("sin IntersectionObserver no hace nada", () => {
    const el = { removeAttribute() {} } as unknown as Element;
    const stop = pauseOffscreen(el);
    assert.equal(watchedCount(), 0);
    stop();
  });
  test("marca data-offscreen fuera de pantalla y deja de observar", () => {
    let cb: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => {};
    const observed = new Set<unknown>();
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
      constructor(fn: typeof cb) {
        cb = fn;
      }
      observe(el: unknown) {
        observed.add(el);
      }
      unobserve(el: unknown) {
        observed.delete(el);
      }
    };
    const attrs = new Set<string>();
    const make = (connected = true) =>
      ({
        isConnected: connected,
        toggleAttribute: (n: string, on: boolean) => (on ? attrs.add(n) : attrs.delete(n)),
        removeAttribute: (n: string) => attrs.delete(n),
      }) as unknown as Element;
    const el = make();
    const stop = pauseOffscreen(el);
    pauseOffscreen(el);
    assert.equal(watchedCount(), 1, "una vez por elemento");
    cb([{ target: el, isIntersecting: false }]);
    assert.ok(attrs.has("data-offscreen"));
    cb([{ target: el, isIntersecting: true }]);
    assert.ok(!attrs.has("data-offscreen"));
    stop();
    assert.equal(watchedCount(), 0);
    assert.equal(observed.size, 0);
    const gone = make(false);
    pauseOffscreen(gone);
    cb([{ target: gone, isIntersecting: false }]);
    assert.equal(watchedCount(), 0, "un elemento desconectado se suelta");
  });
});
