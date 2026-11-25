// Tipos del conector de editor visual: el catálogo de bloques, el documento de página y lo que comparten. Solo
// tipos y constantes de versión: ningún módulo de aquí toca el documento ni importa React.

import type { AdaptiveSpec, AdaptiveTemplates } from "./adaptive";

/** Versión del esquema de `editor/catalog.json`. Sube cuando cambia su forma, no cuando cambian los bloques. */
export const CATALOG_SCHEMA_VERSION = 1;
/** Versión del formato del documento de página. Un documento anterior se sube con `migrateDocument`. */
export const DOCUMENT_SCHEMA_VERSION = 1;
/** Identificador del formato del documento (`format`). */
export const DOCUMENT_FORMAT = "zuix.page";

/** Valor serializable en JSON: lo único que puede llevar una prop de un documento. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// ── Catálogo ──────────────────────────────────────────────────────────────────────────────────────────────

/** Control de edición sugerido para una prop. El editor elige el widget; el catálogo solo da la intención. */
export type EditorControl = "text" | "number" | "select" | "token-color" | "icon" | "switch" | "image" | "link" | "json";

/**
 * Subconjunto de JSON Schema 2020-12 que emite el catálogo, con dos anotaciones propias (`x-control` y
 * `x-token`). Un validador de JSON Schema estándar lo acepta tal cual: las claves `x-*` se ignoran.
 */
