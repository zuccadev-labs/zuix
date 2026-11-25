// @zuccadev-labs/zuix-zui/editor — conector para editores visuales de páginas por bloques.
//
// Contrato estable y versionado que cualquier editor puede consumir sin conocer React:
//   catálogo     editor/catalog.json (`@zuccadev-labs/zuix-zui/editor/catalog.json`), con su esquema y sus tipos
//   documento    árbol JSON de nodos (validateDocument, migrateDocument, operaciones de ./tree)
//   salidas      toHTML (marcado de html.json), toTrustedHTML, renderToDOM (con /dom), toReact (en /editor/react)
//   puente       createCanvas (dentro del iframe) y connectCanvas (en el editor), sobre postMessage con MessagePort
//   marca        createBrandEditor: tokens con tipo y rango, CSS en vivo, contraste y archivo de marca
// No hace nada al importarse. Ver docs/users/12-conectar-un-editor.md.

import { BUILTIN_BLOCKS } from "./blocks";
import { type HtmlOptions, toHTML as render, trusted } from "./render";
import type { PageDocument } from "./types";

export * from "./types";
export {
  CHILDREN,
  createDocument,
  findNode,
  idGenerator,
  insertNode,
  locate,
  mapTree,
  moveNode,
  pathTo,
  removeNode,
  slotOf,
  slotsOf,
  textOf,
  updateProps,
  updateStyle,
  updateText,
  walk,
  withNewIds,
} from "./tree";
export type { Location, NodePath } from "./tree";
export { validateSchema, type SchemaError } from "./json-schema";
export { DOCUMENT_JSON_SCHEMA, DOCUMENT_SCHEMA_ID } from "./document-schema";
export { validateDocument, type Issue, type IssueCode, type ValidateOptions, type ValidationResult } from "./validate";
export { migrateDocument, versionOf, type MigrateOptions, type MigrationResult } from "./migrate";
export { DEFAULT_STYLE, RenderError, accepts, safeUrl, type BlockSpec, type HtmlOptions, type RenderContext } from "./render";
export { BUILTIN_BLOCKS, CORE_BLOCKS, ZOUT_BLOCKS, ZUI_BLOCKS } from "./blocks";
export { fromHTML, type ParseResult } from "./parse";
export { defaultHydrator, renderToDOM, toDOM, type DomOptions, type DomView, type Hydrator } from "./dom";
export { createOverlay, type Overlay, type OverlayKind } from "./overlay";
export * from "./protocol";
export {
  CanvasError,
  connectCanvas,
  createCanvas,
  type Canvas,
  type CanvasConnection,
  type CanvasOptions,
  type ConnectOptions,
} from "./bridge";
export { brandValueToCss, createBrandEditor, tokenValueProblem, type BrandEditor, type Theme, type TokenProblem } from "./brand";
export { checkContrast, expandToken, parseCssColor, type ContrastFailure, type ContrastReport } from "./contrast";
export type { BlockType } from "./blocks.generated";
export { BLOCK_TYPES } from "./blocks.generated";

/** Marcado estándar del documento (el de `html.json`), con texto y atributos escapados y URL filtradas. */
export function toHTML(doc: PageDocument, o: HtmlOptions = {}): string {
  return render(doc, { ...o, builtins: BUILTIN_BLOCKS });
}

/** `toHTML` como TrustedHTML de la política `zuix-zui`, para `innerHTML` con `require-trusted-types-for 'script'`. */
export function toTrustedHTML(doc: PageDocument, o: HtmlOptions = {}): string {
  return trusted(toHTML(doc, o));
}
