// Cálculo de los gráficos (líneas, áreas, barras, anillos y minigráficos): escalas lineal, temporal y de banda, marcas
// «bonitas» de eje, apilado, sectores de anillo y trazados SVG. Puro: sin documento, sin React y sin estado. Las
// coordenadas son fracciones de 0 a 1 del área de trazado (el SVG usa un viewBox de 100 × 100 sin conservar la
// proporción y trazos que no escalan), así que nada depende de medir el contenedor.

/** Redondeo para el marcado: tres decimales bastan en un viewBox de 100. */
export const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Mínimo y máximo de los valores finitos (`null` si no hay ninguno). */
export function extent(values: Iterable<number | null | undefined>): [number, number] | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo <= hi ? [lo, hi] : null;
}

/** Paso «bonito» (1, 2, 2.5 o 5 × 10ⁿ) para repartir `span` en unas `count` divisiones. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !(count > 0)) return 1;
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const f = raw / power;
  // Con tolerancia: 0.6 / 6 da 0.09999… y no debe saltar al paso siguiente.
  const e = 1 + 1e-9;
  const nice = f <= e ? 1 : f <= 2 * e ? 2 : f <= 2.5 * e ? 2.5 : f <= 5 * e ? 5 : 10;
  return nice * power;
}

export interface LinearTicks {
  /** Dominio redondeado a múltiplos del paso: contiene a [min, max]. */
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/**
 * Marcas de un eje lineal: unas `count` divisiones de paso bonito que cubren [min, max]. Con `zero`, el dominio
 * incluye el 0 (la base de barras y áreas). Un dominio vacío (min = max) se abre alrededor del valor.
 */
