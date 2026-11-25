// SignaturePad (core/signature): grosor por presión, trazado suavizado, SVG y captura de puntos.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addPoint, signatureSvg, strokePath, strokeWidth, type SignatureStroke } from "../../zui/src/core/signature.ts";

describe("SignaturePad", () => {
  test("grosor según la presión media", () => {
    assert.equal(strokeWidth([], 2), 2);
    assert.equal(strokeWidth([{ x: 0, y: 0, p: 0.5 }], 2.5), 2.5);
    assert.equal(strokeWidth([{ x: 0, y: 0, p: 1 }], 2.5), 3.5);
    assert.equal(strokeWidth([{ x: 0, y: 0, p: Number.NaN }], 2.5), 2.5);
  });
  test("trazado: toque, línea y curvas por los puntos medios", () => {
    assert.equal(strokePath([], 100, 50), "");
    assert.equal(strokePath([{ x: 0.5, y: 0.5, p: 0.5 }], 100, 50), "M50 25l0.01 0");
    assert.equal(
      strokePath(
        [
          { x: 0, y: 0, p: 0.5 },
          { x: 1, y: 1, p: 0.5 },
        ],
        100,
        50,
      ),
      "M0 0L100 50",
    );
    assert.equal(
      strokePath(
        [
          { x: 0, y: 0, p: 0.5 },
          { x: 0.5, y: 1, p: 0.5 },
          { x: 1, y: 0, p: 0.5 },
        ],
        100,
        50,
      ),
      "M0 0Q50 50 75 25L100 0",
    );
  });
  test("SVG autónomo con un path por trazo y sin trazos vacíos", () => {
    const svg = signatureSvg(
      [
        [
          { x: 0, y: 0, p: 0.5 },
          { x: 1, y: 1, p: 0.5 },
        ],
        [],
      ],
      200,
      80,
    );
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"'));
    assert.equal(svg.match(/<path /g)?.length, 1);
    assert.ok(svg.includes('stroke="currentColor"'));
  });
  test("puntos en fracciones, acotados y sin los que apenas se mueven", () => {
    const s: SignatureStroke = [];
    const rect = { left: 10, top: 10, width: 200, height: 100 };
    assert.equal(addPoint(s, 110, 60, rect, 0), true);
    assert.deepEqual(s[0], { x: 0.5, y: 0.5, p: 0.5 });
    assert.equal(addPoint(s, 110.2, 60.2, rect, 0.8), false);
    assert.equal(addPoint(s, 500, -50, rect, 0.8), true);
    assert.deepEqual(s[1], { x: 1, y: 0, p: 0.8 });
    assert.equal(addPoint([], 0, 0, { left: 0, top: 0, width: 0, height: 0 }, 1), true);
  });
});
