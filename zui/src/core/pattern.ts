// Motor de patrones de portada (Backdrop, FeatureCard y lo que pinte un fondo geométrico). Sin DOM ni efectos al
// importar: lo comparten React, el modo sin framework y la generación del contrato HTML.
//
// Contrato:
// - Un patrón es una tesela SVG que se usa como máscara (`mask-image`): solo cuenta su opacidad. El color lo pone la
//   hoja con tokens (`--z-pattern-color`), así que la misma tesela sirve en las tres marcas y en los dos temas.
// - La tesela es determinista: la misma `seed` da siempre el mismo dibujo (sin Math.random), en el servidor y en el
//   navegador. Las teselas son periódicas: se repiten sin costura.
// - Todo lo que se puede animar es una propiedad personalizada de la capa: `--z-pattern-x`, `--z-pattern-y` (desplazamiento),
//   `--z-pattern-rotate`, `--z-pattern-scale`, `--z-pattern-k` (intensidad) y `--z-pattern-size` (lado de la tesela).
//   La hoja las registra con @property, así que una animación de CSS o de Web Animations las interpola sin tocar el
//   marcado.
// - La malla no usa tesela: la semilla coloca cuatro manchas (`--z-mesh-x1…4`, `--z-mesh-y1…4`) y elige su color de
//   la paleta de gráficos (`--z-mesh-c1…4`, referencias a tokens).

export type PatternName = "grid" | "dots" | "hex" | "mesh" | "stars" | "triangles" | "plus" | "pixels" | "contours" | "grain" | "halftone";

/** Patrones con tesela generada por semilla. */
export const SEEDED_PATTERNS = ["stars", "triangles", "plus", "pixels", "contours", "grain", "halftone"] as const;
export type SeededPattern = (typeof SEEDED_PATTERNS)[number];

/** Lado por defecto de la tesela en px de cada patrón con semilla. */
export const PATTERN_TILE: Record<SeededPattern, number> = {
  stars: 180,
  triangles: 200,
  plus: 160,
  pixels: 192,
  contours: 240,
  grain: 160,
  halftone: 192,
};

/** Semilla numérica de 32 bits a partir de un número o un texto (FNV-1a). */
export function seedOf(seed: number | string | undefined): number {
  if (seed === undefined) return 1;
  if (typeof seed === "number" && Number.isFinite(seed)) return Math.abs(Math.floor(seed)) >>> 0 || 1;
  let h = 0x811c9dc5;
  for (const ch of String(seed)) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0 || 1;
}

/** Generador pseudoaleatorio determinista (mulberry32) en [0, 1). */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Copia un elemento en las 8 teselas vecinas si toca un borde: la repetición no corta la figura. */
function wrap(x: number, y: number, reach: number, size: number, draw: (x: number, y: number) => string): string {
  let out = "";
  for (const dx of [-size, 0, size])
    for (const dy of [-size, 0, size]) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx + reach < 0 || cy + reach < 0 || cx - reach > size || cy - reach > size) continue;
      out += draw(cx, cy);
    }
  return out;
}

/** Campo suave y periódico en [0, 1] sobre una tesela de lado `size`: suma de ondas con frecuencias enteras. */
function field(rand: () => number, size: number): (x: number, y: number) => number {
  const waves = Array.from({ length: 4 }, () => ({
    fx: 1 + Math.floor(rand() * 2),
    fy: 1 + Math.floor(rand() * 2),
    px: rand() * Math.PI * 2,
    py: rand() * Math.PI * 2,
    w: 0.5 + rand(),
  }));
  const total = waves.reduce((s, w) => s + w.w, 0);
  const k = (Math.PI * 2) / size;
  return (x, y) => {
    let v = 0;
    for (const w of waves) v += w.w * Math.sin(x * k * w.fx + w.px) * Math.cos(y * k * w.fy + w.py);
    return 0.5 + v / (2 * total);
  };
}

