// Iconos sin framework: el mismo dibujo que <Icon>, como cadena SVG. No depende de React.
import { getIcon } from "./registry";
import type { IconVariant } from "./types";

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

/** Lado del icono: un número o una longitud CSS. Cualquier otra cosa (un atributo mal escrito u hostil) vale 16. */
const LENGTH = /^\d*\.?\d+(px|em|rem|ex|ch|%|vw|vh|vmin|vmax|pt|pc|cm|mm|in)?$/;
const side = (size: number | string): string => (typeof size === "number" ? (Number.isFinite(size) && size >= 0 ? String(size) : "16") : LENGTH.test(size.trim()) ? size.trim() : "16");

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Trazados de un icono registrado; lista vacía si no existe. */
export function iconPaths(name: string, variant: IconVariant = "outline"): string[] {
  const def = getIcon(name);
  return def ? (variant === "solid" ? def.s : def.o) : [];
}

/** Marcado SVG de un icono registrado. Mismo contrato que el componente: clase `z-icon`, color heredado. */
export function iconSvg(name: string, { variant = "outline", size = 16, label, className }: IconSvgOptions = {}): string {
  // Los valores llegan también desde JavaScript sin tipos y desde atributos del DOM: todo lo que se interpola
  // en el marcado se escapa, y la variante se reduce a los dos valores del contrato.
  variant = variant === "solid" ? "solid" : "outline";
  const body = iconPaths(name, variant)
    .map((d) => (d.startsWith("E:") ? `<path fill-rule="evenodd" clip-rule="evenodd" d="${esc(d.slice(2))}"/>` : `<path d="${esc(d)}"/>`))
    .join("");
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`;
  const cls = className ? `z-icon ${esc(className)}` : "z-icon";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${side(size)}" height="${side(size)}" fill="currentColor" focusable="false" ${a11y} data-icon="${esc(name)}" data-variant="${variant}" class="${cls}">${body}</svg>`;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * El mismo icono como elemento SVG, construido con el DOM y sin pasar por `innerHTML`: sirve en páginas con
 * Trusted Types (`require-trusted-types-for 'script'`), donde asignar una cadena de marcado está bloqueado.
 * Solo en el navegador.
 */
export function iconElement(name: string, { variant = "outline", size = 16, label, className }: IconSvgOptions = {}): SVGSVGElement {
  variant = variant === "solid" ? "solid" : "outline";
  const svg = document.createElementNS(SVG_NS, "svg");
  const attrs: Record<string, string> = {
    viewBox: "0 0 24 24", width: side(size), height: side(size), fill: "currentColor", focusable: "false",
    ...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" }),
    "data-icon": name, "data-variant": variant, class: className ? `z-icon ${className}` : "z-icon",
  };
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value);
  for (const d of iconPaths(name, variant)) {
    const path = document.createElementNS(SVG_NS, "path");
    if (d.startsWith("E:")) { path.setAttribute("fill-rule", "evenodd"); path.setAttribute("clip-rule", "evenodd"); }
    path.setAttribute("d", d.startsWith("E:") ? d.slice(2) : d);
    svg.append(path);
  }
  return svg;
}