export function niceTicks(min: number, max: number, count = 5, zero = false): LinearTicks {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  if (zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  // Con `zero`, lo = hi solo puede ser 0. Sin él, un único valor se abre a la mitad por cada lado.
  // Un dominio sin anchura útil (o del orden del error de coma flotante) cuenta como un solo valor.
  if (hi - lo <= 1e-12 * Math.max(1, Math.abs(lo), Math.abs(hi))) {
    const v = Math.abs(lo) < 1e-12 ? 0 : lo;
    const pad = Math.abs(v) * 0.5;
    lo = v === 0 ? 0 : v - pad;
    hi = v === 0 ? 1 : v + pad;
  }
  const step = niceStep(hi - lo, Math.max(1, count));
  // Holgura solo del orden del error de coma flotante: con 1e-9 un valor 1e-6 por fuera de una marca (−600000,000001
  // con paso 200000) se quedaba fuera de la escala (lo encontró la prueba de propiedades).
  const a = Math.floor(lo / step + 1e-12) * step;
  const b = Math.ceil(hi / step - 1e-12) * step;
  const ticks: number[] = [];
  const n = Math.round((b - a) / step);
  for (let i = 0; i <= n; i++) ticks.push(clean(a + i * step, step));
  return { min: clean(a, step), max: clean(b, step), step, ticks };
}

/** Quita el ruido de coma flotante (0.30000000000000004 → 0.3) según la precisión del paso. */
function clean(v: number, step: number): number {
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  const out = Number(v.toFixed(Math.min(20, digits)));
  return Object.is(out, -0) ? 0 : out;
}

/** Escala lineal: valor del dominio → fracción del rango (y su inversa). */
export function linearScale(domain: [number, number], range: [number, number] = [0, 1]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const scale = (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
  scale.invert = (f: number) => d0 + ((f - r0) / (r1 - r0 || 1)) * span;
  return scale;
}

export interface Band {
  /** Posición de inicio de cada banda (fracción). */
  start: (i: number) => number;
  center: (i: number) => number;
  /** Ancho de la banda sin el hueco interior. */
  bandwidth: number;
  /** Distancia entre inicios de bandas consecutivas. */
  step: number;
}

/** Escala de banda: `n` categorías repartidas en [0, 1] con un hueco interior y exterior (fracciones del paso). */
export function bandScale(n: number, paddingInner = 0.3, paddingOuter = 0.15): Band {
  const count = Math.max(1, n);
  const inner = Math.min(0.95, Math.max(0, paddingInner));
  const outer = Math.max(0, paddingOuter);
  const step = 1 / (count - inner + 2 * outer);
  const bandwidth = step * (1 - inner);
  const start = (i: number) => step * (outer + i);
  return { start, center: (i) => start(i) + bandwidth / 2, bandwidth, step };
}

/**
 * Límites de la zona activa de cada punto (puntos ordenados de un eje): de la mitad hacia el anterior a la mitad hacia
 * el siguiente, y los extremos hasta el borde. El puntero no tiene que dar en la marca, solo estar más cerca de ella.
 */
export function hitEdges(xs: readonly number[]): Array<[number, number]> {
  return xs.map((x, i) => [i === 0 ? 0 : (xs[i - 1]! + x) / 2, i === xs.length - 1 ? 1 : (x + xs[i + 1]!) / 2]);
}

/** Índice de la zona que contiene `f` (fracción del eje), o el más cercano. */
export function indexAt(edges: ReadonlyArray<readonly [number, number]>, f: number): number {
  if (!edges.length) return -1;
  for (let i = 0; i < edges.length; i++) if (f < edges[i]![1]) return i;
  return edges.length - 1;
}

// —— Tiempo ——

export type TimeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TIME_STEPS: Array<[TimeUnit, number, number]> = [
  ["second", 1, SECOND],
  ["second", 5, 5 * SECOND],
  ["second", 15, 15 * SECOND],
  ["second", 30, 30 * SECOND],
  ["minute", 1, MINUTE],
  ["minute", 5, 5 * MINUTE],
  ["minute", 15, 15 * MINUTE],
  ["minute", 30, 30 * MINUTE],
  ["hour", 1, HOUR],
  ["hour", 3, 3 * HOUR],
  ["hour", 6, 6 * HOUR],
  ["hour", 12, 12 * HOUR],
  ["day", 1, DAY],
  ["day", 2, 2 * DAY],
  ["week", 1, 7 * DAY],
  ["month", 1, 30 * DAY],
  ["month", 3, 91 * DAY],
  ["month", 6, 182 * DAY],
  ["year", 1, 365 * DAY],
];

export interface TimeTicks {
  unit: TimeUnit;
  every: number;
  ticks: number[];
}

/**
 * Marcas de un eje temporal (milisegundos UTC): el intervalo de calendario más cercano a `count` divisiones (segundos,
 * minutos, horas, días, semanas que empiezan en lunes, meses, trimestres, semestres o años) alineado al calendario.
 */
export function timeTicks(t0: number, t1: number, count = 6): TimeTicks {
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  const target = (hi - lo) / Math.max(1, count);
  let pick = TIME_STEPS[TIME_STEPS.length - 1]!;
  for (const s of TIME_STEPS) {
    if (s[2] >= target) {
      pick = s;
      break;
    }
  }
  let [unit, every] = pick;
  if (unit === "year") {
    const years = (hi - lo) / (365 * DAY);
    every = Math.max(1, niceStep(years, Math.max(1, count)));
    every = Math.max(1, Math.round(every));
  }
  const ticks: number[] = [];
  let t = floorTime(lo, unit, every);
  if (t < lo) t = addTime(t, unit, every);
  for (let guard = 0; t <= hi && guard < 1000; guard++) {
    ticks.push(t);
    t = addTime(t, unit, every);
  }
  return { unit, every, ticks };
}

function floorTime(t: number, unit: TimeUnit, every: number): number {
  const d = new Date(t);
  if (unit === "second") return Math.floor(t / (every * SECOND)) * every * SECOND;
  if (unit === "minute") return Math.floor(t / (every * MINUTE)) * every * MINUTE;
  if (unit === "hour") return Math.floor(t / (every * HOUR)) * every * HOUR;
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (unit === "day") return day;
  if (unit === "week") return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;
  if (unit === "month") {
    const m = d.getUTCMonth();
    return Date.UTC(d.getUTCFullYear(), m - (m % every), 1);
  }
  const y = d.getUTCFullYear();
  return Date.UTC(y - (((y % every) + every) % every), 0, 1);
}

function addTime(t: number, unit: TimeUnit, every: number): number {
  if (unit === "second") return t + every * SECOND;
  if (unit === "minute") return t + every * MINUTE;
  if (unit === "hour") return t + every * HOUR;
  if (unit === "day") return t + every * DAY;
  if (unit === "week") return t + every * 7 * DAY;
  const d = new Date(t);
  if (unit === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + every, 1);
  return Date.UTC(d.getUTCFullYear() + every, 0, 1);
}

/** Opciones de `Intl.DateTimeFormat` para rotular las marcas de una unidad. */
export function timeTickFormat(unit: TimeUnit, every = 1): Intl.DateTimeFormatOptions {
  if (unit === "second") return { hour: "2-digit", minute: "2-digit", second: "2-digit" };
  if (unit === "minute" || unit === "hour") return { hour: "numeric", minute: "2-digit" };
  if (unit === "day" || unit === "week") return { month: "short", day: "numeric" };
  if (unit === "month") return every >= 12 ? { year: "numeric" } : { month: "short", year: "2-digit" };
  return { year: "numeric" };
}

/** Opciones para el rótulo completo de un punto (tooltip, tabla y nombre accesible). */
export function timePointFormat(unit: TimeUnit): Intl.DateTimeFormatOptions {
  if (unit === "second" || unit === "minute" || unit === "hour") return { dateStyle: "medium", timeStyle: "short" };
  if (unit === "month") return { month: "long", year: "numeric" };
  if (unit === "year") return { year: "numeric" };
  return { dateStyle: "medium" };
}

/** Milisegundos de un valor temporal: número, `Date` o cadena ISO (fecha civil o instante). `NaN` si no lo es. */
export function toTime(v: unknown): number {
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) {
    const iso = /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : v;
    return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
  }
  return Number.NaN;
}

/** Unidad de calendario que mejor describe la distancia típica entre puntos consecutivos (para rotularlos). */
export function timeGrain(times: readonly number[]): TimeUnit {
  if (times.length < 2) return "day";
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push(Math.abs(times[i]! - times[i - 1]!));
  gaps.sort((a, b) => a - b);
  const g = gaps[Math.floor(gaps.length / 2)]!;
  if (g < MINUTE) return "second";
  if (g < HOUR) return "minute";
  if (g < DAY) return "hour";
  if (g < 7 * DAY) return "day";
  if (g < 28 * DAY) return "week";
  if (g < 365 * DAY) return "month";
  return "year";
}

// —— Apilado ——

/**
 * Apilado de series (`matrix[serie][índice]`): cada valor se apoya en la suma de los anteriores de su mismo signo
 * (los positivos hacia arriba y los negativos hacia abajo, sin solaparse). Devuelve `[base, cima]` por serie e índice;
 * un valor ausente ocupa cero.
 */
export function stack(matrix: ReadonlyArray<ReadonlyArray<number | null | undefined>>): Array<Array<[number, number]>> {
  const n = Math.max(0, ...matrix.map((row) => row.length));
  const pos = new Array<number>(n).fill(0);
  const neg = new Array<number>(n).fill(0);
  return matrix.map((row) =>
    Array.from({ length: n }, (_, i) => {
      const v = row[i];
      const value = v === null || v === undefined || !Number.isFinite(v) ? 0 : v;
      if (value >= 0) {
        const base = pos[i]!;
        pos[i] = base + value;
        return [base, base + value] as [number, number];
      }
      const base = neg[i]!;
      neg[i] = base + value;
      return [base, base + value] as [number, number];
    }),
  );
}

// —— Sectores ——

export interface Arc {
  index: number;
  value: number;
  /** Fracción del total (0–1). */
  fraction: number;
  /** Ángulos en radianes, 0 arriba y en sentido horario. */
  start: number;
  end: number;
}

/**
 * Sectores de un anillo o tarta: los valores positivos repartidos en la vuelta completa desde arriba, en sentido
 * horario, con un hueco `pad` (radianes) entre sectores que no se come los sectores pequeños.
 */
export function pieLayout(values: readonly number[], pad = 0): Arc[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  const shown = clean.filter((v) => v > 0).length;
  const gap = shown > 1 ? Math.min(pad, (Math.PI * 2) / shown / 4) : 0;
  let at = 0;
  return clean.map((value, index) => {
    const fraction = total > 0 ? value / total : 0;
    const span = fraction * Math.PI * 2;
    const start = at;
    at += span;
    const g = value > 0 ? Math.min(gap, span / 2) : 0;
    return { index, value, fraction, start: start + g / 2, end: at - g / 2 };
  });
}

const pt = (cx: number, cy: number, r: number, a: number) => `${r3(cx + r * Math.sin(a))} ${r3(cy - r * Math.cos(a))}`;

/** Trazado SVG de un sector entre los radios `r0` (0 = tarta) y `r1`, de `a0` a `a1` (radianes, 0 arriba). */
export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const span = a1 - a0;
  if (!(span > 0)) return "";
  if (span >= Math.PI * 2 - 1e-6) {
    // Vuelta completa: dos medias vueltas (un arco SVG no puede empezar y acabar en el mismo punto).
    const outer = `M${pt(cx, cy, r1, 0)}A${r1} ${r1} 0 1 1 ${pt(cx, cy, r1, Math.PI)}A${r1} ${r1} 0 1 1 ${pt(cx, cy, r1, 0)}Z`;
    if (r0 <= 0) return outer;
    return `${outer}M${pt(cx, cy, r0, 0)}A${r0} ${r0} 0 1 0 ${pt(cx, cy, r0, Math.PI)}A${r0} ${r0} 0 1 0 ${pt(cx, cy, r0, 0)}Z`;
  }
  const large = span > Math.PI ? 1 : 0;
  const outer = `M${pt(cx, cy, r1, a0)}A${r1} ${r1} 0 ${large} 1 ${pt(cx, cy, r1, a1)}`;
  if (r0 <= 0) return `${outer}L${cx} ${cy}Z`;
  return `${outer}L${pt(cx, cy, r0, a1)}A${r0} ${r0} 0 ${large} 0 ${pt(cx, cy, r0, a0)}Z`;
}

