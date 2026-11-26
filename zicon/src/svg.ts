// Iconos sin framework: el mismo dibujo que <Icon>, como cadena SVG. No depende de React.
import { getIcon } from "./registry";
import { safeImageUrl, safePaint } from "./custom";
import type { IconPath, IconVariant } from "./types";

export interface IconSvgOptions {
  /** `outline` por defecto; `solid` para estados activos o énfasis. */
  variant?: IconVariant;
  /** Lado en px o cualquier longitud CSS. */
  size?: number | string;
  /** Nombre accesible. Sin `label` el icono es decorativo y se oculta a lectores de pantalla. */
  label?: string;
  /** Clases extra además de `z-icon`. */
  className?: string;
}

/**
 * Lado del icono: un número o una longitud CSS. Cualquier otra cosa (un atributo mal escrito u hostil, un valor
 * que no es ni número ni cadena) vale 16. La expresión no tiene dos cuantificadores que compitan por las mismas
 * cifras, así que se evalúa en tiempo lineal; el tope de longitud descarta antes las cadenas desmedidas.
 */
const LENGTH = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|ex|ch|%|vw|vh|vmin|vmax|pt|pc|cm|mm|in)?$/;
const MAX_LENGTH = 32;
const side = (size: unknown): string => {
  if (typeof size === "number") return Number.isFinite(size) && size >= 0 ? String(size) : "16";
  if (typeof size !== "string" || size.length > MAX_LENGTH) return "16";
  const value = size.trim();
  return LENGTH.test(value) ? value : "16";
};

/** Un valor cualquiera como texto. Un objeto que no se deja convertir (sin prototipo, con un `toString` roto) es texto vacío. */
const text = (value: unknown): string => {
  try {
    return String(value);
  } catch {
    return "";
  }
};

/** Texto seguro dentro de un atributo HTML o SVG, con comillas dobles o simples. Acepta valores que no son cadena. */
const esc = (value: unknown): string =>
  text(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Trazados de un icono registrado como cadenas `d` (con prefijo "E:" los evenodd); lista vacía si no existe. */
export function iconPaths(name: string, variant: IconVariant = "outline"): string[] {
  return iconParts(name, variant).map((p) => (p.evenodd ? `E:${p.d}` : p.d));
}

/** Un trazado ya normalizado: `d`, regla y pintura propia (la de los iconos que aporta la aplicación). */
export interface IconPart {
  d: string;
  evenodd: boolean;
  fill?: string;
  opacity?: number;
}

const part = (p: IconPath): IconPart =>
  typeof p === "string"
    ? { d: p.startsWith("E:") ? p.slice(2) : p, evenodd: p.startsWith("E:") }
    : { d: p.d, evenodd: !!p.evenodd, fill: safePaint(p.fill), opacity: p.opacity };

/** Trazados de un icono registrado, normalizados. */
export function iconParts(name: string, variant: IconVariant = "outline"): IconPart[] {
  const def = getIcon(name);
  return def ? (variant === "solid" ? def.s : def.o).map(part) : [];
}

/** Caja e imagen de un icono registrado (las de la aplicación pueden traer las suyas). */
export function iconFrame(name: string): { viewBox: string; image?: string; width: number; height: number } {
  const def = getIcon(name);
  const viewBox = def?.viewBox ?? "0 0 24 24";
  const [, , width = 24, height = 24] = viewBox.split(/[\s,]+/).map(Number);
  return { viewBox, image: safeImageUrl(def?.image), width, height };
}

const partAttrs = (p: IconPart): Record<string, string> => {
  const a: Record<string, string> = {};
  if (p.evenodd) {
    a["fill-rule"] = "evenodd";
    a["clip-rule"] = "evenodd";
  }
  if (p.fill) a.fill = p.fill;
  if (p.opacity !== undefined && p.opacity < 1) a.opacity = String(p.opacity);
  a.d = p.d;
  return a;
};

/** Marcado SVG de un icono registrado. Mismo contrato que el componente: clase `z-icon`, color heredado. */
export function iconSvg(name: string, { variant = "outline", size = 16, label, className }: IconSvgOptions = {}): string {
  // Los valores llegan también desde JavaScript sin tipos y desde atributos del DOM: todo lo que se interpola
  // en el marcado se escapa, y la variante se reduce a los dos valores del contrato.
  variant = variant === "solid" ? "solid" : "outline";
  const frame = iconFrame(name);
  const image = frame.image
    ? `<image href="${esc(frame.image)}" x="${esc(frameX(frame.viewBox))}" y="${esc(frameY(frame.viewBox))}" width="${esc(frame.width)}" height="${esc(frame.height)}" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  const body = iconParts(name, variant)
    .map(
      (p) =>
        `<path ${Object.entries(partAttrs(p))
          .map(([k, v]) => `${k}="${esc(v)}"`)
          .join(" ")}/>`,
    )
    .join("");
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`;
  const cls = className ? `z-icon ${esc(className)}` : "z-icon";
  // El lado ya está validado; se escapa igualmente, como todo lo demás, para que la regla no tenga excepciones.
  const px = esc(side(size));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${esc(frame.viewBox)}" width="${px}" height="${px}" fill="currentColor" focusable="false" ${a11y} data-icon="${esc(name)}" data-variant="${variant}" class="${cls}">${image}${body}</svg>`;
}

const frameX = (viewBox: string) => viewBox.split(/[\s,]+/)[0] ?? "0";
const frameY = (viewBox: string) => viewBox.split(/[\s,]+/)[1] ?? "0";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * El mismo icono como elemento SVG, construido con el DOM y sin pasar por `innerHTML`: sirve en páginas con
 * Trusted Types (`require-trusted-types-for 'script'`), donde asignar una cadena de marcado está bloqueado.
 * Solo en el navegador.
 */
export function iconElement(name: string, { variant = "outline", size = 16, label, className }: IconSvgOptions = {}): SVGSVGElement {
  variant = variant === "solid" ? "solid" : "outline";
  const frame = iconFrame(name);
  const svg = document.createElementNS(SVG_NS, "svg");
  const attrs: Record<string, string> = {
    viewBox: frame.viewBox,
    width: side(size),
    height: side(size),
    fill: "currentColor",
    focusable: "false",
    ...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" }),
    "data-icon": name,
    "data-variant": variant,
    class: className ? `z-icon ${className}` : "z-icon",
  };
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value);
  if (frame.image) {
    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("href", frame.image);
    image.setAttribute("x", frameX(frame.viewBox));
    image.setAttribute("y", frameY(frame.viewBox));
    image.setAttribute("width", String(frame.width));
    image.setAttribute("height", String(frame.height));
    image.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.append(image);
  }
  for (const p of iconParts(name, variant)) {
    const path = document.createElementNS(SVG_NS, "path");
    for (const [key, value] of Object.entries(partAttrs(p))) path.setAttribute(key, value);
    svg.append(path);
  }
  return svg;
}