export interface JsonSchema {
  $schema?: string;
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  title?: string;
  description?: string;
  type?:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "null"
    | "object"
    | "array"
    | Array<"string" | "number" | "integer" | "boolean" | "null" | "object" | "array">;
  enum?: JsonValue[];
  const?: JsonValue;
  default?: JsonValue;
  examples?: JsonValue[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  multipleOf?: number;
  items?: JsonSchema | boolean;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: JsonSchema | boolean;
  propertyNames?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema;
  readOnly?: boolean;
  deprecated?: boolean;
  "x-control"?: EditorControl;
  /** Con `x-control: "token-color"`: familia de tokens admitida (`text`, `surface`, `tone`). */
  "x-token"?: string;
}

/**
 * Cómo sale un bloque en HTML:
 * - `template`: el conector lo serializa desde sus props (`toHTML`, `renderToDOM`).
 * - `preset`: solo con uno de sus presets, cuyo marcado viene del contrato (`html.json`); las props no se editan.
 * - `none`: no tiene contrato HTML estático; solo sale por `toReact`.
 */
export type HtmlSupport = "template" | "preset" | "none";

/** Categoría de contenido, como en HTML: `phrasing` va dentro de un párrafo; `interactive` no anida en sí misma. */
export type ContentCategory = "flow" | "phrasing" | "interactive" | "heading" | "sectioning";

/** Qué admite un hueco: por categoría, por tipo concreto o texto. `max` limita el número de hijos. */
export interface SlotRule {
  description?: string;
  /** Categorías admitidas. Un hijo entra si comparte alguna (o si su tipo está en `types`). */
  accepts?: ContentCategory[];
  /** Tipos admitidos además de las categorías. */
  types?: string[];
  /** Categorías rechazadas aunque coincidan con `accepts` (un botón no admite otro control). */
  rejects?: ContentCategory[];
  /** Admite nodos de texto (`#text`). */
  text?: boolean;
  max?: number;
  required?: boolean;
}

/** Restricción de accesibilidad que comprueba `validateDocument`. */
export type A11yRule =
  | { rule: "name"; props: string[]; text?: boolean; message: string }
  | { rule: "alt"; prop: string; message: string }
  | { rule: "required-text"; slot: string; message: string };

export interface BlockEvent {
  name: string;
  /** Prop del binding de React (`onClick`). */
  react: string;
  /** Evento del modo DOM (`z:change`), si lo hay. */
  dom?: string;
  type: string;
  description?: string;
}

export interface BlockPreset {
  id: string;
  title: string;
  /** Árbol del preset, si el ejemplo se puede expresar como documento (props JSON). */
  node?: PageNode;
  /** Marcado del contrato para este preset (bloques `preset`). */
  html?: string;
  /** Script de `html.json` que necesita el marcado, si lo hay. */
  script?: string;
}

export interface BlockVariant {
  prop: string;
  value: JsonValue;
  label: string;
}

export interface CatalogBlock {
  /** Tipo en el documento: el nombre del componente (`Button`) o un bloque del conector (`Heading`). */
  type: string;
  package: "zui" | "zout" | "core";
  group: string;
  title: string;
  description: string;
  /** Nombre de icono de zicon para la paleta del editor. */
  icon: string;
  /** Import del binding de React. */
  import?: string;
  html: HtmlSupport;
  /** `none`: solo CSS. `dom`: necesita `@zuccadev-labs/zuix-zui/dom` (o `zout/dom`) para comportarse. */
  behavior: "none" | "dom";
  /** Contenedor de maquetación (Grid, Stack, Container…): el editor lo trata como zona de soltar. */
  layout: boolean;
  categories: ContentCategory[];
  /** Props como objeto de JSON Schema 2020-12. */
  props: JsonSchema & { type: "object"; properties: Record<string, JsonSchema> };
  /** Hijos (hueco por defecto). Ausente: el bloque no admite hijos. */
  children?: SlotRule;
  /** Huecos con nombre (`actions`, `footer`…). */
  slots: Record<string, SlotRule>;
  /** Solo puede ir dentro de estos tipos (CardHeader dentro de Card). */
  parents?: string[];
  variants: BlockVariant[];
  presets: BlockPreset[];
  events: BlockEvent[];
  a11y: A11yRule[];
  /** Clases del contrato que emite. */
  classes: string[];
  /** El componente llega de otra rama y su marcado es provisional hasta integrarlo. */
  provisional?: string;
  /** Adaptativo: variantes que admite por clase de tamaño y, si es un layout adaptativo, sus plantillas por defecto. */
  adaptive?: {
    variants?: { value: string; label: string; description?: string }[];
    layout?: { templates: AdaptiveTemplates; measure: "container" | "viewport" };
  };
}

export interface TokenSpec {
  name: string;
  /** Familia de valor: decide el control y la validación. */
  type: "color" | "length" | "duration" | "number" | "font" | "shadow" | "easing" | "gradient" | "other";
  group: string;
  /** Si una marca lo puede fijar por tema (`themes.dark`, `themes.light`) o solo una vez (`scale`, `component`). */
  scope: "theme" | "scale" | "component";
  /** Rango admitido para longitudes y duraciones, en px o ms. */
  min?: number;
  max?: number;
  /** Valor de la marca por defecto, por tema cuando es de tema. */
  default: string | { dark: string; light: string };
}

export interface ContrastSurface {
  over?: "canvas";
  layers: string[];
}

/** Lo que mide `tokens/src/validate.mjs`, copiado al catálogo para medir lo mismo en el navegador. */
export interface ContrastSpec {
  surfaces: Record<string, ContrastSurface>;
  text: string[];
  canvasText: string[];
  pairs: { fg: string; bg: string; min: number }[];
  nonText: string[];
  /** Usos reales de las hojas de zui y zout (texto sobre fondo y bordes de control). */
  uses: { fg: string; bg?: string; min: number; key: string; where: string }[];
  borders: { token: string; key: string; where: string }[];
  /** Pares que ya fallan en la marca de serie y están anotados como pendientes en tokens. */
  pending: string[];
}

export interface CatalogTokens {
  defaultBrand: string;
  themes: string[];
  brands: string[];
  /** Esquema de un archivo de marca (el de `@zuccadev-labs/zuix-tokens/schema/brand.schema.json`). */
  brandSchema: JsonSchema;
  tokens: TokenSpec[];
  contrast: ContrastSpec;
  /** Base para expandir referencias (`{accent}`): lo que no fija la marca. */
  base: { scale: Record<string, string>; semantic: Record<string, string>; component: Record<string, string> };
  /** Marcas de serie, con su forma de archivo de marca. */
  brandFiles: Record<string, BrandFile>;
}

/** Valores admitidos por cada propiedad de `style` de un nodo: nombres de token, o palabras clave. */
export type StyleSpec = Record<string, { css: string; tokens?: string[]; keywords?: string[] }>;

export interface Catalog {
  $schema?: string;
  schemaVersion: number;
  /** Versión de zuix que generó el catálogo. */
  zuix: string;
  documentSchemaVersion: number;
  protocolVersion: number;
  blocks: CatalogBlock[];
  /** Nombres de icono válidos de zicon. */
  icons: string[];
  style: StyleSpec;
  tokens: CatalogTokens;
}

// ── Documento ─────────────────────────────────────────────────────────────────────────────────────────────

/** Estilo de un nodo limitado a tokens: `{ padding: "space-4", background: "surface-2" }`. */
export type NodeStyle = Partial<Record<string, string>>;

export interface TextNode {
  id: string;
  type: "#text";
  text: string;
}

export interface ElementNode {
  id: string;
  type: string;
  props?: Record<string, JsonValue>;
  children?: PageNode[];
  slots?: Record<string, PageNode[]>;
  style?: NodeStyle;
  /** Preset de origen (`Calendar/basico`). Obligatorio en bloques `preset`. */
  preset?: string;
  /** Orden, área, visibilidad, columnas, variante y props por clase de tamaño (de móvil hacia arriba). */
  adaptive?: AdaptiveSpec;
}

export type PageNode = ElementNode | TextNode;

export interface PageDocument {
  $schema?: string;
  format: typeof DOCUMENT_FORMAT;
  schemaVersion: number;
  /** Versión de zuix con la que se guardó (informativa: las migraciones van por `schemaVersion`). */
  zuix?: string;
  title?: string;
  lang?: string;
  dir?: "ltr" | "rtl";
  /** Marca, tema y tokens sobrescritos que necesita la página. */
  theme?: { brand?: string; theme?: "dark" | "light"; tokens?: Record<string, string> };
  body: PageNode[];
}

/** Archivo de marca, con la forma de `tokens/schema/brand.schema.json`. */
export interface BrandFile {
  $schema?: string;
  name: string;
  label?: string;
  primitives: Record<string, string>;
  fonts: { display?: string; sans: string; mono: string };
  scale?: Record<string, string>;
  component?: Record<string, string>;
  themes: { dark: Record<string, string>; light: Record<string, string> };
}

export const isText = (node: PageNode): node is TextNode => node.type === "#text";
