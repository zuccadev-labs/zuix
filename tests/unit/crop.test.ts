// Oleada 7: ImageCropper (core/crop): recorte inicial, límites, mover, redimensionar con y sin relación, teclado y
// paso a píxeles.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  clampCrop,
  CROP_HANDLES,
  cropPixels,
  initialCrop,
  keyCrop,
  moveCrop,
  outputSize,
  resizeCrop,
  type Crop,
} from "../../zui/src/core/crop.ts";

const near = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const inside = (c: Crop) => {
  assert.ok(c.x >= 0 && c.y >= 0 && c.width > 0 && c.height > 0, JSON.stringify(c));
  assert.ok(c.x + c.width <= 1 + 1e-9 && c.y + c.height <= 1 + 1e-9, JSON.stringify(c));
};

describe("ImageCropper · recorte", () => {
  test("inicial: libre al 80 % y con relación, el mayor que cabe, centrado", () => {
    assert.deepEqual(initialCrop(undefined, 1.6), { x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    const sq = initialCrop(1, 1.6);
    near(sq.height, 0.8);
    near(sq.width, 0.5);
    near(sq.x, 0.25);
    // 16:9 sobre una imagen 16:10: en píxeles, ancho/alto = 16/9.
    const wide = initialCrop(16 / 9, 1.6);
    near((wide.width * 1.6) / wide.height, 16 / 9);
  });
  test("límites: dentro de la imagen, mínimo y relación conservada", () => {
    assert.deepEqual(clampCrop({ x: 0.9, y: -0.2, width: 0.5, height: 0.5 }, undefined, 1), { x: 0.5, y: 0, width: 0.5, height: 0.5 });
    assert.deepEqual(clampCrop({ x: 0, y: 0, width: 0.01, height: 0.01 }, undefined, 1), { x: 0, y: 0, width: 0.05, height: 0.05 });
    const c = clampCrop({ x: 0, y: 0, width: 1, height: 1 }, 2, 1);
    near(c.width / c.height, 2);
    const tall = clampCrop({ x: 0, y: 0, width: 0.2, height: 0.2 }, 0.25, 1);
    near(tall.width / tall.height, 0.25);
    inside(tall);
    const tiny = clampCrop({ x: 0, y: 0, width: 0.06, height: 0.06 }, 4, 1);
    assert.ok(tiny.height >= 0.05 - 1e-9);
  });
  test("mover no se sale", () => {
    assert.deepEqual(moveCrop({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, 1, -1), { x: 0.5, y: 0, width: 0.5, height: 0.5 });
  });
  test("redimensionar libre: el lado opuesto queda fijo", () => {
    const c = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
    assert.deepEqual(resizeCrop(c, "e", 0.1, 0, undefined, 1), { x: 0.2, y: 0.2, width: 0.5, height: 0.4 });
    assert.deepEqual(resizeCrop(c, "nw", -0.1, -0.1, undefined, 1), { x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
    assert.deepEqual(resizeCrop(c, "w", 0.5, 0, undefined, 1), { x: 0.55, y: 0.2, width: 0.05, height: 0.4 });
  });
  test("propiedad: con relación, cualquier asa conserva la relación y queda dentro", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CROP_HANDLES),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 1, noNaN: true }),
        fc.constantFrom(1, 16 / 9, 0.75),
        fc.constantFrom(1, 1.6, 0.66),
        (handle, dx, dy, aspect, imageAspect) => {
          const start = initialCrop(aspect, imageAspect, 0.5);
          const out = resizeCrop(start, handle, dx, dy, aspect, imageAspect);
          inside(out);
          near((out.width * imageAspect) / out.height, aspect, 0.01);
        },
      ),
    );
  });
  test("teclado: mover, redimensionar con Mayúsculas, paso con Alt, Inicio y Fin, RTL", () => {
    const c = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
    assert.deepEqual(keyCrop(c, "ArrowRight", {}, undefined, 1), { ...c, x: 0.21 });
    assert.deepEqual(keyCrop(c, "ArrowRight", {}, undefined, 1, -1), { ...c, x: 0.19 });
    assert.deepEqual(keyCrop(c, "ArrowDown", { alt: true }, undefined, 1), { ...c, y: 0.3 });
    assert.deepEqual(keyCrop(c, "ArrowRight", { shift: true }, undefined, 1), { ...c, width: 0.41 });
    const sq = keyCrop(c, "ArrowUp", { shift: true }, 1, 1)!;
    near(sq.width, 0.39);
    near(sq.height, 0.39);
    assert.equal(keyCrop(c, "Home", {}, undefined, 1)!.x, 0);
    assert.equal(keyCrop(c, "End", {}, undefined, 1)!.x, 0.6);
    assert.equal(keyCrop(c, "Enter", {}, undefined, 1), undefined);
  });
  test("píxeles y tamaño de salida", () => {
    assert.deepEqual(cropPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.5 }, 640, 400), { x: 160, y: 200, width: 320, height: 200 });
    assert.deepEqual(cropPixels({ x: 0.999, y: 0, width: 0.5, height: 0.0001 }, 100, 100), { x: 100, y: 0, width: 1, height: 1 });
    assert.deepEqual(outputSize(1000, 500, 200), { width: 200, height: 100 });
    assert.deepEqual(outputSize(100, 50, 200), { width: 100, height: 50 });
    assert.deepEqual(outputSize(100, 50), { width: 100, height: 50 });
  });
});
