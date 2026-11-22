// Motor de DotMatrix: patrones de una rejilla de puntos. Cada patrón asigna a cada punto una fase (0..1) dentro de
// un ciclo; el CSS anima todos los puntos con el mismo fotograma clave y la fase lo desplaza en el tiempo. Así el
// movimiento es CSS puro (opacidad y escala, en el compositor), sin temporizadores ni lienzo, y el mismo marcado
// sirve para React, el modo sin framework y el HTML estático. Patrones de diseño propio. Sin efectos al importar.

/** Patrones disponibles, en el orden en que se presentan. */
export const DOT_PATTERNS = [
  "wave",
  "rain",
  "spiral",
  "pulse",
  "sweep",
  "checker",
  "orbit",
  "ripple",
  "cross",
  "snake",
  "equalizer",
  "sparkle",
  "diamond",
  "radar",
  "zigzag",
  "helix",
  "heart",
  "cascade",
] as const;
export type DotPattern = (typeof DOT_PATTERNS)[number];

/**
 * Forma del ciclo de cada punto: `trail` se enciende de golpe y se apaga dejando estela (recorridos);
 * `breathe` sube y baja de forma simétrica (ondas, latidos).
 */
export type DotMotion = "trail" | "breathe";

export interface DotCell {
  /** Momento del ciclo (0..1) en que el punto alcanza su brillo máximo. */
  phase: number;
  /** Brillo del fotograma quieto (movimiento reducido): el del ciclo en el instante 0. */
  rest: number;
  /** Punto que no participa en el patrón: queda tenue y quieto. */
  off?: boolean;
}

const MOTION: Record<DotPattern, DotMotion> = {
  wave: "breathe",
  rain: "trail",
  spiral: "trail",
  pulse: "breathe",
  sweep: "trail",
  checker: "breathe",
  orbit: "trail",
  ripple: "breathe",
  cross: "breathe",
  snake: "trail",
  equalizer: "breathe",
  sparkle: "trail",
  diamond: "breathe",
  radar: "trail",
  zigzag: "trail",
  helix: "breathe",
  heart: "breathe",
  cascade: "trail",
};

/** Duración por defecto de un ciclo, en segundos, según el patrón. */
const DURATION: Record<DotPattern, number> = {
  wave: 1.6,
  rain: 1.4,
  spiral: 2.4,
  pulse: 1.6,
  sweep: 1.4,
  checker: 1.2,
  orbit: 1.6,
  ripple: 1.8,
  cross: 1.4,
  snake: 2.4,
  equalizer: 1.2,
  sparkle: 2,
  diamond: 1.6,
  radar: 1.8,
  zigzag: 2,
  helix: 1.8,
  heart: 1.2,
  cascade: 1.6,
};

/** Brillo mínimo de un punto (su estado tenue). */
export const DOT_DIM = 0.16;
/** Parte del ciclo que dura la estela de `trail`. */
const TRAIL = 0.35;

export const isDotPattern = (value: unknown): value is DotPattern => DOT_PATTERNS.includes(value as DotPattern);
export const dotMotion = (pattern: DotPattern): DotMotion => MOTION[pattern];
export const dotDuration = (pattern: DotPattern): number => DURATION[pattern];

/** Brillo (DOT_DIM..1) en el punto `progress` (0..1) del fotograma clave de cada movimiento. Es el mismo que dibuja el CSS. */
export function dotIntensity(motion: DotMotion, progress: number): number {
  const p = ((progress % 1) + 1) % 1;
  if (motion === "trail") return p < TRAIL ? 1 - (1 - DOT_DIM) * (p / TRAIL) : DOT_DIM;
  return DOT_DIM + (1 - DOT_DIM) * (1 - Math.abs(2 * p - 1));
}

