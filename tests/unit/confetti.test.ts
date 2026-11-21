// Oleada 7: Confetti (core/confetti): ráfaga determinista, física y fin de vida.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { burst, random, step } from "../../zui/src/core/confetti.ts";

describe("Confetti", () => {
  test("generador determinista en [0, 1)", () => {
    const a = random(42);
    const b = random(42);
    for (let i = 0; i < 20; i++) {
      const v = a();
      assert.equal(v, b());
      assert.ok(v >= 0 && v < 1);
    }
  });
  test("ráfaga: número acotado, origen, colores repartidos y hacia arriba por defecto", () => {
    const ps = burst({ x: 100, y: 200, count: 12, colors: 3, seed: 7 });
    assert.equal(ps.length, 12);
    assert.ok(ps.every((p) => p.x === 100 && p.y === 200 && p.life === 1));
    assert.deepEqual([...new Set(ps.map((p) => p.color))].sort(), [0, 1, 2]);
    assert.ok(
      ps.every((p) => p.vy < 0),
      "sube",
    );
    assert.equal(burst({ x: 0, y: 0, count: 9999, seed: 1 }).length, 400);
    assert.equal(burst({ x: 0, y: 0, count: 0, seed: 1 }).length, 1);
    assert.ok(burst({ x: 0, y: 0 }).length === 120);
  });
  test("física: la gravedad la hace caer y la vida se agota", () => {
    const ps = burst({ x: 0, y: 0, count: 30, seed: 3, velocity: 10 });
    let alive = ps.length;
    let frames = 0;
    while (alive > 0 && frames < 1000) {
      alive = step(ps, { ticks: 120 });
      frames++;
    }
    assert.equal(alive, 0);
    assert.ok(frames >= 119 && frames <= 121, `vida de 120 fotogramas: ${frames}`);
    assert.ok(
      ps.every((p) => p.vy > 0),
      "al final caen",
    );
    assert.equal(step(ps), 0, "muertas no se mueven");
  });
  test("propiedad: el paso acota dt y nunca deja vida negativa", () => {
    fc.assert(
      fc.property(fc.double({ min: -5, max: 50, noNaN: true }), (dt) => {
        const ps = burst({ x: 0, y: 0, count: 5, seed: 9 });
        step(ps, { dt, ticks: 10 });
        assert.ok(ps.every((p) => p.life >= 0 && p.life <= 1 && Number.isFinite(p.x)));
      }),
    );
  });
});
