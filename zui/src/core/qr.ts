// Codificador de códigos QR (ISO/IEC 18004) propio, sin dependencias: modo byte (texto en UTF-8), versiones 1–40,
// niveles de corrección L, M, Q y H, Reed–Solomon sobre GF(256) con el polinomio 0x11D, entrelazado de bloques, las
// ocho máscaras con la puntuación de penalización de la norma y la información de formato y de versión con sus BCH.
// Devuelve la matriz de módulos; el dibujo (SVG) lo hacen el componente y el modo DOM. Sin documento.

export type QrLevel = "L" | "M" | "Q" | "H";
export const QR_LEVELS: readonly QrLevel[] = ["L", "M", "Q", "H"];
export const isQrLevel = (v: unknown): v is QrLevel => typeof v === "string" && (QR_LEVELS as readonly string[]).includes(v);

/** Bits de nivel en la información de formato (L 01, M 00, Q 11, H 10). */
const FORMAT_BITS: Record<QrLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };
const LEVEL_INDEX: Record<QrLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };

// Tablas de la norma (tabla 9): palabras de corrección por bloque y número de bloques, por nivel y versión (índice 0
// sin uso).
// prettier-ignore
const ECC_PER_BLOCK: readonly (readonly number[])[] = [
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28,
  ],
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30,
  ],
];
// prettier-ignore
const NUM_BLOCKS: readonly (readonly number[])[] = [
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24,
    25,
  ],
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40,
    43, 45, 47, 49,
  ],
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56,
    59, 62, 65, 68,
  ],
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63,
    66, 70, 74, 77, 81,
  ],
];

export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

/** Lado de la matriz de una versión. */
export const qrSize = (version: number) => version * 4 + 17;

/** Módulos de datos (y corrección) de una versión: todo lo que no es patrón de función. */
export function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Palabras de datos (sin corrección) de una versión y un nivel. */
export const dataCodewords = (version: number, level: QrLevel) =>
  Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK[LEVEL_INDEX[level]]![version]! * NUM_BLOCKS[LEVEL_INDEX[level]]![version]!;

/** Bits del contador de longitud en modo byte. */
const countBits = (version: number) => (version <= 9 ? 8 : 16);

/** Bytes que caben en modo byte en una versión y un nivel. */
export const byteCapacity = (version: number, level: QrLevel) =>
  Math.floor((dataCodewords(version, level) * 8 - 4 - countBits(version)) / 8);

/* ---------- Reed–Solomon sobre GF(256) ---------- */

/** Producto en GF(2⁸) módulo x⁸ + x⁴ + x³ + x² + 1 (0x11D). */
export function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** Polinomio generador de grado `degree` (coeficientes sin el término principal, de mayor a menor). */
export function rsGenerator(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < degree) result[j]! ^= result[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

/** Palabras de corrección de `data` con el generador dado. */
export function rsRemainder(data: ArrayLike<number>, generator: readonly number[]): number[] {
  const result = new Array<number>(generator.length).fill(0);
  for (let k = 0; k < data.length; k++) {
    const factor = data[k]! ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < generator.length; i++) result[i]! ^= gfMul(generator[i]!, factor);
  }
  return result;
}

/* ---------- Datos ---------- */

/** Bits de datos en modo byte, con terminador, relleno a byte y bytes de relleno 0xEC/0x11. */
export function dataBits(bytes: Uint8Array, version: number, level: QrLevel): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, countBits(version));
  for (const b of bytes) push(b, 8);
  const capacity = dataCodewords(version, level) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  return bits;
}

