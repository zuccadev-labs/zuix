import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  centerBounds,
  createLensShape,
  LENS_BAND,
  lensForward,
  lensSource,
  quadToMatrix3d,
} from "../../zui/src/components/carousel/lens.ts";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b} (±${eps})`);
const wide = createLensShape(1200, 400, 280, 320);
const compact = createLensShape(390, 300, 200, 260);

/** Aplica una matrix3d (orden por columnas de CSS) a un punto del plano y devuelve su proyección. */
function project(matrix, x, y) {
  const m = matrix.slice("matrix3d(".length, -1).split(",").map(Number);
  assert.equal(m.length, 16);
  const w = m[3] * x + m[7] * y + m[15];
  return { x: (m[0] * x + m[4] * y + m[12]) / w, y: (m[1] * x + m[5] * y + m[13]) / w };
}

describe("createLensShape", () => {
  test("escritorio: estiramiento y ampliación completos", () => {
    assert.equal(wide.stretch, 0.62);
    assert.equal(wide.magnify, 0.24);
    assert.equal(wide.centerY, 200);
    near(wide.flat, (320 / 2 + 24) / 600);
  });
  test("por debajo de 640 px la lente es más suave", () => {
    assert.equal(createLensShape(639, 300, 200, 100).stretch, 0.45);
    assert.equal(createLensShape(640, 300, 200, 100).stretch, 0.62);
    assert.equal(compact.magnify, 0.18);
  });
  test("la zona plana se acota a [0.2, 0.86]", () => {
    assert.equal(createLensShape(1200, 400, 280, 0).flat, 0.2);
    assert.equal(createLensShape(1200, 400, 280, 5000).flat, 0.86);
  });
  test("ancho 0 (tira sin medir) no divide por cero", () => {
    const shape = createLensShape(0, 0, 0, 0);
    assert.ok(Number.isFinite(shape.flat));
    assert.equal(shape.flat, 0.86);
  });
  test("magnify < 0.5: condición para que el mapeo sea monótono", () => {
    assert.ok(wide.magnify < 0.5 && compact.magnify < 0.5);
  });
});

describe("lensSource / lensForward", () => {
  test("la zona plana central no se deforma", () => {
    for (const shape of [wide, compact]) {
      const half = shape.width / 2;
      for (const dx of [0, shape.flat * half * 0.5, -shape.flat * half * 0.99]) {
        const p = lensSource(half + dx, shape.centerY + 30, shape);
        near(p.x, half + dx);
        near(p.y, shape.centerY + 30);
        const q = lensForward(half + dx, shape.centerY + 30, shape);
        near(q.x, half + dx);
        near(q.y, shape.centerY + 30);
      }
    }
  });
  test("con fuerza 0 es la identidad en toda la tira", () => {
    for (const x of [0, 50, 600, 1150, 1200]) {
      const p = lensSource(x, 123, wide, 0);
      near(p.x, x);
      near(p.y, 123);
      const q = lensForward(x, 123, wide, 0);
      near(q.x, x);
      near(q.y, 123);
    }
  });
  test("lensForward es la inversa exacta de lensSource dentro de la tira", () => {
    for (const shape of [wide, compact]) {
      for (const strength of [0.5, 1, 1.85]) {
        for (let i = 0; i <= 40; i++) {
          const x = (shape.width * i) / 40;
          for (const y of [shape.centerY - shape.slideHeight / 2, shape.centerY, shape.centerY + shape.slideHeight * 0.4]) {
            const source = lensSource(x, y, shape, strength);
            const back = lensForward(source.x, source.y, shape, strength);
            near(back.x, x, 1e-6);
            near(back.y, y, 1e-6);
          }
        }
      }
    }
  });
  test("lensSource es monótona en x: dos puntos visibles nunca cruzan su origen", () => {
    for (const strength of [1, 1.85]) {
      let previous = -Infinity;
      for (let x = 0; x <= wide.width; x += 4) {
        const sx = lensSource(x, wide.centerY, wide, strength).x;
        assert.ok(sx > previous, `x=${x} strength=${strength}: ${sx} <= ${previous}`);
        previous = sx;
      }
    }
  });
  test("es simétrica en horizontal y antisimétrica en vertical (forma de S)", () => {
    const half = wide.width / 2;
    const left = lensForward(half - 500, wide.centerY, wide);
    const right = lensForward(half + 500, wide.centerY, wide);
    near(left.x - half, -(right.x - half));
    near(left.y - wide.centerY, -(right.y - wide.centerY));
    // A la izquierda el contenido cae hacia abajo (anclado arriba); a la derecha sube (anclado abajo).
    assert.ok(left.y > wide.centerY);
    assert.ok(right.y < wide.centerY);
  });
  test("el borde anclado no se mueve: arriba a la izquierda, abajo a la derecha", () => {
    const top = wide.centerY - wide.slideHeight / 2;
    const bottom = wide.centerY + wide.slideHeight / 2;
    near(lensForward(40, top, wide).y, top);
    near(lensForward(wide.width - 40, bottom, wide).y, bottom);
    assert.ok(lensForward(40, bottom, wide).y > bottom);
    assert.ok(lensForward(wide.width - 40, top, wide).y < top);
  });
  test("más allá del borde el mapeo sigue siendo finito y lineal", () => {
    const a = lensForward(wide.width + 300, wide.centerY, wide);
    const b = lensForward(wide.width + 600, wide.centerY, wide);
    const c = lensForward(wide.width + 900, wide.centerY, wide);
    for (const p of [a, b, c]) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    near(b.x - a.x, c.x - b.x, 1e-6);
  });
  test("zona plana al máximo (0.86): el tramo curvo es estrecho pero no degenera", () => {
    const shape = createLensShape(400, 300, 200, 5000);
    const p = lensForward(399, 150, shape);
    const s = lensSource(p.x, p.y, shape);
    near(s.x, 399, 1e-6);
  });
});

describe("quadToMatrix3d", () => {
  const box = (x, y, w, h) => [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  test("el cuadrilátero igual a la caja da la identidad", () => {
    assert.equal(quadToMatrix3d(100, 50, box(0, 0, 100, 50)), "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)");
  });
  test("traslación y escala (caso afín)", () => {
    assert.equal(quadToMatrix3d(100, 50, box(10, 20, 200, 25)), "matrix3d(2,0,0,0,0,0.5,0,0,0,0,1,0,10,20,0,1)");
  });
  test("un trapecio (caso proyectivo) lleva cada esquina de la caja a su esquina", () => {
    const quad = [
      { x: 5, y: 0 },
      { x: 110, y: -12 },
      { x: 118, y: 71 },
      { x: 0, y: 50 },
    ];
    const matrix = quadToMatrix3d(100, 50, quad);
    const corners = [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ];
    corners.forEach(([x, y], i) => {
      // Los coeficientes se redondean a 6 decimales: el error queda muy por debajo de un píxel.
      const p = project(matrix, x, y);
      near(p.x, quad[i].x, 0.05);
      near(p.y, quad[i].y, 0.05);
    });
  });
  test("un cuadrilátero degenerado (todo en un punto) no produce NaN ni Infinity", () => {
    const point = { x: 3, y: 4 };
    const matrix = quadToMatrix3d(100, 50, [point, point, point, point]);
    assert.doesNotMatch(matrix, /NaN|Infinity/);
  });
  test("una caja de ancho 0 no produce NaN ni Infinity", () => {
    assert.doesNotMatch(quadToMatrix3d(0, 0, box(0, 0, 0, 0)), /NaN|Infinity/);
  });
  test("redondea a 6 decimales y no escribe -0", () => {
    const matrix = quadToMatrix3d(3, 3, box(0, 0, 1, 1));
    assert.equal(matrix, "matrix3d(0.333333,0,0,0,0,0.333333,0,0,0,0,1,0,0,0,0,1)");
    assert.doesNotMatch(matrix, /-0(,|\))/);
  });
});

describe("centerBounds", () => {
  test("franja simétrica alrededor del centro, algo mayor que la zona plana", () => {
    const { left, right } = centerBounds(wide);
    const half = wide.width / 2;
    near(half - left, right - half);
    near(right - half, (wide.flat + LENS_BAND * (1 - wide.flat)) * half);
    assert.ok(right - half > wide.flat * half);
    assert.ok(right < wide.width && left > 0);
  });
  test("en el límite de la franja la deformación es menor de 1 px", () => {
    const { right } = centerBounds(wide);
    const p = lensForward(right, wide.centerY - wide.slideHeight / 2, wide);
    assert.ok(Math.abs(p.x - right) < 1, `dx=${p.x - right}`);
    const q = lensForward(right, wide.centerY + wide.slideHeight / 2, wide);
    assert.ok(Math.abs(q.y - (wide.centerY + wide.slideHeight / 2)) < 1);
  });
});
