// Piezas comunes de las funciones de bloque: reglas de hueco, categorías e iconos como `<z-icon>`.

import type { VEl } from "../../core/vnode";
import type { ContentCategory, JsonSchema, SlotRule } from "../types";

export const PHRASING: SlotRule = { accepts: ["phrasing"], text: true };
export const PHRASING_STATIC: SlotRule = { accepts: ["phrasing"], rejects: ["interactive"], text: true };
export const FLOW: SlotRule = { accepts: ["flow"], text: true };
export const LAYOUT: SlotRule = { accepts: ["flow"] };

export const INLINE: ContentCategory[] = ["flow", "phrasing"];
export const CONTROL: ContentCategory[] = ["flow", "phrasing", "interactive"];
export const BLOCK: ContentCategory[] = ["flow"];

/** Icono del contrato: `<z-icon name size [variant] [label]>`. */
export function zicon(name: unknown, size: number, variant?: unknown, label?: string): VEl {
  return {
    t: "z-icon",
    a: { name: String(name), variant: variant === "solid" ? "solid" : undefined, size: String(size), label: label || undefined },
  };
}

/** Booleano como lo escribe React en un `data-*` o `aria-*`: `"true"` o ausente. */
export const flag = (v: unknown) => (v === true ? "true" : undefined);

export const enumOf = (values: (string | number)[], def: string | number, description?: string): JsonSchema => ({
  type: typeof values[0] === "number" ? "integer" : "string",
  enum: values,
  default: def,
  "x-control": "select",
  ...(description ? { description } : {}),
});

export const text = (description?: string, def?: string): JsonSchema => ({
  type: "string",
  "x-control": "text",
  ...(def !== undefined ? { default: def } : {}),
  ...(description ? { description } : {}),
});

export const bool = (def = false, description?: string): JsonSchema => ({
  type: "boolean",
  default: def,
  "x-control": "switch",
  ...(description ? { description } : {}),
});

export const icon = (description?: string): JsonSchema => ({
  type: "string",
  "x-control": "icon",
  ...(description ? { description } : {}),
});

export const SPACE = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