function stars(rand: () => number, s: number): string {
  let out = "";
  const n = Math.round((s * s) / 900);
  for (let i = 0; i < n; i++) {
    const x = r1(rand() * s);
    const y = r1(rand() * s);
    const big = rand() > 0.93;
    const r = big ? 1.4 + rand() * 0.6 : 0.35 + rand() * 0.75;
    const o = r2(big ? 0.95 : 0.25 + rand() * 0.6);
    out += wrap(x, y, 4, s, (cx, cy) =>
      big
        ? `<path d='M${r1(cx)} ${r1(cy - r * 2.6)}L${r1(cx + r * 0.5)} ${r1(cy - r * 0.5)}L${r1(cx + r * 2.6)} ${r1(cy)}L${r1(cx + r * 0.5)} ${r1(cy + r * 0.5)}L${r1(cx)} ${r1(cy + r * 2.6)}L${r1(cx - r * 0.5)} ${r1(cy + r * 0.5)}L${r1(cx - r * 2.6)} ${r1(cy)}L${r1(cx - r * 0.5)} ${r1(cy - r * 0.5)}Z' fill-opacity='${o}'/>`
        : `<circle cx='${r1(cx)}' cy='${r1(cy)}' r='${r2(r)}' fill-opacity='${o}'/>`,
    );
  }
  return out;
}

function triangles(rand: () => number, s: number): string {
  let out = "";
  const n = Math.round((s * s) / 2400);
  for (let i = 0; i < n; i++) {
    const x = rand() * s;
    const y = rand() * s;
    const a = 4 + rand() * 7;
    const h = a * 0.866;
    const o = r2(0.3 + rand() * 0.7);
    out += wrap(
      x,
      y,
      a,
      s,
      (cx, cy) =>
        `<path d='M${r1(cx)} ${r1(cy - h / 1.5)}L${r1(cx + a / 2)} ${r1(cy + h / 3)}L${r1(cx - a / 2)} ${r1(cy + h / 3)}Z' fill-opacity='${o}'/>`,
    );
  }
  return out;
}

function plus(rand: () => number, s: number): string {
  let out = "";
  const step = s / 6;
  for (let gx = 0; gx < 6; gx++)
    for (let gy = 0; gy < 6; gy++) {
      if (rand() < 0.42) continue;
      const x = r1(gx * step + step / 2 + (rand() - 0.5) * step * 0.5);
      const y = r1(gy * step + step / 2 + (rand() - 0.5) * step * 0.5);
      const a = r1(3 + rand() * 6);
      const w = r1(Math.max(1.2, a / 3.2));
      const o = r2(0.35 + rand() * 0.65);
      out += wrap(
        x,
        y,
        a,
        s,
        (cx, cy) =>
          `<path d='M${r1(cx - a)} ${r1(cy - w / 2)}h${r1(a * 2)}v${w}h${r1(-a * 2)}ZM${r1(cx - w / 2)} ${r1(cy - a)}h${w}v${r1(a * 2)}h${-w}Z' fill-opacity='${o}'/>`,
      );
    }
  return out;
}

function pixels(rand: () => number, s: number): string {
  let out = "";
  const n = 8;
  const c = s / n;
  const f = field(rand, s);
  for (let gx = 0; gx < n; gx++)
    for (let gy = 0; gy < n; gy++) {
      const v = f(gx * c + c / 2, gy * c + c / 2);
      if (v < 0.52 || rand() < 0.35) continue;
      const o = r2(Math.min(1, 0.18 + (v - 0.52) * 2.2 + rand() * 0.2));
      const span = rand() > 0.85 ? 2 : 1;
      out += `<rect x='${r1(gx * c)}' y='${r1(gy * c)}' width='${r1(c * span)}' height='${r1(c)}' fill-opacity='${o}'/>`;
    }
  return out;
}

/** Curvas de nivel (marching squares) de un campo periódico: líneas de mapa que se repiten sin costura. */
function contours(rand: () => number, s: number): string {
  const n = 24;
  const c = s / n;
  const f = field(rand, s);
  const levels = [0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82];
  const v: number[][] = [];
  for (let i = 0; i <= n; i++) {
    v.push([]);
    for (let j = 0; j <= n; j++) v[i]!.push(f(i * c, j * c));
  }
  let d = "";
  for (const level of levels) {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const a = v[i]![j]!,
          b = v[i + 1]![j]!,
          cc = v[i + 1]![j + 1]!,
          dd = v[i]![j + 1]!;
        const x = i * c,
          y = j * c;
        const lerp = (p: number, q: number) => (level - p) / (q - p);
        const pts: [number, number][] = [];
        if (a < level !== b < level) pts.push([x + c * lerp(a, b), y]);
        if (b < level !== cc < level) pts.push([x + c, y + c * lerp(b, cc)]);
        if (dd < level !== cc < level) pts.push([x + c * lerp(dd, cc), y + c]);
        if (a < level !== dd < level) pts.push([x, y + c * lerp(a, dd)]);
        for (let k = 0; k + 1 < pts.length; k += 2)
          d += `M${Math.round(pts[k]![0])} ${Math.round(pts[k]![1])}L${Math.round(pts[k + 1]![0])} ${Math.round(pts[k + 1]![1])}`;
      }
  }
  return `<path d='${d}' fill='none' stroke='black' stroke-width='1' stroke-linecap='round'/>`;
}

