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

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Trazados de un icono registrado; lista vacía si no existe. */
export function iconPaths(name: string, variant: IconVariant = "outline"): string[] {
  const def = getIcon(name);
  return def ? (variant === "solid" ? def.s : def.o) : [];
}

/** Marcado SVG de un icono registrado. Mismo contrato que el componente: clase `z-icon`, color heredado. */
export function iconSvg(name: string, { variant = "outline", size = 16, label, className }: IconSvgOptions = {}): string {
  const body = iconPaths(name, variant)
    .map((d) => (d.startsWith("E:") ? `<path fill-rule="evenodd" clip-rule="evenodd" d="${d.slice(2)}"/>` : `<path d="${d}"/>`))
    .join("");
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`;
  const cls = className ? `z-icon ${esc(className)}` : "z-icon";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${esc(String(size))}" height="${esc(String(size))}" fill="currentColor" focusable="false" ${a11y} data-icon="${esc(name)}" data-variant="${variant}" class="${cls}">${body}</svg>`;
}