/** Punto medio de un sector (para colocar la etiqueta o el tooltip), en las mismas unidades que el centro. */
export function arcCentroid(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): [number, number] {
  const a = (a0 + a1) / 2;
  const r = (r0 + r1) / 2;
  return [r3(cx + r * Math.sin(a)), r3(cy - r * Math.cos(a))];
}

// —— Trazados ——

export type Point = readonly [number, number] | null;
export type Curve = "linear" | "monotone" | "step";

/** Tramos sin huecos: un `null` corta la línea (un dato ausente no se inventa). */
export function segments(points: readonly Point[]): Array<Array<readonly [number, number]>> {
  const out: Array<Array<readonly [number, number]>> = [];
  let cur: Array<readonly [number, number]> = [];
  for (const p of points) {
    if (p === null || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Comandos SVG de un tramo (sin el `M` inicial) con la curva pedida. */
function run(pts: ReadonlyArray<readonly [number, number]>, curve: Curve): string {
  if (pts.length < 2) return "";
  if (curve === "step") {
    let d = "";
    for (let i = 1; i < pts.length; i++) {
      const mid = (pts[i - 1]![0] + pts[i]![0]) / 2;
      d += `H${r3(mid)}V${r3(pts[i]![1])}H${r3(pts[i]![0])}`;
    }
    return d;
  }
  if (curve === "linear" || pts.length < 3)
    return pts
      .slice(1)
      .map((p) => `L${r3(p[0])} ${r3(p[1])}`)
      .join("");
  // Monótona en x (Fritsch–Carlson / Steffen): no se sale del rango entre dos puntos, sin picos inventados.
  const n = pts.length;
  const dx = (i: number) => pts[i + 1]![0] - pts[i]![0];
  const slope = (i: number) => (dx(i) === 0 ? 0 : (pts[i + 1]![1] - pts[i]![1]) / dx(i));
  const m: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope(i - 1);
    const s1 = slope(i);
    if (s0 * s1 <= 0) m[i] = 0;
    else {
      const h0 = dx(i - 1);
      const h1 = dx(i);
      const p = (s0 * h1 + s1 * h0) / (h0 + h1);
      m[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
    }
  }
  m[0] = slope(0);
  m[n - 1] = slope(n - 2);
  let d = "";
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const h = (x1 - x0) / 3;
    d += `C${r3(x0 + h)} ${r3(y0 + m[i]! * h)} ${r3(x1 - h)} ${r3(y1 - m[i + 1]! * h)} ${r3(x1)} ${r3(y1)}`;
  }
  return d;
}

/** Trazado de una línea con huecos donde falta el dato. */
export function linePath(points: readonly Point[], curve: Curve = "linear"): string {
  return segments(points)
    .map((s) => (s.length === 1 ? `M${r3(s[0]![0])} ${r3(s[0]![1])}h0` : `M${r3(s[0]![0])} ${r3(s[0]![1])}${run(s, curve)}`))
    .join("");
}

/**
 * Trazado de un área entre la línea `top` y la base `bottom` (misma longitud; un `null` en cualquiera corta el área).
 * La base se recorre al revés para cerrar la figura.
 */
export function areaPath(top: readonly Point[], bottom: readonly Point[], curve: Curve = "linear"): string {
  const pairs: Array<[readonly [number, number], readonly [number, number]] | null> = top.map((t, i) => {
    const b = bottom[i];
    return t && b && Number.isFinite(t[1]) && Number.isFinite(b[1]) ? [t, b] : null;
  });
  const out: string[] = [];
  let cur: Array<[readonly [number, number], readonly [number, number]]> = [];
  const flush = () => {
    if (cur.length > 1) {
      const t = cur.map((p) => p[0]);
      const b = cur.map((p) => p[1]).reverse();
      out.push(`M${r3(t[0]![0])} ${r3(t[0]![1])}${run(t, curve)}L${r3(b[0]![0])} ${r3(b[0]![1])}${run(b, curve)}Z`);
    }
    cur = [];
  };
  for (const p of pairs) {
    if (p) cur.push(p);
    else flush();
  }
  flush();
  return out.join("");
}

// —— Formato ——

const numberFormats = new Map<string, Intl.NumberFormat>();
/** `Intl.NumberFormat` cacheado por locale y opciones (un locale no válido cae en el del entorno). */
export function numberFormat(locale: string | undefined, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`;
  let f = numberFormats.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat(undefined, options);
    }
    numberFormats.set(key, f);
  }
  return f;
}

/** Opciones del eje a partir de las del valor: notación compacta para cifras grandes, sin decimales de más. */
export function axisNumberOptions(options: Intl.NumberFormatOptions, max: number): Intl.NumberFormatOptions {
  if (options.notation || options.style === "percent") return options;
  return Math.abs(max) >= 10000 ? { ...options, notation: "compact", maximumFractionDigits: 1 } : options;
}

// —— Dispersión: regresión, radio de burbuja y punto más cercano ——

export interface Regression {
  slope: number;
  intercept: number;
  /** Coeficiente de determinación (0–1); 1 si todos los puntos caen en la recta. */
  r2: number;
}

/**
 * Recta de mínimos cuadrados de los pares finitos. `null` con menos de dos puntos o con todas las x iguales (la recta
 * sería vertical y no describe una tendencia de y frente a x).
 */
export function linearRegression(points: ReadonlyArray<readonly [number, number]>): Regression | null {
  const pts = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pts.length;
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (const [x, y] of pts) {
    mx += x;
    my += y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  // Varianza de x nula (o del orden del error de coma flotante frente a la magnitud de x).
  if (sxx <= 1e-12 * Math.max(1, mx * mx) * n) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : Math.min(1, Math.max(0, (sxy * sxy) / (sxx * syy)));
  return { slope, intercept, r2 };
}

/**
 * Radio de una burbuja con el área proporcional al valor (escala de raíz cuadrada): 0 → `min`, `max` → `rMax`.
 * Un valor negativo o no finito cuenta como 0.
 */
export function bubbleRadius(v: number, max: number, rMin = 4, rMax = 24): number {
  const f = Number.isFinite(v) && v > 0 && max > 0 ? Math.min(1, v / max) : 0;
  return r3(Math.max(rMin, rMax * Math.sqrt(f)));
}

/** Índice del punto más cercano a `p` (coordenadas en la misma unidad; `aspect` = ancho / alto del área). */
export function nearestPoint(points: ReadonlyArray<readonly [number, number]>, p: readonly [number, number], aspect = 1): number {
  let best = -1;
  let dist = Number.POSITIVE_INFINITY;
  points.forEach(([x, y], i) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const d = ((x - p[0]) * aspect) ** 2 + (y - p[1]) ** 2;
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

/**
 * Siguiente punto de una dispersión por teclado. `groups[s]` son los índices planos de la serie `s` en orden de x.
 * ←→ recorren la serie; ↑↓ cambian de serie al punto de x más cercana; Inicio/Fin, primero y último de la serie.
 */
export function scatterStep(
  groups: ReadonlyArray<readonly number[]>,
  xs: readonly number[],
  current: number,
  key: "next" | "prev" | "up" | "down" | "first" | "last",
): number {
  const s = groups.findIndex((g) => g.includes(current));
  if (s < 0) return groups.find((g) => g.length)?.[0] ?? current;
  const g = groups[s]!;
  const at = g.indexOf(current);
  if (key === "next") return g[Math.min(g.length - 1, at + 1)]!;
  if (key === "prev") return g[Math.max(0, at - 1)]!;
  if (key === "first") return g[0]!;
  if (key === "last") return g[g.length - 1]!;
  // Serie siguiente (o anterior) con puntos; si no la hay, se queda.
  const dir = key === "down" ? 1 : -1;
  for (let k = s + dir; k >= 0 && k < groups.length; k += dir) {
    const other = groups[k]!;
    if (!other.length) continue;
    const x = xs[current] ?? 0;
    let best = other[0]!;
    for (const i of other) if (Math.abs((xs[i] ?? 0) - x) < Math.abs((xs[best] ?? 0) - x)) best = i;
    return best;
  }
  return current;
}

// —— Radar ——

/** Punto del eje `i` de `n` (0 arriba, en sentido horario) a la fracción `f` del radio, en un viewBox de 100. */
export function polarPoint(i: number, n: number, f: number, radius = 40): [number, number] {
  const a = (Math.PI * 2 * i) / Math.max(1, n);
  const r = radius * Math.max(0, f);
  return [r3(50 + r * Math.sin(a)), r3(50 - r * Math.cos(a))];
}

/** Polígono cerrado de un radar (una fracción por eje; `null` cuenta como el centro). */
export function radarPath(fractions: ReadonlyArray<number | null>, radius = 40): string {
  const n = fractions.length;
  if (!n) return "";
  return `${fractions
    .map((f, i) => {
      const [x, y] = polarPoint(i, n, f ?? 0, radius);
      return `${i ? "L" : "M"}${x} ${y}`;
    })
    .join("")}Z`;
}

/** Cuña de la zona activa del eje `i` (de la mitad hacia el anterior a la mitad hacia el siguiente). */
export function radarWedge(i: number, n: number, radius = 48): string {
  const step = (Math.PI * 2) / Math.max(1, n);
  if (n === 1) return arcPath(50, 50, 0, radius, 0, Math.PI * 2);
  return arcPath(50, 50, 0, radius, i * step - step / 2, i * step + step / 2);
}

// —— Mapa de calor ——

/** Nivel 0…`levels − 1` de un valor en una escala secuencial [lo, hi] (cuantiles iguales). */
export function sequentialLevel(v: number, lo: number, hi: number, levels = 5): number {
  if (!Number.isFinite(v)) return 0;
  if (!(hi > lo)) return v > lo ? levels - 1 : 0;
  const f = (v - lo) / (hi - lo);
  return Math.max(0, Math.min(levels - 1, Math.floor(f * levels)));
}

/**
 * Nivel −`steps`…`steps` de un valor en una escala divergente alrededor de `mid`: 0 en el punto medio, negativos por
 * debajo y positivos por encima, cada lado repartido en `steps` tramos hasta su extremo.
 */
export function divergingLevel(v: number, lo: number, mid: number, hi: number, steps = 4): number {
  if (!Number.isFinite(v) || v === mid) return 0;
  if (v > mid) {
    const span = hi - mid;
    return span > 0 ? Math.max(1, Math.min(steps, Math.ceil(((v - mid) / span) * steps))) : steps;
  }
  const span = mid - lo;
  return span > 0 ? -Math.max(1, Math.min(steps, Math.ceil(((mid - v) / span) * steps))) : -steps;
}

/** Umbrales de una escala secuencial: el inicio de cada nivel (para la leyenda). */
export function sequentialThresholds(lo: number, hi: number, levels = 5): number[] {
  return Array.from({ length: levels }, (_, i) => lo + ((hi - lo) * i) / levels);
}

/** Celda siguiente de una rejilla (`rows` × `cols`, índice plano por filas) con las teclas de APG para `grid`. */
export function gridStep(
  index: number,
  rows: number,
  cols: number,
  key: "right" | "left" | "down" | "up" | "rowStart" | "rowEnd" | "first" | "last" | "pageDown" | "pageUp",
  page = 5,
): number {
  if (rows <= 0 || cols <= 0) return 0;
  const r = Math.floor(index / cols);
  const c = index % cols;
  const at = (rr: number, cc: number) => Math.max(0, Math.min(rows - 1, rr)) * cols + Math.max(0, Math.min(cols - 1, cc));
  if (key === "right") return at(r, c + 1);
  if (key === "left") return at(r, c - 1);
  if (key === "down") return at(r + 1, c);
  if (key === "up") return at(r - 1, c);
  if (key === "rowStart") return at(r, 0);
  if (key === "rowEnd") return at(r, cols - 1);
  if (key === "first") return 0;
  if (key === "last") return rows * cols - 1;
  if (key === "pageDown") return at(r + page, c);
  return at(r - page, c);
}

// —— Barra por categorías ——

export interface Segment {
  index: number;
  value: number;
  /** Inicio y fin (fracción de la barra). */
  start: number;
  end: number;
  /** Valor acumulado al final del tramo. */
  cumulative: number;
}

/** Tramos de una barra segmentada: los valores positivos uno detrás de otro sobre su suma. */
export function segmentLayout(values: readonly number[]): { segments: Segment[]; total: number } {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  let acc = 0;
  const segments = clean.map((value, index) => {
    const start = total > 0 ? acc / total : 0;
    acc += value;
    return { index, value, start, end: total > 0 ? acc / total : 0, cumulative: acc };
  });
  return { segments, total };
}

// —— Animación de números ——

/** Curva de salida cúbica: rápida al empezar, suave al llegar. */
export const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Decimales con los que está escrito un número (hasta 20): 12.5 → 1, 3 → 0. */
export function decimalsOf(v: number): number {
  if (!Number.isFinite(v) || Number.isInteger(v)) return 0;
  const s = String(v);
  const e = /e-(\d+)$/.exec(s);
  if (e) return Math.min(20, Number(e[1]) + (s.split("e")[0]!.split(".")[1]?.length ?? 0));
  return Math.min(20, s.split(".")[1]?.length ?? 0);
}

/**
 * Valor intermedio de `from` a `to` en el instante `t` (0–1) de la curva, redondeado a `decimals` para que las cifras
 * no tiemblen (un entero no pasa por 12,3456). En `t = 1` es exactamente `to`.
 */
export function tweenValue(from: number, to: number, t: number, decimals: number, ease = easeOutCubic): number {
  if (t >= 1 || !Number.isFinite(from)) return to;
  const v = from + (to - from) * ease(t);
  const p = 10 ** Math.max(0, Math.min(20, decimals));
  return Math.round(v * p) / p;
}
