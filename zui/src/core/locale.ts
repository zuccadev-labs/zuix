// Idioma de los textos propios de los componentes. Un paquete de idioma (`LocalePack`) trae, por espacio de nombres,
// las mismas claves que las constantes `*_LABELS` en inglés; aquí se registran, se elige el activo y se mezclan con
// esas constantes. Orden de precedencia: las `labels` por prop mandan sobre el paquete, y el paquete sobre el inglés.
// Sin React y sin documento al importar: lo usan el binding de React (LocaleProvider), el modo DOM (setLocale y el
// atributo `lang` heredado) y la lógica de core.
//
// Plurales: un texto puede llevar la sintaxis de plural de ICU, `{n, plural, one {# día} other {# días}}`. La
// categoría sale de `Intl.PluralRules` del idioma del paquete que trae el texto; `#` es el número formateado con
// `Intl.NumberFormat`. Las constantes en inglés no la necesitan: ya separan el singular en claves propias.

/** Un texto o un grupo de textos anidado (`views`, `status`…). */
export interface Messages {
  readonly [key: string]: string | Messages;
}

/** Textos de un idioma, por espacio de nombres (`cascader`, `chat`…). */
export interface LocalePack<M extends object = Record<string, Messages>> {
  /** Etiqueta BCP 47 del idioma: `es`, `pt`, `fr`, `de`. */
  id: string;
  messages: M;
  /**
   * Claves (`espacio.clave`) que coinciden con el inglés a propósito ("OK", "HEX"). La comprobación de los paquetes
   * no las marca como textos sin traducir.
   */
  same?: readonly string[];
}

/** Paquete de un idioma con todas las claves de los textos en inglés (`T`), con el mismo anidamiento. */
export type LocaleMessages<T> = {
  [K in keyof T]: NonNullable<T[K]> extends string
    ? string
    : NonNullable<T[K]> extends readonly string[]
      ? readonly string[]
      : LocaleMessages<NonNullable<T[K]>>;
};

const BASE = "en";
const registry = new Map<string, Record<string, Messages>>();
/** Idioma de cada texto con plural, para elegir la regla de plural del idioma que lo escribió. */
const pluralLang = new Map<string, string>();
const merged = new Map<string, unknown>();
const listeners = new Set<(id: string | undefined) => void>();
let active: string | undefined;
let scope: string | undefined;
let scoped = false;

const norm = (id: string) => id.trim().replace(/_/g, "-").toLowerCase();

function walkPlurals(messages: Messages, lang: string): void {
  for (const value of Object.values(messages)) {
    if (typeof value === "string") {
      if (value.includes(", plural,")) pluralLang.set(value, lang);
    } else walkPlurals(value, lang);
  }
}

/**
 * Registra uno o varios paquetes. Varios paquetes del mismo idioma se suman (los de zui y los de zout); una clave
 * repetida la gana el último.
 */
export function registerLocale(...packs: readonly LocalePack<object>[]): void {
  for (const pack of packs) {
    const id = norm(pack.id);
    const current = registry.get(id) ?? {};
    const next: Record<string, Messages> = { ...current };
    const messages = pack.messages as Record<string, Messages>;
    for (const [ns, value] of Object.entries(messages)) next[ns] = { ...(current[ns] ?? {}), ...value };
    registry.set(id, next);
    for (const value of Object.values(messages)) walkPlurals(value, id);
  }
  merged.clear();
}

/**
 * El idioma registrado que sirve para una etiqueta: la exacta (`pt-br`) o su idioma base (`pt`). El inglés siempre
 * sirve: son las constantes. `undefined` si no hay ninguno.
 */
export function resolveLocale(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  const full = norm(id);
  if (registry.has(full)) return full;
  const base = full.split("-")[0]!;
  if (registry.has(base)) return base;
  return base === BASE ? BASE : undefined;
}

/** Verdadero si hay textos para ese idioma (o es inglés). */
export const hasLocale = (id: string) => resolveLocale(id) !== undefined;

/** Idiomas con paquete registrado. */
export const registeredLocales = (): string[] => [...registry.keys()];

