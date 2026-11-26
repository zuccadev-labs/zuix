// Motor de patrones de portada (core/pattern): semillas deterministas, teselas válidas y periódicas, malla con
// colores de la paleta y las propiedades personalizadas que usa la hoja.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  meshVars,
  PATTERN_TILE,
  patternSvg,
  patternUrl,
  patternVars,
  random,
  SEEDED_PATTERNS,
  seedOf,
} from "../../zui/src/core/pattern.ts";

describe("core/pattern", () => {
  test("seedOf: números y textos dan una semilla estable de 32 bits, nunca 0", () => {
    assert.equal(seedOf(undefined), 1);
    assert.equal(seedOf(0), 1);
    assert.equal(seedOf(-7), 7);
    assert.equal(seedOf(Number.NaN), seedOf("NaN"));
    assert.equal(seedOf("atlas"), seedOf("atlas"));
    assert.notEqual(seedOf("atlas"), seedOf("atlaz"));
    fc.assert(
      fc.property(fc.oneof(fc.integer(), fc.string()), (s) => {
        const n = seedOf(s);
        return Number.isInteger(n) && n > 0 && n <= 0xffffffff;
      }),
    );
  });

  test("random: determinista y en [0, 1)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 0xffffffff }), (seed) => {
        const a = random(seed);
        const b = random(seed);
        for (let i = 0; i < 20; i++) {
          const x = a();
          if (x !== b() || x < 0 || x >= 1) return false;
        }
        return true;
      }),
    );
  });

  test("patternSvg: la misma semilla da la misma tesela y otra semilla otra", () => {
    for (const p of SEEDED_PATTERNS) {
      const svg = patternSvg(p, 3);
      assert.equal(svg, patternSvg(p, 3), p);
      assert.match(svg, /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' width='\d+' height='\d+'/, p);
      assert.ok(svg.endsWith("</svg>"), p);
      assert.ok(!svg.includes("NaN"), `${p} sin NaN`);
      if (p !== "grain") assert.notEqual(svg, patternSvg(p, 4), `${p} cambia con la semilla`);
    }
    assert.match(patternSvg("grain", 42), /seed='42'/);
    assert.match(patternSvg("stars", 1, 4), /width='16'/, "lado mínimo de 16 px");
  });

  test("patternUrl: un data URI sin comillas dobles, ángulos ni almohadillas sin escapar", () => {
    for (const p of SEEDED_PATTERNS) {
      const url = patternUrl(p, 9);
      assert.ok(url.startsWith('url("data:image/svg+xml,'), p);
      const body = url.slice(5, -2);
      assert.ok(!/[<>"#{}]/.test(body), `${p}: ${body.slice(0, 60)}`);
      assert.ok(!body.includes("%2523"), `${p}: sin doble escape`);
    }
    assert.match(patternUrl("grain", 1), /url\(%23n\)/);
  });

  test("las figuras que tocan un borde se repiten en el opuesto (tesela sin costura)", () => {
    const svg = patternSvg("halftone", 5, 192);
    const xs = [...svg.matchAll(/cx='(-?[\d.]+)'/g)].map((m) => Number(m[1]));
    assert.ok(xs.some((x) => x < 0) || xs.some((x) => x > 192) || xs.every((x) => x >= 0 && x <= 192));
    const edge = xs.filter((x) => x < 4);
    for (const x of edge) assert.ok(xs.some((o) => Math.abs(o - (x + 192)) < 0.11), `copia de ${x}`);
  });

  test("meshVars: cuatro manchas con posición en % y colores distintos de la paleta", () => {
    const v = meshVars("pricing");
    assert.deepEqual(v, meshVars("pricing"));
    const colors = [1, 2, 3, 4].map((i) => v[`--z-mesh-c${i}`]);
    assert.equal(new Set(colors).size, 4);
    for (const c of colors) assert.match(c ?? "", /^var\(--z-[a-z0-9-]+\)$/);
    for (const i of [1, 2, 3, 4]) {
      assert.match(v[`--z-mesh-x${i}`] ?? "", /^\d+%$/);
      assert.match(v[`--z-mesh-y${i}`] ?? "", /^\d+%$/);
    }
  });

  test("patternVars: tesela y lado, malla, nada sin semilla ni para los patrones de la hoja", () => {
    assert.deepEqual(patternVars("stars"), {});
    assert.deepEqual(patternVars("grid", 3), {});
    const stars = patternVars("stars", 3);
    assert.equal(stars["--z-pattern-size"], `${PATTERN_TILE.stars}px`);
    assert.equal(stars["--z-pattern-tile"], patternUrl("stars", 3));
    assert.equal(patternVars("plus", undefined, 100)["--z-pattern-size"], "100px");
    assert.ok("--z-mesh-x1" in patternVars("mesh", 2));
  });
});