/** Palabras de datos y de corrección entrelazadas por bloques, listas para colocar. */
export function interleave(data: readonly number[], version: number, level: QrLevel): number[] {
  const li = LEVEL_INDEX[level];
  const blocks = NUM_BLOCKS[li]![version]!;
  const eccLen = ECC_PER_BLOCK[li]![version]!;
  const raw = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const generator = rsGenerator(eccLen);
  const all: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const len = shortLen - eccLen + (i < shortBlocks ? 0 : 1);
    const block = data.slice(k, k + len);
    k += len;
    const ecc = rsRemainder(block, generator);
    // Los bloques cortos llevan un hueco antes de la corrección para alinear las columnas del entrelazado.
    if (i < shortBlocks) block.push(-1);
    all.push([...block, ...ecc]);
  }
  const out: number[] = [];
  for (let i = 0; i < all[0]!.length; i++) for (const block of all) if (block[i]! >= 0) out.push(block[i]!);
  return out;
}

/* ---------- Matriz ---------- */

export interface QrCode {
  version: number;
  level: QrLevel;
  mask: number;
  size: number;
  /** `modules[y][x]`: true es oscuro. */
  modules: boolean[][];
}

/** Columnas o filas de los patrones de alineación de una versión. */
export function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = qrSize(version) - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

/** Información de formato (15 bits con BCH y la máscara 0x5412) para un nivel y una máscara. */
export function formatBits(level: QrLevel, mask: number): number {
  const data = (FORMAT_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** Información de versión (18 bits con BCH), desde la versión 7. */
export function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

const MASKS: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
/** Condición de inversión de cada máscara (0–7) en la columna `x` y la fila `y`. */
export const maskAt = (mask: number, x: number, y: number) => MASKS[mask]!(x, y);

class Matrix {
  readonly size: number;
  readonly modules: boolean[][];
  readonly fn: boolean[][];
  constructor(readonly version: number) {
    this.size = qrSize(version);
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fn = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }
  setFn(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark;
    this.fn[y]![x] = true;
  }
  drawFunctions() {
    const { size } = this;
    for (let i = 0; i < size; i++) {
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(size - 4, 3);
    this.finder(3, size - 4);
    const align = alignmentPositions(this.version);
    const n = align.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        // Sin solapar los tres patrones de posición.
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        this.alignment(align[i]!, align[j]!);
      }
    this.drawFormat(0);
    this.drawVersion();
  }
  finder(cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.setFn(x, y, d !== 2 && d !== 4);
      }
  }
  alignment(cx: number, cy: number) {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) this.setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  drawFormat(bits: number) {
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;
    const { size } = this;
    for (let i = 0; i <= 5; i++) this.setFn(8, i, bit(i));
    this.setFn(8, 7, bit(6));
    this.setFn(8, 8, bit(7));
    this.setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.setFn(8, size - 15 + i, bit(i));
    // Módulo oscuro fijo.
    this.setFn(8, size - 8, true);
  }
  drawVersion() {
    if (this.version < 7) return;
    const bits = versionBits(this.version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFn(a, b, dark);
      this.setFn(b, a, dark);
    }
  }
  /** Coloca las palabras en zigzag de dos columnas, de abajo a la derecha hacia arriba. */
  place(codewords: readonly number[]) {
    const { size } = this;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!this.fn[y]![x] && i < codewords.length * 8) {
            this.modules[y]![x] = ((codewords[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
    }
  }
  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) if (!this.fn[y]![x] && maskAt(mask, x, y)) this.modules[y]![x] = !this.modules[y]![x];
  }
}

/** Penalización de una matriz (las cuatro reglas de la norma): la máscara con menos es la elegida. */
export function penalty(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  let score = 0;
  const line = (get: (i: number) => boolean) => {
    // Regla 1: tramos de 5 o más del mismo color.
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && get(i) === get(i - 1)) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    // Regla 3: 1:1:3:1:1 con cuatro claros a un lado (fuera de la matriz cuenta como claro, la zona de silencio).
    const at = (i: number) => (i >= 0 && i < size ? get(i) : false);
    for (let i = -4; i < size; i++) {
      const core = at(i) && !at(i + 1) && at(i + 2) && at(i + 3) && at(i + 4) && !at(i + 5) && at(i + 6);
      if (!core) continue;
      const before = !at(i - 1) && !at(i - 2) && !at(i - 3) && !at(i - 4);
      const after = !at(i + 7) && !at(i + 8) && !at(i + 9) && !at(i + 10);
      if (before || after) score += 40;
    }
  };
  for (let y = 0; y < size; y++) line((x) => modules[y]![x]!);
  for (let x = 0; x < size; x++) line((y) => modules[y]![x]!);
  // Regla 2: bloques de 2 × 2 del mismo color.
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y]![x];
      if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) score += 3;
    }
  // Regla 4: proporción de oscuros lejos del 50 %.
  let dark = 0;
  for (const row of modules) for (const m of row) if (m) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return score + Math.max(0, k) * 10;
}

