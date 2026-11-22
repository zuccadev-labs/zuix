// CircularSlider (core/circular): geometría del anillo, ángulo ↔ valor y trazados SVG.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { angleOf, arcPath, pointAt, ringGeometry, valueAtPoint } from "../../zui/src/core/circular.ts";

describe("CircularSlider · anillo", () => {
  test("geometría: círculo completo arriba, arco abierto con el hueco abajo, límites", () => {
    assert.deepEqual(ringGeometry(), { arc: 360, start: 0 });
    assert.deepEqual(ringGeometry(270), { arc: 270, start: 225 });
    assert.deepEqual(ringGeometry(10), { arc: 30, start: 345 });
    assert.deepEqual(ringGeometry(500, -90), { arc: 360, start: 270 });
  });
  test("ángulo de un valor", () => {
    assert.equal(angleOf(0, 0, 100, 360, 0), 0);
    assert.equal(angleOf(25, 0, 100, 360, 0), 90);
    assert.equal(angleOf(50, 0, 100, 270, 225), 0);
    assert.equal(angleOf(200, 0, 100, 270, 225), 135);
    assert.equal(angleOf(5, 5, 5, 360, 0), 0);
  });
  test("valor en un punto: cuadrantes, paso y hueco del arco abierto", () => {
    assert.equal(valueAtPoint(10, 0, 0, 100, 1, 360, 0), 25);
    assert.equal(valueAtPoint(0, 10, 0, 100, 1, 360, 0), 50);
    assert.equal(valueAtPoint(-10, 0, 0, 100, 5, 360, 0), 75);
    assert.equal(valueAtPoint(0, -10, 0, 100, 1, 270, 225), 50);
    assert.equal(valueAtPoint(-1, 10, 0, 100, 1, 270, 225), 0, "hueco, más cerca del inicio");
    assert.equal(valueAtPoint(1, 10, 0, 100, 1, 270, 225), 100, "hueco, más cerca del final");
  });
  test("propiedad: el punto del ángulo de un valor devuelve el valor", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99 }), fc.constantFrom(360, 270, 180), (v, arc) => {
        const { start } = ringGeometry(arc);
        const p = pointAt(angleOf(v, 0, 100, arc, start), 40);
        assert.equal(valueAtPoint(p.x - 50, p.y - 50, 0, 100, 1, arc, start), v);
      }),
    );
  });
  test("trazados", () => {
    assert.equal(arcPath(0, 0, 40), "");
    assert.equal(arcPath(0, 90, 40), "M50 10A40 40 0 0 1 90 50");
    assert.equal(arcPath(0, 270, 40), "M50 10A40 40 0 1 1 10 50");
    assert.equal(arcPath(0, 360, 40), "M50 10A40 40 0 1 1 50 90A40 40 0 1 1 50 10");
  });
});