/** Pseudoaleatorio estable en [0, 1) a partir de enteros: el mismo patrón da siempre el mismo dibujo. */
export function dotHash(a: number, b = 0): number {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** Recorrido en espiral de fuera adentro, en el sentido de las agujas: índice de cada celda (fila por fila). */
function spiralOrder(cols: number, rows: number): number[] {
  const order = new Array<number>(cols * rows).fill(0);
  let top = 0;
  let bottom = rows - 1;
  let left = 0;
  let right = cols - 1;
  let n = 0;
  while (top <= bottom && left <= right) {
    for (let x = left; x <= right; x++) order[top * cols + x] = n++;
    for (let y = top + 1; y <= bottom; y++) order[y * cols + right] = n++;
    if (top < bottom) for (let x = right - 1; x >= left; x--) order[bottom * cols + x] = n++;
    if (left < right) for (let y = bottom - 1; y > top; y--) order[y * cols + left] = n++;
    top++;
    bottom--;
    left++;
    right--;
  }
  return order;
}

/** Posición de una celda del borde en el recorrido del perímetro (sentido de las agujas desde la esquina inicial), o -1. */
function perimeterIndex(x: number, y: number, cols: number, rows: number): number {
  if (y === 0) return x;
  if (x === cols - 1) return cols - 1 + y;
  if (y === rows - 1) return cols - 1 + rows - 1 + (cols - 1 - x);
  if (x === 0) return 2 * (cols - 1) + rows - 1 + (rows - 1 - y);
  return -1;
}

const clampSize = (n: number | undefined, fallback: number) =>
  Number.isFinite(n) ? Math.min(16, Math.max(2, Math.round(n as number))) : fallback;

/** Columnas y filas válidas (2..16; 5 por defecto). */
export function dotGrid(cols?: number, rows?: number): { cols: number; rows: number } {
  return { cols: clampSize(cols, 5), rows: clampSize(rows, clampSize(cols, 5)) };
}

/** Fases de la rejilla (fila por fila) para un patrón. */
export function dotMatrixCells(pattern: DotPattern, colsIn?: number, rowsIn?: number): DotCell[] {
  const { cols, rows } = dotGrid(colsIn, rowsIn);
  const motion = MOTION[pattern];
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxCenter = Math.hypot(cx, cy) || 1;
  const maxCorner = Math.hypot(cols - 1, rows - 1) || 1;
  const spiral = pattern === "spiral" ? spiralOrder(cols, rows) : [];
  const perimeter = 2 * (cols - 1) + 2 * (rows - 1);
  const out: DotCell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let phase = 0;
      let off = false;
      switch (pattern) {
        case "wave":
          phase = (x + y) / (cols + rows - 1);
          break;
        case "rain":
          phase = dotHash(x, 7) + (y / rows) * 0.5;
          break;
        case "spiral":
          phase = (spiral[y * cols + x] ?? 0) / (cols * rows);
          break;
        case "pulse":
          phase = (Math.hypot(x - cx, y - cy) / maxCenter) * 0.5;
          break;
        case "sweep":
          phase = (x / cols) * 0.6;
          break;
        case "checker":
          phase = ((x + y) % 2) * 0.5;
          break;
        case "orbit": {
          const i = perimeterIndex(x, y, cols, rows);
          off = i < 0;
          phase = off ? 0 : i / perimeter;
          break;
        }
        case "ripple":
          phase = (Math.hypot(x, y) / maxCorner) * 0.75;
          break;
        case "cross": {
          const diagonal = x === y || x === cols - 1 - y;
          const axis = Math.abs(x - cx) < 0.6 || Math.abs(y - cy) < 0.6;
          off = !diagonal && !axis;
          phase = diagonal ? 0 : 0.5;
          break;
        }
        case "snake": {
          const index = y * cols + (y % 2 === 0 ? x : cols - 1 - x);
          phase = index / (cols * rows);
          break;
        }
        case "equalizer":
          phase = dotHash(x, 3) * 0.5 + ((rows - 1 - y) / rows) * 0.35;
          break;
        case "sparkle":
          phase = dotHash(x, y);
          break;
        // Rombo que late desde el centro (distancia de Manhattan).
        case "diamond":
          phase = ((Math.abs(x - cx) + Math.abs(y - cy)) / (cx + cy || 1)) * 0.5;
          break;
        // Barrido de radar: el ángulo alrededor del centro, en el sentido de las agujas desde arriba.
        case "radar":
          phase = (Math.atan2(x - cx, cy - y) / (2 * Math.PI) + 1) % 1;
          break;
        // Zigzag por columnas: baja por una y sube por la siguiente.
        case "zigzag": {
          const index = x * rows + (x % 2 === 0 ? y : rows - 1 - y);
          phase = index / (cols * rows);
          break;
        }
        // Doble hélice: dos senos en contrafase; solo los puntos cercanos a una de las curvas.
        case "helix": {
          const t = (x / Math.max(1, cols - 1)) * Math.PI * 2;
          const a = cy + Math.sin(t) * cy;
          const b = cy - Math.sin(t) * cy;
          off = Math.abs(y - a) > 0.6 && Math.abs(y - b) > 0.6;
          phase = x / cols;
          break;
        }
        // Corazón que late: la silueta (x² + y² − 1)³ − x²y³ ≤ 0, escalada a la rejilla.
        case "heart": {
          const u = ((x - cx) / (cx || 1)) * 1.25;
          const v = ((cy - y) / (cy || 1)) * 1.25 + 0.25;
          off = (u * u + v * v - 1) ** 3 - u * u * v ** 3 > 0;
          // Con la fase en la mitad del ciclo, el fotograma quieto (movimiento reducido) muestra la silueta encendida.
          phase = 0.5 - (Math.hypot(x - cx, y - cy) / maxCenter) * 0.2;
          break;
        }
        // Cascada: cada columna cae con un pequeño retraso respecto a la anterior.
        case "cascade":
          phase = (x / cols) * 0.35 + (y / rows) * 0.5;
          break;
      }
      phase = ((phase % 1) + 1) % 1;
      // El punto llega al máximo en `phase`: en el instante 0 va por el tramo 1 - phase de su ciclo.
      const rest = off ? DOT_DIM : dotIntensity(motion, 1 - phase);
      out.push(off ? { phase, rest, off } : { phase, rest });
    }
  }
  return out;
}

/** Redondeo para escribir la fase y el brillo en el marcado sin decimales de sobra. */
export const dotValue = (n: number) => String(Math.round(n * 1000) / 1000);