export interface QrOptions {
  level?: QrLevel;
  /** Versión mínima (1–40); se sube si el texto no cabe. */
  minVersion?: number;
  /** Máscara fija (0–7); por defecto la de menor penalización. */
  mask?: number;
}

/** Texto en bytes UTF-8. */
export const utf8 = (text: string) => new TextEncoder().encode(text);

/** Versión más pequeña en la que caben `length` bytes con ese nivel, o `null` si no cabe en la 40. */
export function fitVersion(length: number, level: QrLevel, minVersion = MIN_VERSION): number | null {
  for (let v = Math.max(MIN_VERSION, Math.min(MAX_VERSION, Math.floor(minVersion))); v <= MAX_VERSION; v++)
    if (byteCapacity(v, level) >= length) return v;
  return null;
}

/** Código QR de un texto (o de bytes). `null` si no cabe ni en la versión 40. */
export function encodeQr(input: string | Uint8Array, options: QrOptions = {}): QrCode | null {
  const level = isQrLevel(options.level) ? options.level : "M";
  const bytes = typeof input === "string" ? utf8(input) : input;
  const version = fitVersion(bytes.length, level, options.minVersion);
  if (version === null) return null;
  const bits = dataBits(bytes, version, level);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));
  const codewords = interleave(data, version, level);
  const base = new Matrix(version);
  base.drawFunctions();
  base.place(codewords);
  const build = (mask: number) => {
    const m = new Matrix(version);
    for (let y = 0; y < m.size; y++) {
      m.modules[y] = [...base.modules[y]!];
      m.fn[y] = [...base.fn[y]!];
    }
    m.applyMask(mask);
    m.drawFormat(formatBits(level, mask));
    return m;
  };
  let best: Matrix | null = null;
  let bestMask = 0;
  if (Number.isInteger(options.mask) && options.mask! >= 0 && options.mask! <= 7) {
    bestMask = options.mask!;
    best = build(bestMask);
  } else {
    let bestScore = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 8; mask++) {
      const m = build(mask);
      const score = penalty(m.modules);
      if (score < bestScore) {
        bestScore = score;
        best = m;
        bestMask = mask;
      }
    }
  }
  return { version, level, mask: bestMask, size: best!.size, modules: best!.modules };
}

/**
 * Trazado SVG de los módulos oscuros (un solo `path`, tramos horizontales unidos), con `margin` módulos de zona de
 * silencio alrededor. El `viewBox` es `0 0 n n` con `n = size + 2 × margin`.
 */
export function qrPath(code: Pick<QrCode, "size" | "modules">, margin = 4): string {
  let d = "";
  for (let y = 0; y < code.size; y++) {
    let x = 0;
    while (x < code.size) {
      if (!code.modules[y]![x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < code.size && code.modules[y]![x]) x++;
      d += `M${start + margin} ${y + margin}h${x - start}v1h${start - x}z`;
    }
  }
  return d;
}

/** Módulos reservados para un icono centrado (lado en módulos, impar), sin pisar más del ~10 % del código. */
export function logoModules(size: number, level: QrLevel): number {
  const share = level === "H" ? 0.3 : level === "Q" ? 0.24 : level === "M" ? 0.18 : 0.12;
  const side = Math.floor(size * share);
  return side % 2 === 0 ? Math.max(0, side - 1) : side;
}
