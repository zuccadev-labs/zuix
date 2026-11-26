// Iconos que aporta la aplicación (marcas, logotipos de productos, glifos propios): zuix no incluye iconos de terceros,
// pero `<Icon>`, `<z-icon>` y los nodos dibujan cualquier icono registrado. Aquí se validan antes de registrarlos:
// nombre en kebab-case que no pise uno del set, caja numérica, trazados con solo comandos de trazado, pinturas sin
// `url()` y una imagen con URL segura. Nada se interpreta como marcado: `parseSvgIcon` solo extrae atributos de una
// cadena SVG (sin DOMParser ni innerHTML), así que sirve también con Trusted Types y en el servidor.
import { iconNames } from "./names";
import { registerIcons } from "./registry";
import type { IconDef, IconPath, IconPathDef } from "./types";

/**
 * Nombres de los iconos propios de la aplicación, para que `<Icon name>` los acepte con tipos:
 *
 * ```ts
 * declare module "@zuccadev-labs/zuix-zicon" {
 *   interface CustomIcons { "acme-logo": true }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: se amplía por fusión de declaraciones desde la aplicación.
export interface CustomIcons {}
export type CustomIconName = Extract<keyof CustomIcons, string>;

export interface AppIconSource {
  /** Nombre en kebab-case. No puede ser el de un icono del set. */
  name: string;
  /** Caja del dibujo (`"0 0 32 32"`). Por defecto la de `svg` o `0 0 24 24`. */
  viewBox?: string;
  /** Trazados de la variante normal. */
  paths?: IconPath[];
  /** Trazados de la variante `solid`. Sin ellos, los mismos que `paths`. */
  solid?: IconPath[];
  /** Imagen a todo color (https, ruta del mismo sitio o `data:image/…`). */
  image?: string;
  /** Un SVG como texto: se extraen su caja y sus formas (path, circle, ellipse, rect, polygon, polyline). */
  svg?: string;
}

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIEWBOX = /^\s*-?\d+(?:\.\d+)?(?:[\s,]+-?\d+(?:\.\d+)?){3}\s*$/;
/** Solo comandos y números de trazado: ni comillas, ni ángulos, ni paréntesis. */
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/;
const MAX_PATH = 64 * 1024;
const COLOR =
  /^(?:currentColor|none|transparent|#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([\d\s.,%/+\-a-zA-Z]*\)|var\(--[\w-]+\))$/;
const IMAGE_DATA = /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)(?:;[\w=+-]+)*,/i;

const suite = new Set<string>(iconNames);

/** Pintura segura o `undefined`. */
export function safePaint(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v.length <= 64 && COLOR.test(v) && !/url\s*\(/i.test(v) ? v : undefined;
}

/**
 * URL de imagen segura o `undefined`: https/http, ruta relativa o absoluta del sitio y `data:image/…`. Rechaza
 * `javascript:`, `blob:` de otro origen, `data:` que no es imagen y cualquier esquema desconocido.
 */
export function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v || v.length > 2_000_000 || [...v].some((c) => c.charCodeAt(0) < 32)) return undefined;
  if (IMAGE_DATA.test(v)) return v;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(v)?.[1]?.toLowerCase();
  if (!scheme) return v.startsWith("//") ? undefined : v;
  return scheme === "https" || scheme === "http" ? v : undefined;
}

function cleanPath(p: IconPath): IconPath | null {
  if (typeof p === "string") {
    const d = p.startsWith("E:") ? p.slice(2) : p;
    return d.length <= MAX_PATH && PATH_D.test(d) && d.trim() ? p : null;
  }
  if (!p || typeof p !== "object" || typeof p.d !== "string" || p.d.length > MAX_PATH || !PATH_D.test(p.d) || !p.d.trim()) return null;
  const out: IconPathDef = { d: p.d };
  const fill = safePaint(p.fill);
  if (fill) out.fill = fill;
  if (typeof p.opacity === "number" && Number.isFinite(p.opacity)) out.opacity = Math.min(1, Math.max(0, p.opacity));
  if (p.evenodd) out.evenodd = true;
  return out;
}

const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[2] ?? m[3]) : undefined;
};
const num = (v: string | undefined, fallback = 0) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) ? n : fallback;
};
const r2 = (n: number) => Math.round(n * 1000) / 1000;