/** Idioma activo por defecto: el que fija `setLocale()` del modo DOM o el de un `LocaleProvider` sin anidar. */
export const defaultLocale = (): string | undefined => active;

/** Cambia el idioma por defecto y avisa a los suscriptores (el modo DOM vuelve a pintar). */
export function setDefaultLocale(id: string | undefined): void {
  const next = id ? norm(id) : undefined;
  if (next === active) return;
  active = next;
  for (const fn of listeners) fn(active);
}

/** Avisa de cada cambio de idioma por defecto. Devuelve la baja. */
export function onLocaleChange(fn: (id: string | undefined) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Ejecuta `fn` con un idioma de ámbito: lo que se calcule dentro (configuración y árbol de una pieza) toma los
 * textos de ese idioma. Es síncrono y se restaura al salir, también si `fn` lanza.
 */
export function withLocale<T>(id: string | undefined, fn: () => T): T {
  const prev = scope;
  const prevScoped = scoped;
  scope = id ? norm(id) : undefined;
  scoped = true;
  try {
    return fn();
  } finally {
    scope = prev;
    scoped = prevScoped;
  }
}

/** Idioma vigente: el del ámbito (`withLocale`) o, si no lo hay, el activo por defecto. */
export const currentLocale = (): string | undefined => (scoped && scope ? scope : active);

const isGroup = (v: unknown): v is Messages => typeof v === "object" && v !== null && !Array.isArray(v);

function deepMerge<T>(base: T, over: Messages): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    // Solo claves que existen en inglés y con la misma forma: un paquete desfasado no cuela claves nuevas.
    if (b === undefined) continue;
    if (Array.isArray(b) && typeof v === "object" && v !== null) {
      const list = v as unknown as Record<number, unknown>;
      out[k] = b.map((x, i) => (typeof list[i] === "string" ? list[i] : x));
    } else if (isGroup(v) && isGroup(b)) out[k] = deepMerge(b, v);
    else if (typeof v === "string" && typeof b === "string") out[k] = v;
  }
  return out as T;
}

/**
 * Los textos de un espacio de nombres en el idioma indicado (o el vigente), mezclados sobre los de inglés. Sin
 * paquete para ese idioma devuelve `base` tal cual. El resultado se reutiliza: misma referencia mientras no cambie
 * el registro.
 */
export function localize<T extends object>(ns: string, base: T, id: string | undefined = currentLocale()): T {
  const lang = resolveLocale(id);
  if (!lang || lang === BASE) return base;
  const over = registry.get(lang)?.[ns];
  if (!over) return base;
  const key = `${lang}\u0000${ns}`;
  const hit = merged.get(key) as { base: T; value: T } | undefined;
  if (hit && hit.base === base) return hit.value;
  const value = deepMerge(base, over);
  merged.set(key, { base, value });
  return value;
}

// Formateadores de Intl en caché: crear uno cuesta más que usarlo.
const cache = new Map<string, unknown>();
function cached<T>(kind: string, locale: string | undefined, options: object | undefined, make: () => T): T {
  const key = `${kind}|${locale ?? ""}|${options ? JSON.stringify(options) : ""}`;
  let hit = cache.get(key) as T | undefined;
  if (!hit) {
    hit = make();
    cache.set(key, hit);
  }
  return hit;
}
const safeLocale = (id: string | undefined) => {
  if (!id) return undefined;
  try {
    return Intl.getCanonicalLocales(id)[0];
  } catch {
    return undefined;
  }
};

/** `Intl.PluralRules` en caché. */
export const pluralRules = (locale?: string, options?: Intl.PluralRulesOptions) =>
  cached("plural", safeLocale(locale), options, () => new Intl.PluralRules(safeLocale(locale), options));

/** Número con `Intl.NumberFormat` del idioma indicado (o el vigente). */
export const formatNumber = (value: number, options?: Intl.NumberFormatOptions, locale: string | undefined = currentLocale()) =>
  cached("number", safeLocale(locale), options, () => new Intl.NumberFormat(safeLocale(locale), options)).format(value);

