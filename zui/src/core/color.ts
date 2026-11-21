// Color de la aplicación (el valor de ColorPicker, no la apariencia de la suite): lectura de cadenas CSS, conversiones
// entre sRGB, HSV, HSL y OKLCH, y escritura con redondeos estables (escribir, leer y volver a escribir da la misma
// cadena). Sin documento ni dependencias. OKLab según Björn Ottosson (2020), sobre sRGB lineal; lo que cae fuera de
// sRGB al leer `oklch()` se lleva dentro reduciendo el croma (CSS Color 4, «gamut mapping»), no recortando el tono.

/** sRGB con canales de 0 a 255 (con decimales) y alfa de 0 a 1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}
/** Tono en grados (0–360), saturación y brillo de 0 a 1. Es el modelo del área y del deslizador de tono. */
export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}
export interface Hsla {
  h: number;
  s: number;
  l: number;
  a: number;
}
/** Luminosidad de 0 a 1, croma (0 a ~0,37 en sRGB) y tono en grados. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  a: number;
}

export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch";
export const COLOR_FORMATS: readonly ColorFormat[] = ["hex", "rgb", "hsl", "oklch"];
export const isColorFormat = (v: unknown): v is ColorFormat => typeof v === "string" && (COLOR_FORMATS as readonly string[]).includes(v);

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Redondeo a `d` decimales sin `-0` ni ruido de coma flotante. */
export const round = (n: number, d = 0) => {
  const f = 10 ** d;
  const out = Math.round((n + Number.EPSILON * Math.sign(n)) * f) / f;
  return Object.is(out, -0) ? 0 : out;
};
/** Tono en [0, 360). */
export const wrapHue = (h: number) => (Number.isFinite(h) ? ((h % 360) + 360) % 360 : 0);
const trim = (n: number, d: number) => String(round(n, d));

/* ---------- sRGB ↔ HSV / HSL ---------- */

