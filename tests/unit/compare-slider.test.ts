// Oleada 7: CompareSlider (core/compare-slider): posición bajo el puntero y teclado APG.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { compareKey, comparePosition } from "../../zui/src/core/compare-slider.ts";

describe("CompareSlider", () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  test("posición bajo el puntero, acotada", () => {
    assert.equal(comparePosition({ x: 150, y: 0 }, rect, false), 25);
    assert.equal(comparePosition({ x: 0, y: 100 }, rect, true), 50);
    assert.equal(comparePosition({ x: 999, y: 0 }, rect, false), 100);
    assert.equal(comparePosition({ x: 0, y: 0 }, { ...rect, height: 0 }, true), 0);
  });
  test("teclado: flechas, Mayúsculas, páginas, extremos y vertical", () => {
    assert.equal(compareKey("ArrowRight", false, 50, false), 51);
    assert.equal(compareKey("ArrowLeft", true, 50, false), 40);
    assert.equal(compareKey("ArrowDown", false, 50, true), 51);
    assert.equal(compareKey("ArrowUp", false, 50, true), 49);
    assert.equal(compareKey("PageUp", false, 95, false), 100);
    assert.equal(compareKey("Home", false, 50, false), 0);
    assert.equal(compareKey("End", false, 50, false), 100);
    assert.equal(compareKey("a", false, 50, false), undefined);
  });
  test("propiedad: siempre en [0, 100]", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.boolean(), (x, v) => {
        const p = comparePosition({ x, y: x }, rect, v);
        assert.ok(p >= 0 && p <= 100);
      }),
    );
  });
});
