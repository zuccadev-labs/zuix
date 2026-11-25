// Medida de contraste de una marca en el navegador: la misma que `pnpm tokens` (tokens/src/validate.mjs y
// tokens/src/color.mjs), sobre los mismos datos, que el catálogo copia de tokens (superficies, texto, pares, no texto
// y los usos reales de las hojas). Lee hex, rgb(), color-mix() en sRGB y palabras clave; compone las capas
// translúcidas sobre el fondo de aplicación y los extremos de su degradado. Pura.

import type { BrandFile, CatalogTokens } from "./types";

/** [r, g, b, a] con r, g, b en 0–255 y a en 0–1. */
export type Rgba = [number, number, number, number];

const NAMED: Record<string, Rgba> = { transparent: [0, 0, 0, 0], white: [255, 255, 255, 1], black: [0, 0, 0, 1] };

/** Parte `text` por las comas de primer nivel (fuera de paréntesis). */
export function splitTop(text: string, separator = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim());
}

const channel = (v: string) => (v.endsWith("%") ? (Number.parseFloat(v) / 100) * 255 : Number.parseFloat(v));
const alphaOf = (v: string | undefined) => (v === undefined ? 1 : v.endsWith("%") ? Number.parseFloat(v) / 100 : Number.parseFloat(v));

/** Color de un valor CSS, o `null` si no es un color que esta medida sepa leer (o lleva un número no finito). */
export function parseCssColor(value: string): Rgba | null {
  const c = read(value);
  return c?.every(Number.isFinite) ? c : null;
}

function read(value: string): Rgba | null {
  const v = String(value).trim().toLowerCase();
  if (Object.hasOwn(NAMED, v)) return [...(NAMED[v] as Rgba)];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m?.[1] && [3, 4, 6, 8].includes(m[1].length)) {
    const hex = m[1].length <= 4 ? [...m[1]].map((c) => c + c).join("") : m[1];
    const n = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), hex.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\((.*)\)$/.exec(v);
  if (m?.[1] !== undefined) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean);
    if (p.length < 3 || p.some((x) => Number.isNaN(Number.parseFloat(x)))) return null;
    return [channel(p[0] as string), channel(p[1] as string), channel(p[2] as string), alphaOf(p[3])];
  }
  m = /^color-mix\((.*)\)$/.exec(v);
  if (m?.[1] !== undefined) {
    const [space, a, b] = splitTop(m[1]);
    if (!/^in\s+srgb$/.test(space ?? "") || a === undefined || b === undefined) return null;
    const side = (text: string) => {
      const pct = /\s(-?[\d.]+)%$/.exec(text);
      return { color: read(pct ? text.slice(0, pct.index) : text), pct: pct ? Number.parseFloat(pct[1] as string) : null };
    };
    const [x, y] = [side(a), side(b)];
    if (!x.color || !y.color) return null;
    let [p1, p2] = [x.pct, y.pct];
    if (p1 === null && p2 === null) p1 = p2 = 50;
    else if (p1 === null) p1 = 100 - (p2 as number);
    else if (p2 === null) p2 = 100 - p1;
    const sum = (p1 as number) + (p2 as number);
    if (sum <= 0) return null;
    const scale = sum < 100 ? sum / 100 : 1;
    const [q1, q2] = [(p1 as number) / sum, (p2 as number) / sum];
    const xc = x.color;
    const yc = y.color;
    const a2 = xc[3] * q1 + yc[3] * q2;
    const mix = (i: number) => (a2 === 0 ? 0 : ((xc[i] as number) * xc[3] * q1 + (yc[i] as number) * yc[3] * q2) / a2);
    return [mix(0), mix(1), mix(2), a2 * scale];
  }
  return null;
}

/** `top` pintado sobre `bottom`. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3] + bottom[3] * (1 - top[3]);
  if (a === 0) return [0, 0, 0, 0];
  const c = (i: number) => ((top[i] as number) * top[3] + (bottom[i] as number) * bottom[3] * (1 - top[3])) / a;
  return [c(0), c(1), c(2), a];
}

const flatten = (layers: Rgba[]) => layers.reduce((acc, layer) => over(layer, acc));

function lum(c: Rgba): number {
  const f = (x: number) => {
    const s = x / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

/** Razón de contraste WCAG 2.x entre dos colores opacos. */
export function ratio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Colores opacos posibles del fondo de aplicación: el plano y los extremos del degradado. */
function canvasCandidates(flat: Rgba | null, gradient: string | null): Rgba[] {
  const out: Rgba[] = flat ? [flat] : [];
  const layers = gradient ? splitTop(gradient) : [];
  const stops = (layer: string) =>
    splitTop(layer.replace(/^[a-z-]+\(/, "").replace(/\)$/, ""))
      .map((s) => parseCssColor(s.replace(/\s+-?[\d.]+%$/, "")))
      .filter((c): c is Rgba => c !== null);
  const linear = layers
    .filter((l) => l.startsWith("linear-gradient("))
    .flatMap(stops)
    .filter((c) => c[3] === 1);
  const spots = layers
    .filter((l) => l.startsWith("radial-gradient("))
    .flatMap(stops)
    .filter((c) => c[3] > 0);
  const bases = linear.length ? linear : [...out];
  out.push(...linear);
  for (const base of bases) for (const spot of spots) out.push(over(spot, base));
  return out;
}

