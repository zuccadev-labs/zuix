// Validador mínimo de JSON Schema (2020-12) para los esquemas de este paquete: `type`, `required`, `properties`,
// `additionalProperties`, `pattern`, `enum`, `minLength`, `items` y `$ref` a `#/$defs/…`. Sin dependencias.
// Una palabra clave que no conoce es un error: el esquema no puede prometer más de lo que aquí se comprueba.
const KNOWN = new Set(["$schema", "$id", "$defs", "$ref", "$comment", "title", "description", "type", "required", "properties", "additionalProperties", "pattern", "enum", "minLength", "items", "examples", "default"]);
const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" && Number.isInteger(v) ? "integer" : typeof v);

/** Errores de `value` frente a `schema`, como frases «ruta: problema». Lista vacía si es válido. */
export function validate(value, schema, root = schema, path = "") {
  const errors = [];
  const at = path || "(raíz)";
  for (const key of Object.keys(schema)) if (!KNOWN.has(key)) throw new Error(`esquema: palabra clave no admitida "${key}" en ${at}`);
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, "").split("/").reduce((node, key) => node?.[key], root);
    if (!target) throw new Error(`esquema: $ref sin destino "${schema.$ref}"`);
    return validate(value, target, root, path);
  }
  if (schema.type) {
    const actual = typeOf(value);
    const types = [schema.type].flat();
    if (!types.includes(actual) && !(actual === "integer" && types.includes("number"))) return [`${at}: se esperaba ${types.join(" o ")} y hay ${actual}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: "${value}" no es uno de ${schema.enum.join(", ")}`);
  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) errors.push(`${at}: "${value}" no cumple ${schema.pattern}`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: cadena vacía o demasiado corta`);
  }
  if (Array.isArray(value) && schema.items) value.forEach((item, i) => {
      errors.push(...validate(item, schema.items, root, `${path}[${i}]`));
    });
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${at}: falta "${key}"`);
    for (const [key, item] of Object.entries(value)) {
      const child = path ? `${path}.${key}` : key;
      if (schema.properties?.[key]) errors.push(...validate(item, schema.properties[key], root, child));
      else if (schema.additionalProperties === false) errors.push(`${child}: clave no admitida`);
      else if (typeof schema.additionalProperties === "object") errors.push(...validate(item, schema.additionalProperties, root, child));
    }
  }
  return errors;
}
