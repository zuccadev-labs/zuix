// Oleada 7: color de ColorPicker (core/color). Conversiones contra valores de referencia (CSS Color 4 y la
// calculadora de OKLCH de Ottosson), lectura de cadenas CSS y redondeos estables con fast-check.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  areaAt,
  areaKey,
  channelsOf,
  channelValues,
  contrastRatio,
  COLOR_FORMATS,
  formatColor,
  formatOf,
  hslToRgb,
  hsvToRgb,
  inGamut,
  inkOn,
  isColorFormat,
  normalizeColor,
  oklchToRgb,
  parseColor,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  round,
  sameColor,
  withChannel,
  wrapHue,
  type Rgba,
} from "../../zui/src/core/color.ts";

const rgba = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a });
const near = (a: number, b: number, eps: number, msg?: string) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} ≈ ${b}`);
const byte = fc.integer({ min: 0, max: 255 });
const color = fc.record({ r: byte, g: byte, b: byte, a: fc.integer({ min: 0, max: 255 }).map((n) => n / 255) });
const floatColor = fc.record({
  r: fc.double({ min: 0, max: 255, noNaN: true }),
  g: fc.double({ min: 0, max: 255, noNaN: true }),
  b: fc.double({ min: 0, max: 255, noNaN: true }),
  a: fc.double({ min: 0, max: 1, noNaN: true }),
});

describe("color · OKLCH contra valores de referencia", () => {
  // Valores de CSS Color 4 (ejemplos de oklch) y de oklch.com, con 5 cifras.
  const vectors: Array<[string, number, number, number]> = [
    ["#ff0000", 0.62796, 0.25768, 29.2339],
    ["#00ff00", 0.86644, 0.29483, 142.4953],
    ["#0000ff", 0.45201, 0.31321, 264.052],
    ["#ffffff", 1, 0, 0],
    ["#000000", 0, 0, 0],
    ["#808080", 0.59987, 0, 0],
  ];
  for (const [hex, l, c, h] of vectors) {
    test(`${hex} → oklch(${l} ${c} ${h})`, () => {
      const o = rgbToOklch(parseColor(hex)!);
      near(o.l, l, 2e-4, "L");
      near(o.c, c, 2e-4, "C");
      if (c > 0) near(o.h, h, 0.02, "H");
    });
  }
  test("oklch → sRGB devuelve los primarios", () => {
    assert.equal(normalizeColor("oklch(62.796% 0.25768 29.2339)"), "#ff0000");
    assert.equal(normalizeColor("oklch(0.86644 0.29483 142.4953)"), "#00ff00");
    assert.equal(normalizeColor("oklch(45.201% 0.31321 264.052)"), "#0000ff");
  });
  test("fuera de sRGB se reduce el croma sin cambiar el tono", () => {
    const out = parseColor("oklch(70% 0.4 150)")!;
    assert.ok(inGamut(out, 0));
    const back = rgbToOklch(out);
    near(back.l, 0.7, 0.01, "L");
    near(back.h, 150, 1, "H");
    assert.ok(back.c < 0.4);
    assert.deepEqual(parseColor("oklch(100% 0.3 40)"), rgba(255, 255, 255));
    assert.deepEqual(parseColor("oklch(0% 0.3 40)"), rgba(0, 0, 0));
  });
  test("propiedad: sRGB → OKLCH → sRGB conserva el color", () => {
    fc.assert(
      fc.property(floatColor, (c) => {
        const back = oklchToRgb(rgbToOklch(c));
        near(back.r, c.r, 1e-3);
        near(back.g, c.g, 1e-3);
        near(back.b, c.b, 1e-3);
      }),
    );
  });
});

describe("color · HSV y HSL", () => {
  test("valores conocidos", () => {
    assert.deepEqual(hsvToRgb({ h: 0, s: 1, v: 1, a: 1 }), rgba(255, 0, 0));
    assert.deepEqual(hsvToRgb({ h: 120, s: 1, v: 1, a: 1 }), rgba(0, 255, 0));
    assert.deepEqual(hsvToRgb({ h: 240, s: 1, v: 0.5, a: 1 }), rgba(0, 0, 127.5));
    assert.deepEqual(hslToRgb({ h: 210, s: 1, l: 0.5, a: 1 }), rgba(0, 127.5, 255));
    assert.equal(formatColor(hslToRgb({ h: 30, s: 0.5, l: 0.25, a: 1 })), "#604020");
    assert.deepEqual(rgbToHsl(rgba(255, 255, 255)), { h: 0, s: 0, l: 1, a: 1 });
  });
  test("un gris conserva el tono que se le pase (el área no salta a rojo)", () => {
    assert.equal(rgbToHsv(rgba(128, 128, 128), 200).h, 200);
    assert.equal(rgbToHsv(rgba(0, 0, 0), 75).h, 75);
    assert.equal(rgbToHsv(rgba(255, 0, 0), 75).h, 0);
  });
  test("propiedad: sRGB → HSV → sRGB y sRGB → HSL → sRGB", () => {
    fc.assert(
      fc.property(floatColor, (c) => {
        for (const back of [hsvToRgb(rgbToHsv(c)), hslToRgb(rgbToHsl(c))]) {
          near(back.r, c.r, 1e-6);
          near(back.g, c.g, 1e-6);
          near(back.b, c.b, 1e-6);
          near(back.a, c.a, 1e-12);
        }
      }),
    );
  });
  test("tono en [0, 360)", () => {
    assert.equal(wrapHue(360), 0);
    assert.equal(wrapHue(-30), 330);
    assert.equal(wrapHue(Number.NaN), 0);
  });
});

describe("color · lectura", () => {
  test("hex corto, largo y con alfa", () => {
    assert.deepEqual(parseColor("#f80"), rgba(255, 136, 0));
    assert.deepEqual(parseColor("#F808"), rgba(255, 136, 0, 136 / 255));
    assert.deepEqual(parseColor("#3b82f6"), rgba(59, 130, 246));
    assert.deepEqual(parseColor("#3b82f680"), rgba(59, 130, 246, 128 / 255));
    assert.equal(parseColor("#3b82f"), null);
    assert.equal(parseColor("#ggg"), null);
  });
  test("funciones con espacios, comas, porcentajes y ángulos", () => {
    assert.deepEqual(parseColor("rgb(59 130 246)"), rgba(59, 130, 246));
    assert.deepEqual(parseColor("rgba(59, 130, 246, 0.5)"), rgba(59, 130, 246, 0.5));
    assert.deepEqual(parseColor("rgb(100% 0% 50% / 25%)"), rgba(255, 0, 127.5, 0.25));
    assert.deepEqual(parseColor("rgb(300 -4 0)"), rgba(255, 0, 0));
    assert.equal(normalizeColor("hsl(0.5turn 100% 50%)"), "#00ffff");
    assert.equal(normalizeColor("hsl(180deg, 100%, 50%)"), "#00ffff");
    assert.equal(normalizeColor("hsla(3.14159rad 100% 50% / 0.5)"), "#00ffff80");
    assert.equal(normalizeColor("hsl(200grad 100 50)"), "#00ffff");
    assert.equal(normalizeColor("hwb(0 0% 0%)"), "#ff0000");
    assert.equal(normalizeColor("hwb(0 60% 60%)"), "#808080");
    assert.equal(normalizeColor("rgb(none 0 0)"), "#000000");
    assert.deepEqual(parseColor("transparent"), rgba(0, 0, 0, 0));
    assert.equal(normalizeColor("  RGB(0 0 255)  "), "#0000ff");
  });
  test("lo que no es un color da null", () => {
    for (const bad of [
      "",
      "red",
      "rgb(1 2)",
      "rgb(1 2 3 4)",
      "rgb(a b c)",
      "rgb(1 2 3 / x)",
      "lab(50 0 0)",
      "rgb(1 2 3 / 4 / 5)",
      "hsl(10% 50% 50%)",
    ])
      assert.equal(parseColor(bad), null, bad);
    assert.equal(normalizeColor("nope"), "#000000");
    assert.equal(normalizeColor("nope", "rgb", "x"), "x");
  });
  test("formato de una cadena", () => {
    assert.equal(formatOf("#fff"), "hex");
    assert.equal(formatOf("rgba(0,0,0,1)"), "rgb");
    assert.equal(formatOf("HSL(0 0% 0%)"), "hsl");
    assert.equal(formatOf("oklch(50% 0 0)"), "oklch");
    assert.equal(formatOf("hwb(0 0% 0%)"), null);
    assert.ok(COLOR_FORMATS.every(isColorFormat));
    assert.equal(isColorFormat("lab"), false);
  });
});

describe("color · escritura estable", () => {
  test("cada formato", () => {
    const c = rgba(59, 130, 246);
    assert.equal(formatColor(c, "hex"), "#3b82f6");
    assert.equal(formatColor(c, "rgb"), "rgb(59 130 246)");
    assert.equal(formatColor(c, "hsl"), "hsl(217 91% 60%)");
    assert.equal(formatColor(c, "oklch"), "oklch(62.31% 0.188 259.81)");
    assert.equal(formatColor({ ...c, a: 0.5 }, "rgb"), "rgb(59 130 246 / 0.5)");
    assert.equal(formatColor({ ...c, a: 0.5 }, "hex"), "#3b82f680");
    assert.equal(formatColor(rgba(255, 255, 255), "oklch"), "oklch(100% 0 0)");
    assert.equal(formatColor(rgba(128, 128, 128), "hsl"), "hsl(0 0% 50%)");
  });
  test("propiedad: escribir, leer y volver a escribir da la misma cadena (los cuatro formatos)", () => {
    fc.assert(
      fc.property(floatColor, fc.constantFrom(...COLOR_FORMATS), (c, format) => {
        const once = formatColor(c, format);
        const twice = formatColor(parseColor(once)!, format);
        assert.equal(twice, once);
      }),
      { numRuns: 3000 },
    );
  });
  test("propiedad: hex ↔ rgb sin pérdida en 8 bits (alfa incluido)", () => {
    fc.assert(
      fc.property(color, (c) => {
        const hex = formatColor(c, "hex");
        assert.equal(formatColor(parseColor(formatColor(parseColor(hex)!, "rgb"))!, "hex"), hex);
        assert.ok(sameColor(parseColor(hex)!, c));
      }),
    );
  });
  test("redondeo sin -0", () => {
    assert.ok(Object.is(round(-0.0001, 2), 0));
    assert.equal(round(1.005, 2), 1.01);
  });
});

describe("color · contraste y campos", () => {
  test("contraste WCAG y tinta sobre la muestra", () => {
    near(contrastRatio(rgba(0, 0, 0), rgba(255, 255, 255)), 21, 1e-9);
    near(contrastRatio(rgba(118, 118, 118), rgba(255, 255, 255)), 4.54, 0.01);
    assert.equal(inkOn(rgba(255, 255, 0)), "dark");
    assert.equal(inkOn(rgba(30, 30, 120)), "light");
    assert.equal(inkOn(rgba(30, 30, 120, 0.2)), "auto");
  });
  test("campos por formato", () => {
    assert.deepEqual(
      channelsOf("hex", true).map((s) => s.channel),
      ["hex", "alpha"],
    );
    assert.deepEqual(
      channelsOf("oklch", false).map((s) => s.channel),
      ["L", "C", "H"],
    );
    const c = rgba(59, 130, 246, 0.5);
    assert.deepEqual(channelValues(c, "hex"), { hex: "3B82F6", alpha: "50" });
    assert.deepEqual(channelValues(c, "rgb"), { r: "59", g: "130", b: "246", alpha: "50" });
    assert.deepEqual(channelValues(c, "hsl"), { h: "217", s: "91", l: "60", alpha: "50" });
    assert.deepEqual(channelValues(c, "oklch"), { L: "62.3", C: "0.188", H: "259.8", alpha: "50" });
  });
  test("escribir en un campo", () => {
    const c = rgba(59, 130, 246, 0.5);
    assert.equal(formatColor(withChannel(c, "hex", "hex", "#f00")!), "#ff000080");
    assert.equal(formatColor(withChannel(c, "hex", "hex", "00FF00")!, "hex"), "#00ff0080");
    assert.equal(withChannel(c, "hex", "hex", "00FF0"), null);
    assert.equal(formatColor(withChannel(c, "rgb", "r", "300")!, "rgb"), "rgb(255 130 246 / 0.5)");
    assert.equal(formatColor(withChannel(c, "hsl", "h", "0")!, "hsl"), "hsl(0 91% 60% / 0.5)");
    assert.equal(formatColor(withChannel(c, "oklch", "L", "50")!, "oklch").startsWith("oklch(50% "), true);
    assert.equal(formatColor(withChannel(c, "oklch", "C", "0")!, "oklch"), "oklch(62.31% 0 0 / 0.5)");
    assert.equal(withChannel(c, "rgb", "alpha", "25")!.a, 0.25);
    assert.equal(withChannel(c, "rgb", "r", ""), null);
    assert.equal(withChannel(c, "rgb", "r", "abc"), null);
    assert.equal(withChannel(c, "rgb", "H", "3"), null);
    assert.equal(withChannel(c, "rgb", "g", "12,5")!.g, 12.5);
  });
});

describe("color · teclado y puntero del área", () => {
  test("flechas, Mayúsculas, páginas, Inicio y Fin", () => {
    assert.deepEqual(areaKey("ArrowRight", false, 0.5, 0.5), { s: 0.51, v: 0.5 });
    assert.deepEqual(areaKey("ArrowRight", false, 0.5, 0.5, -1), { s: 0.49, v: 0.5 });
    assert.deepEqual(areaKey("ArrowUp", true, 0.5, 0.5), { s: 0.5, v: 0.6 });
    assert.deepEqual(areaKey("ArrowDown", false, 0.5, 0), { s: 0.5, v: 0 });
    assert.deepEqual(areaKey("PageDown", false, 0.5, 0.5), { s: 0.5, v: 0.4 });
    assert.deepEqual(areaKey("Home", false, 0.5, 0.5), { s: 0, v: 0.5 });
    assert.deepEqual(areaKey("End", false, 0.5, 0.5), { s: 1, v: 0.5 });
    assert.equal(areaKey("Enter", false, 0.5, 0.5), undefined);
  });
  test("propiedad: el área queda siempre dentro de [0,1]²", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"),
        fc.boolean(),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (key, shift, s, v) => {
          const out = areaKey(key, shift, s, v)!;
          assert.ok(out.s >= 0 && out.s <= 1 && out.v >= 0 && out.v <= 1);
        },
      ),
    );
    assert.deepEqual(areaAt(0.25, 0.75), { s: 0.25, v: 0.25 });
    assert.deepEqual(areaAt(-1, 2), { s: 0, v: 0 });
  });
});