/** Una forma básica como trazado (`circle`, `ellipse`, `rect` con radio, `polygon`, `polyline`). */
function shapeToPath(name: string, tag: string): string | undefined {
  if (name === "path") return attr(tag, "d");
  if (name === "circle" || name === "ellipse") {
    const cx = num(attr(tag, "cx"));
    const cy = num(attr(tag, "cy"));
    const rx = name === "circle" ? num(attr(tag, "r")) : num(attr(tag, "rx"));
    const ry = name === "circle" ? rx : num(attr(tag, "ry"));
    if (rx <= 0 || ry <= 0) return undefined;
    return `M${r2(cx - rx)} ${r2(cy)}a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(rx * 2)} 0a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-rx * 2)} 0Z`;
  }
  if (name === "rect") {
    const x = num(attr(tag, "x"));
    const y = num(attr(tag, "y"));
    const w = num(attr(tag, "width"));
    const h = num(attr(tag, "height"));
    if (w <= 0 || h <= 0) return undefined;
    const rx = Math.min(num(attr(tag, "rx"), num(attr(tag, "ry"))), w / 2);
    const ry = Math.min(num(attr(tag, "ry"), rx), h / 2);
    if (rx <= 0) return `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;
    return `M${r2(x + rx)} ${r2(y)}h${r2(w - 2 * rx)}a${r2(rx)} ${r2(ry)} 0 0 1 ${r2(rx)} ${r2(ry)}v${r2(h - 2 * ry)}a${r2(rx)} ${r2(ry)} 0 0 1 ${r2(-rx)} ${r2(ry)}h${r2(-(w - 2 * rx))}a${r2(rx)} ${r2(ry)} 0 0 1 ${r2(-rx)} ${r2(-ry)}v${r2(-(h - 2 * ry))}a${r2(rx)} ${r2(ry)} 0 0 1 ${r2(rx)} ${r2(-ry)}Z`;
  }
  if (name === "polygon" || name === "polyline") {
    const pts = (attr(tag, "points") ?? "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (pts.length < 4 || pts.some((n) => !Number.isFinite(n))) return undefined;
    let d = `M${r2(pts[0]!)} ${r2(pts[1]!)}`;
    for (let i = 2; i + 1 < pts.length; i += 2) d += `L${r2(pts[i]!)} ${r2(pts[i + 1]!)}`;
    return name === "polygon" ? `${d}Z` : d;
  }
  return undefined;
}

/**
 * Caja y formas de un SVG dado como texto. Solo lee atributos de las etiquetas de forma (`path`, `circle`, `ellipse`,
 * `rect`, `polygon`, `polyline`): no crea elementos ni interpreta scripts, estilos, enlaces o `<use>`, que se ignoran.
 */
export function parseSvgIcon(svg: string): { viewBox: string; paths: IconPathDef[] } {
  const text = typeof svg === "string" ? svg.slice(0, MAX_PATH * 4) : "";
  const open = /<svg\b[^>]*>/i.exec(text)?.[0] ?? "";
  let viewBox = attr(open, "viewBox") ?? "";
  if (!VIEWBOX.test(viewBox)) {
    const w = num(attr(open, "width"), 24);
    const h = num(attr(open, "height"), 24);
    viewBox = `0 0 ${w} ${h}`;
  }
  const paths: IconPathDef[] = [];
  for (const m of text.matchAll(/<(path|circle|ellipse|rect|polygon|polyline)\b[^>]*>/gi)) {
    const name = m[1]!.toLowerCase();
    const d = shapeToPath(name, m[0]);
    if (!d || !PATH_D.test(d)) continue;
    const p: IconPathDef = { d: d.trim() };
    const fill = safePaint(attr(m[0], "fill"));
    if (fill) p.fill = fill;
    const opacity = attr(m[0], "opacity") ?? attr(m[0], "fill-opacity");
    if (opacity !== undefined && Number.isFinite(Number(opacity))) p.opacity = Math.min(1, Math.max(0, Number(opacity)));
    if ((attr(m[0], "fill-rule") ?? "").toLowerCase() === "evenodd") p.evenodd = true;
    paths.push(p);
  }
  return { viewBox: viewBox.trim().replace(/[\s,]+/g, " "), paths };
}

/** Problema de un icono de la aplicación (o `null` si se puede registrar). */
export type AppIconProblem = "name" | "reserved" | "viewbox" | "empty" | "path" | "image";

/**
 * Valida un icono de la aplicación y lo devuelve listo para `registerIcons`, o lanza un `TypeError` con el problema.
 * Un trazado que no es de trazado (comillas, `<`, paréntesis) se rechaza; una pintura insegura se descarta.
 */
export function defineIcon(source: AppIconSource): IconDef {
  const fail = (problem: AppIconProblem): never => {
    throw new TypeError(`[zicon] icono de la aplicación no válido (${problem}): ${String(source?.name)}`);
  };
  if (!source || typeof source.name !== "string" || !NAME.test(source.name)) fail("name");
  if (suite.has(source.name)) fail("reserved");
  const parsed = source.svg ? parseSvgIcon(source.svg) : null;
  const viewBox = (source.viewBox ?? parsed?.viewBox ?? "0 0 24 24").trim().replace(/[\s,]+/g, " ");
  if (!VIEWBOX.test(viewBox)) fail("viewbox");
  const [, , w, h] = viewBox.split(" ").map(Number);
  if (!(w! > 0 && h! > 0)) fail("viewbox");
  const raw = source.paths ?? parsed?.paths ?? [];
  const o = raw.map(cleanPath);
  if (o.some((p) => p === null)) fail("path");
  const s = (source.solid ?? raw).map(cleanPath);
  if (s.some((p) => p === null)) fail("path");
  let image: string | undefined;
  if (source.image !== undefined) {
    image = safeImageUrl(source.image);
    if (!image) fail("image");
  }
  if (!o.length && !image) fail("empty");
  const def: IconDef = { name: source.name, o: o as IconPath[], s: s as IconPath[] };
  if (viewBox !== "0 0 24 24") def.viewBox = viewBox;
  if (image) def.image = image;
  return def;
}

/** Valida y registra iconos de la aplicación. Devuelve los nombres registrados. */
export function registerAppIcons(sources: readonly AppIconSource[]): string[] {
  const defs = sources.map(defineIcon);
  registerIcons(defs);
  return defs.map((d) => d.name);
}
