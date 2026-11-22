// Codificador QR propio (core/qr). Vectores conocidos de la norma ISO/IEC 18004 (anexo I: «01234567» 1-M)
// y del ejemplo «HELLO WORLD» 1-Q para Reed–Solomon; tablas de formato y versión; capacidades de modo byte; y una
// lectura independiente de la matriz (desenmascarar y recorrer el zigzag) que debe devolver las palabras codificadas.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  alignmentPositions,
  byteCapacity,
  dataBits,
  dataCodewords,
  encodeQr,
  fitVersion,
  formatBits,
  gfMul,
  interleave,
  isQrLevel,
  logoModules,
  maskAt,
  penalty,
  qrPath,
  qrSize,
  QR_LEVELS,
  rawDataModules,
  rsGenerator,
  rsRemainder,
  utf8,
  versionBits,
  type QrLevel,
} from "../../zui/src/core/qr.ts";

describe("QR · Reed–Solomon", () => {
  test("anexo I de la norma: «01234567» en 1-M", () => {
    const data = [16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17];
    assert.deepEqual(rsRemainder(data, rsGenerator(10)), [165, 36, 212, 193, 237, 54, 199, 135, 44, 85]);
  });
  test("«HELLO WORLD» en 1-Q", () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236];
    assert.deepEqual(rsRemainder(data, rsGenerator(13)), [168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16]);
  });
  test("GF(256): neutro, cero, conmutativa y el inverso de α", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), (a, b) => {
        assert.equal(gfMul(a, 1), a);
        assert.equal(gfMul(a, 0), 0);
        assert.equal(gfMul(a, b), gfMul(b, a));
      }),
    );
    assert.equal(gfMul(2, 142), 1);
  });
});

describe("QR · formato, versión y capacidades", () => {
  test("información de formato (tabla de la norma, máscara 0)", () => {
    const bin = (n: number) => n.toString(2).padStart(15, "0");
    assert.equal(bin(formatBits("L", 0)), "111011111000100");
    assert.equal(bin(formatBits("M", 0)), "101010000010010");
    assert.equal(bin(formatBits("Q", 0)), "011010101011111");
    assert.equal(bin(formatBits("H", 0)), "001011010001001");
    assert.equal(bin(formatBits("M", 5)), "100000011001110");
  });
  test("información de versión (tabla de la norma)", () => {
    assert.equal(versionBits(7).toString(2).padStart(18, "0"), "000111110010010100");
    assert.equal(versionBits(40).toString(2).padStart(18, "0"), "101000110001101001");
  });
  test("capacidad en modo byte (tabla 7 de la norma)", () => {
    const table: Array<[number, QrLevel, number]> = [
      [1, "L", 17],
      [1, "M", 14],
      [1, "Q", 11],
      [1, "H", 7],
      [10, "L", 271],
      [10, "M", 213],
      [10, "Q", 151],
      [10, "H", 119],
      [40, "L", 2953],
      [40, "M", 2331],
      [40, "Q", 1663],
      [40, "H", 1273],
    ];
    for (const [v, l, n] of table) assert.equal(byteCapacity(v, l), n, `${v}-${l}`);
    assert.equal(rawDataModules(1), 208);
    assert.equal(dataCodewords(40, "L"), 2956);
  });
  test("alineación y tamaños", () => {
    assert.deepEqual(alignmentPositions(1), []);
    assert.deepEqual(alignmentPositions(2), [6, 18]);
    assert.deepEqual(alignmentPositions(7), [6, 22, 38]);
    assert.deepEqual(alignmentPositions(32), [6, 34, 60, 86, 112, 138]);
    assert.deepEqual(alignmentPositions(40), [6, 30, 58, 86, 114, 142, 170]);
    assert.equal(qrSize(40), 177);
  });
  test("versión mínima que cabe y fuera de rango", () => {
    assert.equal(fitVersion(17, "L"), 1);
    assert.equal(fitVersion(18, "L"), 2);
    assert.equal(fitVersion(10, "H", 5), 5);
    assert.equal(fitVersion(3000, "L"), null);
    assert.equal(encodeQr("x".repeat(3000), { level: "L" }), null);
    assert.ok(QR_LEVELS.every(isQrLevel) && !isQrLevel("X"));
  });
  test("bits de datos: modo, longitud, terminador y relleno alterno", () => {
    const bits = dataBits(utf8("A"), 1, "H");
    assert.equal(bits.length, 72);
    const bytes = Array.from({ length: 9 }, (_, i) => Number.parseInt(bits.slice(i * 8, i * 8 + 8).join(""), 2));
    assert.deepEqual(bytes, [0x40, 0x14, 0x10, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11]);
  });
});

