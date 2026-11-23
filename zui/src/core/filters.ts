// Filtros de FilterBar: qué está activo, cómo cambia un filtro de opciones, el resumen que se escribe en cada chip y
// el recuento. Lógica pura, sin documento.

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  id: string;
  label: string;
  /** Icono del chip (nombre de zicon). */
  icon?: string;
  /** `toggle`: se enciende y se apaga. `menu`: abre una lista de opciones. Por defecto, `menu` si tiene opciones. */
  type?: "toggle" | "menu";
  options?: readonly FilterOption[];
  /** En un menú, varias opciones a la vez (casillas). Por defecto, sí; `false` es una sola (botones de opción). */
  multiple?: boolean;
}

/** Valor de la barra: `true` en un filtro de interruptor, la lista de opciones elegidas en uno de menú. */
export type FilterValue = Readonly<Record<string, boolean | readonly string[]>>;

export const filterKind = (def: FilterDef): "toggle" | "menu" => def.type ?? (def.options?.length ? "menu" : "toggle");

/** Opciones elegidas de un filtro de menú (solo las que existen, sin repetir y en el orden de la definición). */
export function selected(def: FilterDef, value: FilterValue): string[] {
  const raw = value[def.id];
  if (!Array.isArray(raw)) return [];
  const chosen = new Set(raw);
  const out = (def.options ?? []).map((o) => o.value).filter((v) => chosen.has(v));
  return def.multiple === false ? out.slice(0, 1) : out;
}

export function isActive(def: FilterDef, value: FilterValue): boolean {
  return filterKind(def) === "toggle" ? value[def.id] === true : selected(def, value).length > 0;
}

/** Filtros activos (cada filtro cuenta uno, tenga una opción elegida o varias). */
export const activeCount = (defs: readonly FilterDef[], value: FilterValue) => defs.filter((d) => isActive(d, value)).length;

/** Enciende o apaga un filtro de interruptor. */
export function toggleFilter(def: FilterDef, value: FilterValue): Record<string, boolean | readonly string[]> {
  const next = { ...value };
  if (value[def.id] === true) delete next[def.id];
  else next[def.id] = true;
  return next;
}

/**
 * Elige o quita una opción de un filtro de menú. Con varias, alterna esa opción; con una sola, la elige (o la quita
 * si ya era la elegida). Un filtro sin opciones elegidas desaparece del valor.
 */
export function toggleOption(def: FilterDef, value: FilterValue, option: string): Record<string, boolean | readonly string[]> {
  const next = { ...value };
  if (!(def.options ?? []).some((o) => o.value === option)) return next;
  const current = selected(def, value);
  let list: string[];
  if (def.multiple === false) list = current[0] === option ? [] : [option];
  else list = current.includes(option) ? current.filter((v) => v !== option) : [...current, option];
  const ordered = (def.options ?? []).map((o) => o.value).filter((v) => list.includes(v));
  if (ordered.length) next[def.id] = ordered;
  else delete next[def.id];
  return next;
}

/** Texto del chip: la etiqueta sola, la opción elegida, o «Etiqueta · 3» con varias. */
export function chipText(def: FilterDef, value: FilterValue): { label: string; detail: string } {
  if (filterKind(def) === "toggle") return { label: def.label, detail: "" };
  const chosen = selected(def, value);
  if (chosen.length === 1) return { label: def.label, detail: def.options?.find((o) => o.value === chosen[0])?.label ?? "" };
  return { label: def.label, detail: chosen.length > 1 ? String(chosen.length) : "" };
}

/** Firma estable de un valor (para saber si la aplicación lo cambió). */
export function valueKey(value: FilterValue | undefined): string {
  if (!value) return "";
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .map((k) => [k, value[k]]),
  );
}