function halftone(rand: () => number, s: number): string {
  let out = "";
  const n = 12;
  const c = s / n;
  const f = field(rand, s);
  for (let gx = 0; gx < n; gx++)
    for (let gy = 0; gy < n; gy++) {
      const x = gx * c + (gy % 2 ? c / 2 : 0);
      const y = gy * c + c / 2;
      const v = f(x, y);
      const r = r2(Math.max(0, (v - 0.28) * c * 0.78));
      if (r < 0.4) continue;
      out += wrap(x, y, r, s, (cx, cy) => `<circle cx='${r1(cx)}' cy='${r1(cy)}' r='${r}'/>`);
    }
  return out;
}

/** Grano: ruido fractal de feTurbulence con su semilla, llevado al canal alfa (la máscara solo lee la opacidad). */
function grain(seed: number, s: number): string {
  return `<filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' seed='${seed % 10000}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.4 -0.35'/></filter><rect width='${s}' height='${s}' filter='url(%23n)'/>`;
}

/** Tesela SVG de un patrón con semilla (marcado del elemento `svg`). */
export function patternSvg(pattern: SeededPattern, seed: number | string = 1, size: number = PATTERN_TILE[pattern]): string {
  const n = seedOf(seed);
  const rand = random(n);
  const s = Math.max(16, Math.round(size));
  const body =
    pattern === "stars"
      ? stars(rand, s)
      : pattern === "triangles"
        ? triangles(rand, s)
        : pattern === "plus"
          ? plus(rand, s)
          : pattern === "pixels"
            ? pixels(rand, s)
            : pattern === "contours"
              ? contours(rand, s)
              : pattern === "halftone"
                ? halftone(rand, s)
                : grain(n, s);
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}' viewBox='0 0 ${s} ${s}'>${body}</svg>`;
}

/** La tesela como valor CSS `url("data:…")`, listo para `mask-image`. */
export function patternUrl(pattern: SeededPattern, seed?: number | string, size?: number): string {
  const svg = patternSvg(pattern, seed, size).replace(
    /[<>#"%{}\n]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
  // El `%23` del filtro ya va escapado: no se escapa dos veces.
  return `url("data:image/svg+xml,${svg.replace(/%2523/g, "%23")}")`;
}

/** Colores de la paleta de gráficos que la malla reparte entre sus manchas. */
const MESH_COLORS = ["accent", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-7", "info"] as const;

/** Posiciones y colores de las cuatro manchas de la malla para una semilla. */
export function meshVars(seed: number | string | undefined): Record<string, string> {
  const rand = random(seedOf(seed));
  const out: Record<string, string> = {};
  const picked: string[] = [];
  for (let i = 1; i <= 4; i++) {
    out[`--z-mesh-x${i}`] = `${Math.round(8 + rand() * 84)}%`;
    out[`--z-mesh-y${i}`] = `${Math.round(6 + rand() * 88)}%`;
    let color: string;
    do color = MESH_COLORS[Math.floor(rand() * MESH_COLORS.length)]!;
    while (picked.includes(color) && picked.length < MESH_COLORS.length);
    picked.push(color);
    out[`--z-mesh-c${i}`] = `var(--z-${color})`;
  }
  return out;
}

/**
 * Propiedades personalizadas de un patrón para una semilla: la tesela (`--z-pattern-tile`) y su lado
 * (`--z-pattern-size`), o las manchas de la malla. Sin semilla, devuelve `{}`: la hoja trae una tesela por defecto.
 */
export function patternVars(pattern: PatternName, seed?: number | string, size?: number): Record<string, string> {
  if (seed === undefined && size === undefined) return {};
  if (pattern === "mesh") return meshVars(seed);
  if (!(SEEDED_PATTERNS as readonly string[]).includes(pattern)) return {};
  const p = pattern as SeededPattern;
  const s = size ?? PATTERN_TILE[p];
  return { "--z-pattern-tile": patternUrl(p, seed, s), "--z-pattern-size": `${Math.round(s)}px` };
}