/** Lectura independiente: zigzag de dos columnas sobre los módulos que no son de función, desenmascarados. */
function readCodewords(code: { size: number; modules: boolean[][]; mask: number; version: number }): number[] {
  const { size } = code;
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const mark = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < size && y < size) fn[y]![x] = true;
  };
  for (let i = 0; i < size; i++) {
    mark(6, i);
    mark(i, 6);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as const)
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy);
  const al = alignmentPositions(code.version);
  for (let i = 0; i < al.length; i++)
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(al[i]! + dx, al[j]! + dy);
    }
  for (let i = 0; i < 9; i++) {
    mark(8, i);
    mark(i, 8);
  }
  for (let i = 0; i < 8; i++) {
    mark(size - 1 - i, 8);
    mark(8, size - 1 - i);
  }
  if (code.version >= 7)
    for (let i = 0; i < 18; i++) {
      mark(size - 11 + (i % 3), Math.floor(i / 3));
      mark(Math.floor(i / 3), size - 11 + (i % 3));
    }
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y]![x]) bits.push(code.modules[y]![x]! !== maskAt(code.mask, x, y) ? 1 : 0);
      }
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  return out;
}

const finderOk = (m: boolean[][], cx: number, cy: number) => {
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) if (m[cy + dy]![cx + dx] !== (Math.max(Math.abs(dx), Math.abs(dy)) !== 2)) return false;
  return true;
};

describe("QR · matriz", () => {
  test("estructura: patrones de posición, temporización, módulo oscuro y formato leído de vuelta", () => {
    const code = encodeQr("https://zuccadev-labs.github.io/zuix/", { level: "Q" })!;
    assert.equal(code.version, 4);
    const m = code.modules;
    const n = code.size;
    assert.ok(finderOk(m, 3, 3) && finderOk(m, n - 4, 3) && finderOk(m, 3, n - 4));
    for (let i = 8; i < n - 8; i++) {
      assert.equal(m[6]![i], i % 2 === 0);
      assert.equal(m[i]![6], i % 2 === 0);
    }
    assert.equal(m[n - 8]![8], true);
    let format = 0;
    for (let i = 0; i <= 5; i++) format |= (m[i]![8] ? 1 : 0) << i;
    format |= (m[7]![8] ? 1 : 0) << 6;
    format |= (m[8]![8] ? 1 : 0) << 7;
    format |= (m[8]![7] ? 1 : 0) << 8;
    for (let i = 9; i < 15; i++) format |= (m[8]![14 - i] ? 1 : 0) << i;
    assert.equal(format, formatBits("Q", code.mask));
  });
  test("propiedad: la lectura independiente devuelve los datos y la corrección codificados", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 160 }), fc.constantFrom(...QR_LEVELS), (text, level) => {
        const code = encodeQr(text, { level })!;
        const bytes = utf8(text);
        const bits = dataBits(bytes, code.version, level);
        const data: number[] = [];
        for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
        const expected = interleave(data, code.version, level);
        assert.deepEqual(readCodewords(code).slice(0, expected.length), expected);
      }),
      { numRuns: 60 },
    );
  });
  test("versión 7 o más: información de versión en las dos esquinas", () => {
    const code = encodeQr("z".repeat(200), { level: "M" })!;
    assert.ok(code.version >= 7);
    const n = code.size;
    const bits = versionBits(code.version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      assert.equal(code.modules[Math.floor(i / 3)]![n - 11 + (i % 3)], dark);
      assert.equal(code.modules[n - 11 + (i % 3)]![Math.floor(i / 3)], dark);
    }
  });
  test("máscara fija, la elegida es la de menor penalización y el trazado SVG", () => {
    const fixed = encodeQr("zuix", { mask: 3, level: "L" })!;
    assert.equal(fixed.mask, 3);
    const auto = encodeQr("zuix", { level: "L" })!;
    const scores = Array.from({ length: 8 }, (_, k) => penalty(encodeQr("zuix", { mask: k, level: "L" })!.modules));
    assert.equal(penalty(auto.modules), Math.min(...scores));
    const path = qrPath(
      {
        size: 2,
        modules: [
          [true, true],
          [false, true],
        ],
      },
      1,
    );
    assert.equal(path, "M1 1h2v1h-2zM2 2h1v1h-1z");
    assert.equal(encodeQr(new Uint8Array([1, 2, 3]))!.level, "M");
    assert.equal(logoModules(25, "H"), 7);
    assert.equal(logoModules(25, "L"), 3);
    assert.equal(logoModules(21, "M"), 3);
  });
});
