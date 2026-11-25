// Edición de marca: leer y escribir tokens (`--z-*`) de un archivo de marca con el esquema de tokens (tipo, ámbito y
// rango de cada uno), aplicarlos en vivo y exportar el archivo (`tokens/schema/brand.schema.json`). El contraste se
// mide con las reglas de `pnpm tokens` (./contrast). Pura: aplicar en vivo es `cssVariables()` en el puente o en un
// elemento.

import { type ContrastReport, checkContrast, expandToken, parseCssColor } from "./contrast";
import { validateSchema } from "./json-schema";
import type { BrandFile, CatalogTokens, TokenSpec } from "./types";

export type Theme = "dark" | "light";

export interface TokenProblem {
  token: string;
  theme?: Theme;
  message: string;
}

export interface BrandEditor {
  /** Especificación de cada token editable (tipo, ámbito, rango, valor por defecto). */
  readonly specs: readonly TokenSpec[];
  spec(name: string): TokenSpec | undefined;
  /** Valor escrito en la marca (sin resolver), o el que hereda de la base. */
  get(name: string, theme?: Theme): string | undefined;
  /** Valor resuelto (referencias sustituidas). */
  resolve(name: string, theme?: Theme): string | null;
  /** Fija un token. Con `theme` en uno de tema; sin él, en los dos. Devuelve los problemas (vacío si se aplicó). */
  set(name: string, value: string, theme?: Theme): TokenProblem[];
  /** Quita la sobrescritura: el token vuelve al valor de la base. */
  reset(name: string, theme?: Theme): void;
  /** Tokens cambiados respecto a la marca de partida, como variables CSS para aplicarlas en vivo. */
  cssVariables(theme: Theme): Record<string, string>;
  /** Contraste de la marca en los dos temas, con las reglas de `pnpm tokens`. */
  contrast(): ContrastReport;
  /** Archivo de marca validado contra su esquema. Lanza si no cumple. */
  export(): BrandFile;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const UNSAFE = /[;{}<>]|\/\*|\burl\s*\(|\bexpression\s*\(|@import/i;

function px(value: string): number | null {
  const m = /^(-?\d+(?:\.\d+)?)(px|rem|em)?$/.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === "rem" || m[2] === "em" ? n * 16 : n;
}

function ms(value: string): number | null {
  const m = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value.trim());
  if (!m) return null;
  return m[2] === "s" ? Number(m[1]) * 1000 : Number(m[1]);
}

/** Problema de un valor para el tipo y rango del token, o `null`. `resolved` es el valor con referencias sustituidas. */
export function tokenValueProblem(spec: TokenSpec, value: string, resolved: string | null): string | null {
  if (typeof value !== "string" || !value.trim()) return "el valor está vacío";
  if (value.length > 500) return "el valor es demasiado largo";
  if (UNSAFE.test(value.replace(/\{[a-z0-9.-]+\}/gi, "")))
    return "el valor tiene caracteres que no van en un token (; { } < > url() @import)";
  const v = (resolved ?? value).trim();
  switch (spec.type) {
    case "color":
      return parseCssColor(v) ? null : "no es un color que se pueda medir (hexadecimal, rgb o color-mix en srgb, o una referencia)";
    case "length": {
      if (/^(clamp|min|max|calc)\(/.test(v)) return null;
      const n = px(v);
      if (n === null) return "no es una longitud (px o rem)";
      if (spec.min !== undefined && n < spec.min) return `debe ser al menos ${spec.min} px`;
      if (spec.max !== undefined && n > spec.max) return `admite como mucho ${spec.max} px`;
      return null;
    }
    case "duration": {
      const n = ms(v);
      if (n === null) return "no es una duración (ms o s)";
      if (spec.max !== undefined && n > spec.max) return `admite como mucho ${spec.max} ms`;
      return null;
    }
    case "number": {
      const n = Number(v);
      if (!Number.isFinite(n)) return "no es un número";
      if (spec.min !== undefined && n < spec.min) return `debe ser al menos ${spec.min}`;
      if (spec.max !== undefined && n > spec.max) return `admite como mucho ${spec.max}`;
      return null;
    }
    case "easing":
      return /^(cubic-bezier\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)|linear|ease(-in|-out|-in-out)?)$/.test(v)
        ? null
        : "no es una curva (cubic-bezier(…) o ease)";
    default:
      return null;
  }
}

/** Referencias de un valor de marca (`{accent}`, `{p.red-500}`) como CSS: `var(--z-accent)` y el primitivo literal. */
export function brandValueToCss(value: string, brand: BrandFile): string {
  return value.replace(/\{([a-z0-9.-]+)\}/gi, (all, ref: string) =>
    ref.startsWith("p.") ? (brand.primitives[ref.slice(2)] ?? all) : `var(--z-${ref})`,
  );
}

/** Editor de una marca: parte de una de serie (por nombre) o de un archivo de marca. */
export function createBrandEditor(tokens: CatalogTokens, from: string | BrandFile = tokens.defaultBrand): BrandEditor {
  const start = typeof from === "string" ? tokens.brandFiles[from] : from;
  if (!start) throw new Error(`no existe la marca «${String(from)}» (${Object.keys(tokens.brandFiles).join(", ")})`);
  const initial = clone(start);
  const brand: BrandFile = clone(start);
  brand.themes ??= { dark: {}, light: {} };
  const byName = new Map(tokens.tokens.map((t) => [t.name, t]));
  const themesOf = (theme?: Theme): Theme[] => (theme ? [theme] : ["dark", "light"]);
  const bucket = (spec: TokenSpec, theme: Theme): Record<string, string> => {
    if (spec.scope === "theme") return brand.themes[theme];
    const key = spec.scope === "scale" ? "scale" : "component";
    if (!brand[key]) brand[key] = {};
    return brand[key] as Record<string, string>;
  };
  const original = (spec: TokenSpec, theme: Theme, name: string) =>
    spec.scope === "theme" ? initial.themes[theme][name] : spec.scope === "scale" ? initial.scale?.[name] : initial.component?.[name];

  return {
    specs: tokens.tokens,
    spec: (name) => byName.get(name),
    get(name, theme = "dark") {
      const spec = byName.get(name);
      if (!spec) return undefined;
      return (
        bucket(spec, theme)[name] ??
        (spec.scope === "theme" ? tokens.base.semantic[name] : undefined) ??
        tokens.base[spec.scope === "component" ? "component" : "scale"][name]
      );
    },
    resolve: (name, theme = "dark") => expandToken(name, brand, theme, tokens.base),
    set(name, value, theme) {
      const spec = byName.get(name);
      if (!spec) return [{ token: name, message: "el token no existe" }];
      const problems: TokenProblem[] = [];
      for (const t of themesOf(spec.scope === "theme" ? theme : "dark")) {
        const target = bucket(spec, t);
        const before = target[name];
        target[name] = value;
        let resolved: string | null = null;
        try {
          resolved = expandToken(name, brand, t, tokens.base);
        } catch (error) {
          problems.push({ token: name, theme: t, message: error instanceof Error ? error.message : String(error) });
        }
        const problem = problems.length ? null : tokenValueProblem(spec, value, resolved);
        if (problem) problems.push({ token: name, theme: spec.scope === "theme" ? t : undefined, message: problem });
        if (problems.length) {
          if (before === undefined) delete target[name];
          else target[name] = before;
        }
      }
      return problems;
    },
    reset(name, theme) {
      const spec = byName.get(name);
      if (!spec) return;
      for (const t of themesOf(theme)) {
        const target = bucket(spec, t);
        const prev = original(spec, t, name);
        if (prev === undefined) delete target[name];
        else target[name] = prev;
      }
    },
    cssVariables(theme) {
      const out: Record<string, string> = {};
      const scan = (now: Record<string, string> | undefined, was: Record<string, string> | undefined) => {
        for (const [k, v] of Object.entries(now ?? {})) if (was?.[k] !== v) out[k] = brandValueToCss(v, brand);
        for (const k of Object.keys(was ?? {}))
          if (!(k in (now ?? {}))) out[k] = brandValueToCss(expandToken(k, brand, theme, tokens.base) ?? "", brand);
      };
      scan(brand.themes[theme], initial.themes[theme]);
      scan(brand.scale, initial.scale);
      scan(brand.component, initial.component);
      return out;
    },
    contrast: () => checkContrast(brand, tokens),
    export() {
      const out = clone(brand);
      for (const k of ["scale", "component"] as const) if (out[k] && !Object.keys(out[k] as object).length) delete out[k];
      const errors = validateSchema(out, tokens.brandSchema);
      if (errors.length)
        throw new Error(`la marca no cumple brand.schema.json: ${errors.map((e) => `${e.pointer} ${e.message}`).join("; ")}`);
      return out;
    },
  };
}
