// Validador del subconjunto de JSON Schema 2020-12 que usan el catálogo, el documento y las props de los bloques.
// Sin dependencias: cubre type, enum, const, pattern, longitudes, rangos, items, properties, required,
// additionalProperties, propertyNames, anyOf, oneOf, allOf, not y $ref locales (#/$defs/…). Las palabras que no
// conoce (format, x-control…) se ignoran, como pide la especificación para las anotaciones.

import type { JsonSchema } from "./types";

export interface SchemaError {
  /** Puntero JSON (RFC 6901) al valor que falla: `/body/0/props/variant`. */
  pointer: string;
  keyword: string;
  message: string;
}

const kind = (v: unknown): string =>
  v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v === "number" ? "number" : typeof v;

const matchesType = (v: unknown, t: string) => {
  const k = kind(v);
  return t === k || (t === "number" && k === "integer");
};

const escapePointer = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");
export const pointerOf = (parts: readonly (string | number)[]) => parts.map((p) => `/${escapePointer(String(p))}`).join("");

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === (b as unknown[]).length && a.every((x, i) => equal(x, (b as unknown[])[i]));
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return (
    ka.length === kb.length &&
    ka.every((k) => Object.hasOwn(b as object, k) && equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema {
  if (!ref.startsWith("#")) throw new Error(`$ref no local: ${ref}`);
  let node: unknown = root;
  for (const raw of ref.slice(1).split("/").filter(Boolean)) {
    const part = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  if (!node || typeof node !== "object") throw new Error(`$ref sin destino: ${ref}`);
  return node as JsonSchema;
}

// Expresiones de `pattern` compiladas una vez. Las del catálogo son fijas; un patrón inválido es un error del esquema.
const patterns = new Map<string, RegExp>();
const regex = (p: string) => {
  let r = patterns.get(p);
  if (!r) {
    r = new RegExp(p, "u");
    patterns.set(p, r);
  }
  return r;
};

/** Valida `value` contra `schema`. Devuelve la lista de errores (vacía si es válido). */
export function validateSchema(
  value: unknown,
  schema: JsonSchema | boolean,
  root: JsonSchema | boolean = schema,
  at: (string | number)[] = [],
): SchemaError[] {
  if (schema === true) return [];
  const pointer = pointerOf(at);
  if (schema === false) return [{ pointer, keyword: "false", message: "no se admite ningún valor" }];
  const errors: SchemaError[] = [];
  const fail = (keyword: string, message: string) => errors.push({ pointer, keyword, message });
  const rootSchema = typeof root === "boolean" ? schema : root;

  if (schema.$ref) errors.push(...validateSchema(value, resolveRef(schema.$ref, rootSchema), rootSchema, at));
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      fail("type", `se esperaba ${types.join(" o ")} y llegó ${kind(value) === "integer" ? "number" : kind(value)}`);
      return errors;
    }
  }
  if (schema.const !== undefined && !equal(value, schema.const)) fail("const", `debe ser ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => equal(e, value)))
    fail("enum", `${JSON.stringify(value)} no es un valor admitido (${schema.enum.map((e) => JSON.stringify(e)).join(", ")})`);

  if (typeof value === "string") {
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) fail("minLength", `necesita al menos ${schema.minLength} caracteres`);
    if (schema.maxLength !== undefined && length > schema.maxLength) fail("maxLength", `admite como mucho ${schema.maxLength} caracteres`);
    if (schema.pattern !== undefined && !regex(schema.pattern).test(value))
      fail("pattern", `no tiene la forma esperada (${schema.pattern})`);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("type", "debe ser un número finito");
    if (schema.minimum !== undefined && value < schema.minimum) fail("minimum", `debe ser ≥ ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail("maximum", `debe ser ≤ ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum)
      fail("exclusiveMinimum", `debe ser > ${schema.exclusiveMinimum}`);
    if (schema.multipleOf !== undefined && Math.abs(value / schema.multipleOf - Math.round(value / schema.multipleOf)) > 1e-9)
      fail("multipleOf", `debe ser múltiplo de ${schema.multipleOf}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail("minItems", `necesita al menos ${schema.minItems} elementos`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail("maxItems", `admite como mucho ${schema.maxItems} elementos`);
    if (schema.uniqueItems && value.some((x, i) => value.findIndex((y) => equal(x, y)) !== i))
      fail("uniqueItems", "tiene elementos repetidos");
    if (schema.items !== undefined)
      for (const [i, item] of value.entries()) errors.push(...validateSchema(item, schema.items, rootSchema, [...at, i]));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!Object.hasOwn(obj, key)) fail("required", `falta "${key}"`);
    for (const [key, v] of Object.entries(obj)) {
      if (schema.propertyNames) {
        const bad = validateSchema(key, schema.propertyNames, rootSchema, [...at, key]);
        if (bad.length)
          errors.push({ pointer: pointerOf([...at, key]), keyword: "propertyNames", message: `el nombre "${key}" no es válido` });
      }
      const sub = schema.properties && Object.hasOwn(schema.properties, key) ? schema.properties[key] : undefined;
      if (sub !== undefined) errors.push(...validateSchema(v, sub, rootSchema, [...at, key]));
      else if (schema.additionalProperties === false)
        errors.push({
          pointer: pointerOf([...at, key]),
          keyword: "additionalProperties",
          message: `"${key}" no es una propiedad admitida`,
        });
      else if (schema.additionalProperties !== undefined && schema.additionalProperties !== true)
        errors.push(...validateSchema(v, schema.additionalProperties, rootSchema, [...at, key]));
    }
  }
  for (const sub of schema.allOf ?? []) errors.push(...validateSchema(value, sub, rootSchema, at));
  // Sin ninguna forma que encaje se dan los errores de la más cercana (la de menos errores): es la que la persona quería.
  const closest = (branches: JsonSchema[], keyword: string) => {
    const results = branches.map((s) => validateSchema(value, s, rootSchema, at));
    const matches = results.filter((r) => r.length === 0).length;
    if (matches === 0) {
      const best = results.reduce((a, b) => (b.length < a.length ? b : a));
      if (best.length && best.every((e) => e.pointer !== pointer || (e.keyword !== "type" && e.keyword !== "const"))) errors.push(...best);
      else fail(keyword, "no coincide con ninguna de las formas admitidas");
    }
    return matches;
  };
  if (schema.anyOf) closest(schema.anyOf, "anyOf");
  if (schema.oneOf && closest(schema.oneOf, "oneOf") > 1) fail("oneOf", "coincide con más de una forma");
  if (schema.not && validateSchema(value, schema.not, rootSchema, at).length === 0) fail("not", "tiene una forma no admitida");
  return errors;
}