/** Fecha con `Intl.DateTimeFormat` del idioma indicado (o el vigente). */
export const formatDate = (value: Date | number, options?: Intl.DateTimeFormatOptions, locale: string | undefined = currentLocale()) =>
  cached("date", safeLocale(locale), options, () => new Intl.DateTimeFormat(safeLocale(locale), options)).format(value);

/**
 * Lista con `Intl.ListFormat` ("A, B y C"). En inglés, o sin idioma, se mantiene la lista con comas que ya escribían
 * los componentes ("A, B, C"): los textos en inglés no cambian.
 */
export function formatList(items: readonly string[], options?: Intl.ListFormatOptions, locale: string | undefined = currentLocale()): string {
  const lang = resolveLocale(locale) ?? (locale ? norm(locale).split("-")[0] : undefined);
  if (!lang || lang === BASE || typeof Intl.ListFormat !== "function") return items.join(", ");
  return cached("list", safeLocale(locale), options, () => new Intl.ListFormat(safeLocale(locale), { type: "conjunction", ...options })).format(items);
}

// Plural de ICU: `{n, plural, =0 {…} one {…} other {…}}`, con `#` para el número. Admite llaves anidadas
// (`{name}` dentro de una forma).
function readBlock(t: string, open: number): number {
  let depth = 0;
  for (let i = open; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

function plural(t: string, start: number, name: string, values: Record<string, string | number>, lang: string | undefined) {
  const end = readBlock(t, start);
  if (end < 0) return null;
  const body = t.slice(t.indexOf(",", t.indexOf(",", start) + 1) + 1, end);
  const forms = new Map<string, string>();
  const re = /\s*(=\d+|zero|one|two|few|many|other)\s*\{/g;
  let m: RegExpExecArray | null = re.exec(body);
  while (m) {
    const open = m.index + m[0].length - 1;
    const close = readBlock(body, open);
    if (close < 0) break;
    forms.set(m[1]!, body.slice(open + 1, close));
    re.lastIndex = close + 1;
    m = re.exec(body);
  }
  const raw = values[name];
  const n = typeof raw === "number" ? raw : Number(raw);
  const form = forms.get(`=${n}`) ?? (Number.isFinite(n) ? forms.get(pluralRules(lang).select(n)) : undefined) ?? forms.get("other") ?? "";
  const shown = Number.isFinite(n) ? formatNumber(n, undefined, lang) : String(raw ?? "");
  return { end, text: form.replace(/#/g, shown) };
}

/**
 * Rellena una plantilla: `{nombre}` con su valor y los plurales de ICU con la regla de su idioma. `missing` decide qué
 * queda de un hueco sin valor (por defecto, el propio hueco). Sin plurales es un reemplazo simple, como antes.
 */
export function format(
  template: string,
  values: Record<string, string | number>,
  options: { locale?: string; missing?: (key: string) => string } = {},
): string {
  const missing = options.missing ?? ((k: string) => `{${k}}`);
  const simple = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => (values[k] === undefined || values[k] === null ? missing(k) : String(values[k])));
  if (!template.includes(", plural,")) return simple(template);
  const lang = options.locale ?? pluralLang.get(template) ?? currentLocale();
  let out = "";
  let i = 0;
  const re = /\{(\w+),\s*plural,/g;
  let m: RegExpExecArray | null = re.exec(template);
  while (m) {
    const done = plural(template, m.index, m[1]!, values, lang);
    if (!done) break;
    out += simple(template.slice(i, m.index)) + simple(done.text);
    i = done.end + 1;
    re.lastIndex = i;
    m = re.exec(template);
  }
  return out + simple(template.slice(i));
}

/** Nombres de los huecos de una plantilla, también los de un plural (`n` en `{n, plural, …}`). */
export function placeholders(template: string): string[] {
  const names = new Set<string>();
  for (const m of template.matchAll(/\{(\w+)(?:\}|,\s*plural,)/g)) names.add(m[1]!);
  return [...names].sort();
}