/** Valor sin resolver de un token de una marca y tema, con la precedencia de la cascada de tokens.css. */
function raw(name: string, brand: BrandFile, theme: "dark" | "light", base: CatalogTokens["base"]): string | undefined {
  if (/^font-(display|sans|mono)$/.test(name))
    return name === "font-display" ? (brand.fonts.display ?? brand.fonts.sans) : brand.fonts[name.slice(5) as "sans" | "mono"];
  return (
    brand.themes[theme][name] ??
    base.semantic[name] ??
    brand.component?.[name] ??
    base.component[name] ??
    brand.scale?.[name] ??
    base.scale[name]
  );
}

/** Valor de un token con sus referencias (`{accent}`, `{p.red-500}`) sustituidas, o `null`. Lanza con un ciclo. */
export function expandToken(
  name: string,
  brand: BrandFile,
  theme: "dark" | "light",
  base: CatalogTokens["base"],
  trail: string[] = [],
): string | null {
  const value = raw(name, brand, theme, base);
  if (value == null) return null;
  if (trail.includes(name)) throw new Error(`referencia circular: ${[...trail, name].join(" → ")}`);
  return String(value).replace(/\{([a-z0-9.-]+)\}/gi, (all, ref: string) =>
    ref.startsWith("p.") ? (brand.primitives[ref.slice(2)] ?? all) : (expandToken(ref, brand, theme, base, [...trail, name]) ?? all),
  );
}

export interface ContrastFailure {
  theme: "dark" | "light";
  what: string;
  ratio: number;
  min: number;
  key?: string;
}

export interface ContrastReport {
  checked: number;
  failures: ContrastFailure[];
  /** Fallos que ya están anotados como pendientes en tokens (no invalidan la marca). */
  pending: ContrastFailure[];
  ok: boolean;
  /** Cada medida, si se pidió con `{ rows: true }`. */
  rows?: ContrastFailure[];
}

/** Mide una marca en sus dos temas con las reglas de `pnpm tokens`. Un token que no es color lanza un error legible. */
export function checkContrast(brand: BrandFile, tokens: CatalogTokens, o: { rows?: boolean } = {}): ContrastReport {
  const spec = tokens.contrast;
  const failures: ContrastFailure[] = [];
  const rows: ContrastFailure[] = [];
  let checked = 0;
  for (const theme of ["dark", "light"] as const) {
    const color = (name: string) => {
      const v = expandToken(name, brand, theme, tokens.base);
      return v == null ? null : parseCssColor(v);
    };
    const need = (name: string) => {
      const c = color(name);
      if (!c)
        throw new Error(`${brand.name}/${theme}: «${name}» no se resuelve a un color (${expandToken(name, brand, theme, tokens.base)})`);
      return c;
    };
    const canvas = canvasCandidates(need("canvas"), expandToken("canvas-gradient", brand, theme, tokens.base));
    const surfaces: Record<string, Rgba[]> = {};
    for (const [name, s] of Object.entries(spec.surfaces)) {
      const bottoms: (Rgba | null)[] = s.over === "canvas" ? canvas : [null];
      surfaces[name] = bottoms.map((b) => flatten([...(b ? [b] : []), ...s.layers.map(need)]));
    }
    const all = Object.values(surfaces).flat();
    const worst = (fg: Rgba, own: Rgba | null, backs: Rgba[]) => {
      let min = Number.POSITIVE_INFINITY;
      for (const back of backs) {
        const bg = own ? over(own, back) : back;
        min = Math.min(min, ratio(over(fg, bg), bg));
      }
      return min;
    };
    const check = (what: string, r: number, min: number, key?: string) => {
      checked += 1;
      const row = { theme, what, ratio: Math.round(r * 100) / 100, min, ...(key ? { key } : {}) };
      if (o.rows) rows.push(row);
      if (r < min) failures.push(row);
    };
    for (const token of spec.text)
      for (const [name, backs] of Object.entries(surfaces)) check(`${token} sobre ${name}`, worst(need(token), null, backs), 4.5);
    for (const token of spec.canvasText) check(`${token} sobre canvas`, worst(need(token), null, canvas), 4.5);
    for (const pair of spec.pairs) {
      const bg = need(pair.bg);
      const backs = bg[3] < 1 ? all : [bg];
      check(`${pair.fg} sobre ${pair.bg}`, worst(need(pair.fg), bg[3] < 1 ? bg : null, backs), pair.min);
    }
    for (const u of spec.uses) {
      const fg = color(u.fg);
      const own = u.bg ? color(u.bg) : null;
      if (!fg || (u.bg && !own)) continue;
      const onCanvas = spec.canvasText.includes(u.fg);
      const backs = own && own[3] === 1 ? [own] : onCanvas ? canvas : all;
      check(`${u.fg} sobre ${u.bg ?? "la superficie"} · ${u.where}`, worst(fg, own && own[3] < 1 ? own : null, backs), u.min, u.key);
    }
    for (const token of spec.nonText) check(`${token} (no texto) frente a la superficie`, worst(need(token), null, all), 3);
    for (const b of spec.borders) check(`${b.token} (borde) · ${b.where}`, worst(need(b.token), null, all), 3, b.key);
  }
  const pendingKeys = new Set(spec.pending);
  const pending = failures.filter((f) => f.key && pendingKeys.has(f.key));
  const broken = failures.filter((f) => !(f.key && pendingKeys.has(f.key)));
  return { checked, failures: broken, pending, ok: broken.length === 0, ...(o.rows ? { rows } : {}) };
}
