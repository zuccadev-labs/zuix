// Forma del documento de página como JSON Schema 2020-12. Es la fuente de `editor/document.schema.json` (lo escribe
// `tools/editor-catalog.mjs`) y la que usa `validateDocument` para la forma; el catálogo valida después lo que
// depende de cada bloque (props, huecos, anidado, accesibilidad).

import { DOCUMENT_FORMAT, DOCUMENT_SCHEMA_VERSION, type JsonSchema } from "./types";

export const DOCUMENT_SCHEMA_ID = "https://zuix.dev/schemas/editor/document.schema.json";

export const DOCUMENT_JSON_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: DOCUMENT_SCHEMA_ID,
  title: "Documento de página de zuix",
  description: "Árbol de bloques del catálogo de zuix. Lo produce un editor visual y lo serializan toHTML, renderToDOM y toReact.",
  type: "object",
  required: ["format", "schemaVersion", "body"],
  additionalProperties: false,
  properties: {
    $schema: { type: "string" },
    format: { const: DOCUMENT_FORMAT },
    schemaVersion: { const: DOCUMENT_SCHEMA_VERSION },
    zuix: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?$" },
    title: { type: "string", maxLength: 300 },
    lang: { type: "string", pattern: "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$" },
    dir: { enum: ["ltr", "rtl"] },
    theme: {
      type: "object",
      additionalProperties: false,
      properties: {
        brand: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
        theme: { enum: ["dark", "light"] },
        tokens: {
          type: "object",
          propertyNames: { pattern: "^[a-z][a-z0-9-]*$" },
          additionalProperties: { type: "string", maxLength: 500 },
        },
      },
    },
    body: { $ref: "#/$defs/nodes" },
  },
  $defs: {
    id: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_-]{0,63}$" },
    nodes: { type: "array", items: { $ref: "#/$defs/node" } },
    node: { oneOf: [{ $ref: "#/$defs/text" }, { $ref: "#/$defs/element" }] },
    text: {
      type: "object",
      required: ["id", "type", "text"],
      additionalProperties: false,
      properties: { id: { $ref: "#/$defs/id" }, type: { const: "#text" }, text: { type: "string", maxLength: 20000 } },
    },
    element: {
      type: "object",
      required: ["id", "type"],
      additionalProperties: false,
      properties: {
        id: { $ref: "#/$defs/id" },
        type: { type: "string", pattern: "^[A-Z][A-Za-z0-9]*$" },
        props: { type: "object", propertyNames: { pattern: "^[A-Za-z][A-Za-z0-9]*$" } },
        children: { $ref: "#/$defs/nodes" },
        slots: { type: "object", propertyNames: { pattern: "^[a-z][A-Za-z0-9]*$" }, additionalProperties: { $ref: "#/$defs/nodes" } },
        style: {
          type: "object",
          propertyNames: { pattern: "^[a-z][A-Za-z]*$" },
          additionalProperties: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
        },
        preset: { type: "string", pattern: "^[a-z0-9][a-z0-9-]*$" },
      },
    },
  },
};