export function hsvToRgb({ h, s, v, a }: Hsva): Rgba {
  const hh = wrapHue(h) / 60;
  const ss = clamp(s, 0, 1);
  const vv = clamp(v, 0, 1);
  const f = (n: number) => {
    const k = (n + hh) % 6;
    return 255 * (vv - vv * ss * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return { r: f(5), g: f(3), b: f(1), a: clamp(a, 0, 1) };
}

/** HSV de un color. Sin croma (gris) el tono no existe: se conserva `hue` (el anterior del área) o 0. */
export function rgbToHsv({ r, g, b, a }: Rgba, hue = 0): Hsva {
  const rr = clamp(r, 0, 255) / 255;
  const gg = clamp(g, 0, 255) / 255;
  const bb = clamp(b, 0, 255) / 255;
  const max = Math.max(rr, gg, bb);
  const d = max - Math.min(rr, gg, bb);
  return { h: d < 1e-9 ? wrapHue(hue) : hueOf(rr, gg, bb, max, d), s: max === 0 ? 0 : d / max, v: max, a: clamp(a, 0, 1) };
}

function hueOf(r: number, g: number, b: number, max: number, d: number): number {
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return wrapHue(h * 60);
}

export function rgbToHsl({ r, g, b, a }: Rgba): Hsla {
  const rr = clamp(r, 0, 255) / 255;
  const gg = clamp(g, 0, 255) / 255;
  const bb = clamp(b, 0, 255) / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d < 1e-9 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: d < 1e-9 ? 0 : hueOf(rr, gg, bb, max, d), s: clamp(s, 0, 1), l, a: clamp(a, 0, 1) };
}

export function hslToRgb({ h, s, l, a }: Hsla): Rgba {
  const ss = clamp(s, 0, 1);
  const ll = clamp(l, 0, 1);
  const k = (n: number) => (n + wrapHue(h) / 30) % 12;
  const m = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => 255 * (ll - m * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return { r: f(0), g: f(8), b: f(4), a: clamp(a, 0, 1) };
}

/* ---------- sRGB ↔ OKLab / OKLCH ---------- */

const toLinear = (c: number) => {
  const x = c / 255;
  const abs = Math.abs(x);
  return abs <= 0.04045 ? x / 12.92 : Math.sign(x) * ((abs + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (x: number) => {
  const abs = Math.abs(x);
  return 255 * (abs <= 0.0031308 ? 12.92 * x : Math.sign(x) * (1.055 * abs ** (1 / 2.4) - 0.055));
};

/** OKLab de un sRGB (los canales pueden salirse de 0–255: se convierte tal cual). */
export function rgbToOklab({ r, g, b }: Rgba): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** sRGB de un OKLab, sin llevarlo a la gama: puede dar canales fuera de 0–255. */
export function oklabToRgb(L: number, A: number, B: number, alpha = 1): Rgba {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
}

export function rgbToOklch(rgb: Rgba): Oklch {
  const [l, a, b] = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  return { l, c, h: c < 1e-7 ? 0 : wrapHue((Math.atan2(b, a) * 180) / Math.PI), a: rgb.a };
}

/** Margen de la gama: lo que sobra por redondeo (menos de medio paso de 8 bits) no se corrige. */
const GAMUT_EPSILON = 0.5 / 255;
export const inGamut = ({ r, g, b }: Rgba, epsilon = GAMUT_EPSILON * 255) => [r, g, b].every((c) => c >= -epsilon && c <= 255 + epsilon);

/**
 * sRGB de un OKLCH. Lo que no cabe en sRGB se lleva dentro conservando luminosidad y tono y bajando el croma
 * (búsqueda binaria, como el «gamut mapping» de CSS Color 4 sin el ajuste de diferencia apenas perceptible).
 */
export function oklchToRgb({ l, c, h, a }: Oklch): Rgba {
  const L = clamp(l, 0, 1);
  const hr = (wrapHue(h) * Math.PI) / 180;
  const at = (chroma: number) => oklabToRgb(L, chroma * Math.cos(hr), chroma * Math.sin(hr), clamp(a, 0, 1));
  const full = at(Math.max(0, c));
  if (L >= 1) return { r: 255, g: 255, b: 255, a: full.a };
  if (L <= 0) return { r: 0, g: 0, b: 0, a: full.a };
  if (inGamut(full)) return full;
  let lo = 0;
  let hi = Math.max(0, c);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(at(mid))) lo = mid;
    else hi = mid;
  }
  return clampRgb(at(lo));
}

export const clampRgb = ({ r, g, b, a }: Rgba): Rgba => ({
  r: clamp(r, 0, 255),
  g: clamp(g, 0, 255),
  b: clamp(b, 0, 255),
  a: clamp(a, 0, 1),
});

/* ---------- Lectura ---------- */

const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// Nombre de la función y su contenido: `rgb`, `rgba`, `hsl`, `hsla`, `hwb` u `oklch`.
const FN_RE = /^([a-z]+)\s*\((.*)\)$/i;

function parseHex(text: string): Rgba | null {
  const m = HEX_RE.exec(text);
  if (!m) return null;
  let hex = m[1]!;
  if (hex.length <= 4) hex = [...hex].map((ch) => ch + ch).join("");
  const n = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 };
}

/** Un argumento de una función de color: número, porcentaje o ángulo (`none` vale 0). */
type Arg = { n: number; unit: "" | "%" | "deg" | "rad" | "grad" | "turn" };
function parseArg(raw: string): Arg | null {
  if (raw.toLowerCase() === "none") return { n: 0, unit: "" };
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/i.exec(raw);
  if (!m) return null;
  return { n: Number(m[1]), unit: (m[2]?.toLowerCase() ?? "") as Arg["unit"] };
}
const angle = ({ n, unit }: Arg) =>
  unit === "rad" ? (n * 180) / Math.PI : unit === "grad" ? n * 0.9 : unit === "turn" ? n * 360 : unit === "%" ? Number.NaN : n;
const alphaOf = (arg: Arg | undefined) => (arg ? clamp(arg.unit === "%" ? arg.n / 100 : arg.n, 0, 1) : 1);
/** Porcentaje o número en una escala: `50%` y `0.5` (con `scale` 1) valen lo mismo. */
const pct = (arg: Arg, scale: number) => (arg.unit === "%" ? (arg.n / 100) * scale : arg.n);

function splitArgs(body: string): { main: string[]; alpha?: string } | null {
  const [main, alpha, extra] = body.split("/").map((s) => s.trim());
  if (extra !== undefined || main === undefined) return null;
  const legacy = main.includes(",");
  let parts = legacy ? main.split(",").map((s) => s.trim()) : main.split(/\s+/).filter(Boolean);
  let alphaPart = alpha;
  if (legacy && parts.length === 4 && alpha === undefined) {
    alphaPart = parts[3];
    parts = parts.slice(0, 3);
  }
  if (parts.length !== 3 || parts.some((p) => p === "")) return null;
  return { main: parts, alpha: alphaPart };
}

/**
 * Lee un color CSS: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()`, `hsl()`/`hsla()`, `hwb()` y `oklch()`
 * (sintaxis con espacios o con comas), `transparent`. Devuelve `null` si no lo entiende. No recorta lo que lee de
 * `rgb()`: un canal de 300 queda en 255, pero un `oklch()` fuera de sRGB se lleva dentro (ver `oklchToRgb`).
 */
export function parseColor(input: string): Rgba | null {
  const text = String(input ?? "").trim();
  if (!text) return null;
  if (text.startsWith("#")) return parseHex(text);
  if (text.toLowerCase() === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const m = FN_RE.exec(text);
  if (!m) return null;
  const name = m[1]!.toLowerCase();
  const split = splitArgs(m[2]!);
  if (!split) return null;
  const args = split.main.map(parseArg);
  if (args.some((a) => !a)) return null;
  const [x, y, z] = args as [Arg, Arg, Arg];
  const alphaArg = split.alpha !== undefined ? parseArg(split.alpha) : undefined;
  if (split.alpha !== undefined && !alphaArg) return null;
  const a = alphaOf(alphaArg ?? undefined);
  const finite = (c: Rgba | null) => (c && [c.r, c.g, c.b, c.a].every(Number.isFinite) ? c : null);
  // Un tono con `%` no es un ángulo.
  if ((name.startsWith("hsl") || name === "hwb") && Number.isNaN(angle(x))) return null;
  if (name === "oklch" && Number.isNaN(angle(z))) return null;
  switch (name) {
    case "rgb":
    case "rgba":
      return finite(clampRgb({ r: pct(x, 255), g: pct(y, 255), b: pct(z, 255), a }));
    case "hsl":
    case "hsla":
      return finite(hslToRgb({ h: angle(x), s: pct(y, 100) / 100, l: pct(z, 100) / 100, a }));
    case "hwb": {
      const w = clamp(pct(y, 100) / 100, 0, 1);
      const bk = clamp(pct(z, 100) / 100, 0, 1);
      if (w + bk >= 1) {
        const gray = (255 * w) / (w + bk);
        return finite({ r: gray, g: gray, b: gray, a });
      }
      return finite(hsvToRgb({ h: angle(x), s: 1 - w / (1 - bk), v: 1 - bk, a }));
    }
    case "oklch":
      return finite(oklchToRgb({ l: pct(x, 1), c: pct(y, 0.4), h: angle(z), a }));
    default:
      return null;
  }
}

/* ---------- Escritura ---------- */

const hex2 = (n: number) =>
  Math.round(clamp(n, 0, 255))
    .toString(16)
    .padStart(2, "0");
const alphaText = (a: number) => trim(clamp(a, 0, 1), 3);
const fn = (name: string, parts: Array<string | number>, a: number) =>
  `${name}(${parts.join(" ")}${round(a, 3) < 1 ? ` / ${alphaText(a)}` : ""})`;

/** Cadena CSS de un color. Hex lleva alfa (`#rrggbbaa`) solo si no es opaco. */
export function formatColor(rgba: Rgba, format: ColorFormat = "hex"): string {
  const c = clampRgb(rgba);
  if (format === "hex") {
    const alpha = Math.round(c.a * 255);
    return `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${alpha < 255 ? hex2(alpha) : ""}`;
  }
  if (format === "rgb") return fn("rgb", [Math.round(c.r), Math.round(c.g), Math.round(c.b)], c.a);
  if (format === "hsl") {
    const { h, s, l } = hslChannels(c);
    return fn("hsl", [h, `${s}%`, `${l}%`], c.a);
  }
  // Sin recortar: lo leído de un `oklch()` puede salirse de 0–255 por menos del margen de la gama, y recortarlo
  // movería el croma de los colores casi negros al volver a escribirlo.
  const { l, c: chroma, h } = oklchChannels({ ...rgba, a: c.a });
  return fn("oklch", [`${l}%`, chroma, h], c.a);
}

/** Canales HSL redondeados como se escriben (tono entero, porcentajes enteros), sin tono si no hay saturación. */
export function hslChannels(rgba: Rgba): { h: number; s: number; l: number } {
  const hsl = rgbToHsl(rgba);
  const l = round(hsl.l * 100);
  const s = l <= 0 || l >= 100 ? 0 : round(hsl.s * 100);
  const h = s === 0 ? 0 : round(hsl.h) % 360;
  return { h, s, l };
}

/** Canales OKLCH como se escriben: luminosidad en % con dos decimales, croma con cuatro y tono con dos. */
export function oklchChannels(rgba: Rgba): { l: number; c: number; h: number } {
  const o = rgbToOklch(rgba);
  const l = round(o.l * 100, 2);
  const c = l <= 0 || l >= 100 ? 0 : round(o.c, 4);
  const h = c === 0 ? 0 : round(o.h, 2) % 360;
  return { l, c, h };
}

/** Lee y vuelve a escribir en el formato pedido; `fallback` si la cadena no es un color. */
export function normalizeColor(input: string, format: ColorFormat = "hex", fallback?: string): string {
  const c = parseColor(input);
  return c ? formatColor(c, format) : (fallback ?? formatColor({ r: 0, g: 0, b: 0, a: 1 }, format));
}

/** Formato en que está escrita una cadena (`#…` es hex; una función, la suya), o `null`. */
export function formatOf(input: string): ColorFormat | null {
  const text = String(input ?? "")
    .trim()
    .toLowerCase();
  if (text.startsWith("#")) return "hex";
  const name = FN_RE.exec(text)?.[1];
  if (name === "rgb" || name === "rgba") return "rgb";
  if (name === "hsl" || name === "hsla") return "hsl";
  if (name === "oklch") return "oklch";
  return null;
}

/** Dos colores iguales una vez escritos en hex con alfa (lo que distingue la vista). */
export const sameColor = (a: Rgba, b: Rgba) => formatColor(a, "hex") === formatColor(b, "hex");

/* ---------- Contraste y ayudas de la vista ---------- */

/** Luminancia relativa (WCAG 2) de un sRGB opaco. */
export function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const x = clamp(c, 0, 255) / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Razón de contraste WCAG entre dos colores opacos (1 a 21). */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Tono de la marca que va encima de una muestra (el check de la elegida): `dark` si contrasta más el negro que el
 * blanco. Con alfa bajo la muestra deja ver el fondo, así que se da `auto` y decide la hoja.
 */
export function inkOn(rgba: Rgba): "light" | "dark" | "auto" {
  if (rgba.a < 0.5) return "auto";
  const white = { r: 255, g: 255, b: 255, a: 1 };
  const black = { r: 0, g: 0, b: 0, a: 1 };
  return contrastRatio(rgba, black) >= contrastRatio(rgba, white) ? "dark" : "light";
}

/* ---------- Canales de los campos ---------- */

export type ColorChannel = "hex" | "r" | "g" | "b" | "h" | "s" | "l" | "L" | "C" | "H" | "alpha";
export interface ChannelSpec {
  channel: ColorChannel;
  min: number;
  max: number;
  step: number;
}
const CHANNELS: Record<Exclude<ColorFormat, "hex">, ChannelSpec[]> = {
  rgb: [
    { channel: "r", min: 0, max: 255, step: 1 },
    { channel: "g", min: 0, max: 255, step: 1 },
    { channel: "b", min: 0, max: 255, step: 1 },
  ],
  hsl: [
    { channel: "h", min: 0, max: 360, step: 1 },
    { channel: "s", min: 0, max: 100, step: 1 },
    { channel: "l", min: 0, max: 100, step: 1 },
  ],
  oklch: [
    { channel: "L", min: 0, max: 100, step: 0.1 },
    { channel: "C", min: 0, max: 0.4, step: 0.001 },
    { channel: "H", min: 0, max: 360, step: 0.1 },
  ],
};
const ALPHA: ChannelSpec = { channel: "alpha", min: 0, max: 100, step: 1 };

/** Campos de un formato: hex es un solo campo de texto; el resto, tres números y, con alfa, un porcentaje. */
export function channelsOf(format: ColorFormat, alpha: boolean): ChannelSpec[] {
  if (format === "hex") return [{ channel: "hex", min: 0, max: 0, step: 0 }, ...(alpha ? [ALPHA] : [])];
  return [...CHANNELS[format], ...(alpha ? [ALPHA] : [])];
}

/** Valor que muestra cada campo de canal para un color. */
export function channelValues(rgba: Rgba, format: ColorFormat): Partial<Record<ColorChannel, string>> {
  const alpha = String(round(clampRgb(rgba).a * 100));
  if (format === "hex")
    return {
      hex: formatColor({ ...rgba, a: 1 }, "hex")
        .slice(1)
        .toUpperCase(),
      alpha,
    };
  if (format === "rgb") {
    const c = clampRgb(rgba);
    return { r: String(Math.round(c.r)), g: String(Math.round(c.g)), b: String(Math.round(c.b)), alpha };
  }
  if (format === "hsl") {
    const { h, s, l } = hslChannels(rgba);
    return { h: String(h), s: String(s), l: String(l), alpha };
  }
  const { l, c, h } = oklchChannels(rgba);
  return { L: String(round(l, 1)), C: String(round(c, 3)), H: String(round(h, 1)), alpha };
}

/**
 * Color tras escribir `text` en un campo de canal, partiendo de `rgba`; `null` si el texto no vale (el campo
 * conserva lo escrito hasta que salga y se reescriba). Los números se acotan a su recorrido.
 */
export function withChannel(rgba: Rgba, format: ColorFormat, channel: ColorChannel, text: string): Rgba | null {
  const raw = String(text).trim();
  if (channel === "hex") {
    const body = raw.replace(/^#/, "");
    if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(body)) return null;
    const c = parseHex(`#${body}`);
    return c ? { ...c, a: rgba.a } : null;
  }
  const n = Number(raw.replace(",", "."));
  if (raw === "" || !Number.isFinite(n)) return null;
  if (channel === "alpha") return { ...rgba, a: clamp(n, 0, 100) / 100 };
  const spec = channelsOf(format, false).find((s) => s.channel === channel);
  if (!spec) return null;
  const v = clamp(n, spec.min, spec.max);
  if (format === "rgb") return { ...clampRgb(rgba), [channel]: v };
  if (format === "hsl") {
    const cur = hslChannels(rgba);
    const next = { ...cur, [channel]: v };
    return hslToRgb({ h: next.h, s: next.s / 100, l: next.l / 100, a: rgba.a });
  }
  const cur = oklchChannels(rgba);
  const next = { l: cur.l, c: cur.c, h: cur.h, ...(channel === "L" ? { l: v } : channel === "C" ? { c: v } : { h: v }) };
  return oklchToRgb({ l: next.l / 100, c: next.c, h: next.h, a: rgba.a });
}

/* ---------- Teclado del área y de los deslizadores ---------- */

/**
 * Saturación y brillo tras una tecla en el área (patrón de deslizador en dos ejes): izquierda y derecha mueven la
 * saturación, arriba y abajo el brillo; Mayúsculas o Re/Av Pág, diez pasos; Inicio y Fin llevan la saturación a sus
 * extremos. `dirX` es -1 en RTL. `step` es la fracción de un paso (0,01 = 1 %). `undefined` si la tecla no mueve.
 */
export function areaKey(
  key: string,
  shift: boolean,
  s: number,
  v: number,
  dirX: 1 | -1 = 1,
  step = 0.01,
): { s: number; v: number } | undefined {
  const big = shift ? step * 10 : step;
  const out = { s, v };
  if (key === "ArrowRight") out.s = s + big * dirX;
  else if (key === "ArrowLeft") out.s = s - big * dirX;
  else if (key === "ArrowUp") out.v = v + big;
  else if (key === "ArrowDown") out.v = v - big;
  else if (key === "PageUp") out.v = v + step * 10;
  else if (key === "PageDown") out.v = v - step * 10;
  else if (key === "Home") out.s = 0;
  else if (key === "End") out.s = 1;
  else return undefined;
  return { s: clamp(round(out.s, 4), 0, 1), v: clamp(round(out.v, 4), 0, 1) };
}

/** Saturación y brillo en un punto del área: `x` y `y` de 0 a 1 desde la esquina superior de inicio. */
export const areaAt = (x: number, y: number) => ({ s: clamp(x, 0, 1), v: clamp(1 - y, 0, 1) });
