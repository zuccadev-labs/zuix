// Validación de un documento de página contra el catálogo. Devuelve errores legibles con un código estable (para
// que un editor los traduzca o los agrupe), el nodo y su ruta. Pura y sin documento del navegador.

import { DOCUMENT_JSON_SCHEMA } from "./document-schema";
import { type SchemaError, pointerOf, validateSchema } from "./json-schema";
import { accepts } from "./render";
import { CHILDREN, slotsOf, textOf, walk } from "./tree";
import { type Catalog, type CatalogBlock, DOCUMENT_SCHEMA_VERSION, type JsonSchema, type PageNode, isText } from "./types";

export type IssueCode =
  | "document.shape"
  | "document.version"
  | "node.duplicate-id"
  | "node.unknown-type"
  | "node.preset"
  | "node.no-html"
  | "prop.invalid"
  | "prop.icon"
  | "prop.read-only"
  | "nesting.not-allowed"
  | "nesting.unknown-slot"
  | "nesting.max"
  | "nesting.required"
  | "nesting.parent"
  | "nesting.interactive"
  | "style.invalid"
  | "a11y.name"
  | "a11y.alt"
  | "a11y.text"
  | "a11y.heading-order"
  | "a11y.multiple-h1";

export interface Issue {
  code: IssueCode;
  severity: "error" | "warning";
  /** Texto para una persona: dice qué nodo, dónde y qué falla. */
  message: string;
  nodeId?: string;
  /** Ids desde el cuerpo hasta el nodo. */
  path: string[];
  /** Puntero JSON dentro del documento. */
  pointer: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Issue[];
  warnings: Issue[];
}

export interface ValidateOptions {
  /** Exige que todo el documento salga en HTML (rechaza bloques `none`). Por defecto no. */
  html?: boolean;
}

const BODY_RULE = { accepts: ["flow" as const] };

/** Valida un documento. `valid` es falso si hay algún error; los avisos no lo invalidan. */
export function validateDocument(doc: unknown, catalog: Catalog, o: ValidateOptions = {}): ValidationResult {
  const issues: Issue[] = [];
  const add = (
    code: IssueCode,
    message: string,
    at: { nodeId?: string; path?: string[]; pointer?: string } = {},
    severity: Issue["severity"] = "error",
  ) => issues.push({ code, severity, message, nodeId: at.nodeId, path: at.path ?? [], pointer: at.pointer ?? "" });

  if (doc && typeof doc === "object" && (doc as { schemaVersion?: unknown }).schemaVersion !== DOCUMENT_SCHEMA_VERSION) {
    const v = (doc as { schemaVersion?: unknown }).schemaVersion;
    add(
      "document.version",
      `el documento es de la versión ${JSON.stringify(v)} del esquema y esta es la ${DOCUMENT_SCHEMA_VERSION}: súbelo con migrateDocument()`,
      {
        pointer: "/schemaVersion",
      },
    );
    return finish(issues);
  }
  const shape = validateSchema(doc, DOCUMENT_JSON_SCHEMA);
  if (shape.length) {
    for (const e of collapse(shape)) add("document.shape", `${e.pointer || "/"}: ${e.message}`, { pointer: e.pointer });
    return finish(issues);
  }
  const page = doc as { body: PageNode[] };
  const byType = new Map(catalog.blocks.map((b) => [b.type, b]));
  const icons = new Set(catalog.icons);
  const pointers = new Map<string, string>();
  const seen = new Set<string>();
  // Punteros JSON de cada nodo, para que el editor marque el campo exacto.
  const index = (list: PageNode[], base: (string | number)[]) =>
    list.forEach((node, i) => {
      const here = [...base, i];
      if (!pointers.has(node.id)) pointers.set(node.id, pointerOf(here));
      if (!isText(node)) {
        if (node.children) index(node.children, [...here, "children"]);
        for (const [name, kids] of Object.entries(node.slots ?? {})) index(kids, [...here, "slots", name]);
      }
    });
  index(page.body, ["body"]);

  const name = (node: PageNode, path: string[]) =>
    `${node.type} «${node.id}»${path.length > 1 ? ` (en ${path.slice(0, -1).join(" › ")})` : ""}`;
  const parents = new Map<string, PageNode>();

  walk(page.body, (node, path, at) => {
    const where = { nodeId: node.id, path, pointer: pointers.get(node.id) ?? "" };
    if (seen.has(node.id)) add("node.duplicate-id", `el id «${node.id}» está repetido`, where);
    seen.add(node.id);
    const parent = at.parent === null ? null : (parents.get(at.parent) ?? null);
    const parentBlock = parent && !isText(parent) ? byType.get(parent.type) : undefined;
    const rule = parent === null ? BODY_RULE : at.slot === CHILDREN ? parentBlock?.children : parentBlock?.slots[at.slot];

    if (isText(node)) {
      if (parent === null || (parentBlock && !accepts(rule, { type: "#text", categories: [] })))
        add(
          "nesting.not-allowed",
          `${parent ? `${parent.type} «${parent.id}»` : "el cuerpo"} no admite texto${at.slot !== CHILDREN ? ` en «${at.slot}»` : ""}`,
          where,
        );
      return;
    }
    parents.set(node.id, node);
    const block = byType.get(node.type);
    if (!block) {
      add("node.unknown-type", `${name(node, path)}: el tipo no existe en el catálogo de zuix ${catalog.zuix}`, where);
      return;
    }
    if (o.html && block.html === "none") add("node.no-html", `${name(node, path)}: no tiene contrato HTML (solo sale por toReact)`, where);

    // Anidado.
    if (parentBlock || parent === null) {
      if (parent && !rule) add("nesting.unknown-slot", `${parent.type} «${parent.id}» no tiene el hueco «${at.slot}»`, where);
      else if (!accepts(rule, block))
        add(
          "nesting.not-allowed",
          `${name(node, path)} no puede ir ${parent ? `dentro de ${parent.type}${at.slot !== CHILDREN ? ` (hueco «${at.slot}»)` : ""}` : "en el cuerpo de la página"}`,
          where,
        );
    }
    if (block.parents && (!parent || !block.parents.includes(parent.type)))
      add("nesting.parent", `${name(node, path)} solo puede ir dentro de ${block.parents.join(" o ")}`, where);
    if (block.categories.includes("interactive")) {
      const ancestor = path
        .slice(0, -1)
        .map((id) => parents.get(id))
        .find((p) => p && !isText(p) && byType.get(p.type)?.categories.includes("interactive"));
      if (ancestor)
        add(
          "nesting.interactive",
          `${name(node, path)} es interactivo y está dentro de otro control (${ancestor.type} «${ancestor.id}»)`,
          where,
        );
    }
    for (const [slot, kids] of slotsOf(node)) {
      const r = slot === CHILDREN ? block.children : block.slots[slot];
      if (r?.max !== undefined && kids.length > r.max)
        add("nesting.max", `${name(node, path)}: «${slot}» admite como mucho ${r.max}`, where);
    }
    for (const [slot, r] of Object.entries(block.slots)) {
      if (r.required && !(node.slots?.[slot]?.length ?? 0)) add("nesting.required", `${name(node, path)}: falta «${slot}»`, where);
    }

    // Props.
    if (block.html === "preset") {
      if (!block.presets.some((p) => p.id === node.preset))
        add(
          "node.preset",
          `${name(node, path)}: necesita un preset del catálogo (${block.presets.map((p) => p.id).join(", ") || "no tiene"})`,
          where,
        );
      if (node.props && Object.keys(node.props).length)
        add("prop.read-only", `${name(node, path)}: sus props no se editan, salen del preset`, where);
    } else {
      const errors = validateSchema(node.props ?? {}, block.props);
      for (const e of collapse(errors))
        add("prop.invalid", `${name(node, path)}: ${propLabel(e)}${e.message}`, {
          ...where,
          pointer: `${where.pointer}/props${e.pointer}`,
        });
      for (const [prop, schema] of Object.entries(block.props.properties)) {
        const value = node.props?.[prop];
        if (isIcon(schema) && typeof value === "string" && !icons.has(value))
          add("prop.icon", `${name(node, path)}: el icono «${value}» no existe en zicon`, {
            ...where,
            pointer: `${where.pointer}/props/${prop}`,
          });
      }
    }
    // Estilo.
    for (const [key, value] of Object.entries(node.style ?? {})) {
      const spec = catalog.style[key];
      const ok = spec && typeof value === "string" && (spec.keywords?.includes(value) || spec.tokens?.includes(value));
      if (!ok)
        add(
          "style.invalid",
          spec
            ? `${name(node, path)}: «${value}» no es un valor de ${key} (tokens: ${(spec.tokens ?? spec.keywords ?? []).slice(0, 6).join(", ")}…)`
            : `${name(node, path)}: «${key}» no es una propiedad de estilo admitida`,
          { ...where, pointer: `${where.pointer}/style/${key}` },
        );
    }
    // Accesibilidad.
    for (const rule of block.a11y) {
      if (rule.rule === "name") {
        const named =
          rule.props.some((p) => typeof node.props?.[p] === "string" && String(node.props[p]).trim()) || (rule.text && textOf(node).trim());
        if (!named) add("a11y.name", `${name(node, path)}: ${rule.message}`, where);
      } else if (rule.rule === "alt") {
        if (typeof node.props?.[rule.prop] !== "string") add("a11y.alt", `${name(node, path)}: ${rule.message}`, where);
      } else if (rule.rule === "required-text") {
        const list = rule.slot === CHILDREN ? node.children : node.slots?.[rule.slot];
        if (!(list ?? []).map(textOf).join("").trim()) add("a11y.text", `${name(node, path)}: ${rule.message}`, where);
      }
    }
  });

  headings(page.body, (code, message, node, path) =>
    add(code, message, { nodeId: node.id, path, pointer: pointers.get(node.id) }, "warning"),
  );
  return finish(issues);
}

const isIcon = (s: JsonSchema) => s["x-control"] === "icon" || s.anyOf?.some((x) => x["x-control"] === "icon");

function propLabel(e: SchemaError): string {
  const prop = e.pointer.split("/")[1];
  return prop ? `la prop «${prop.replace(/~1/g, "/").replace(/~0/g, "~")}» ` : "";
}

/** Un `oneOf`/`anyOf` que falla arrastra los errores de cada rama: se queda el más útil por puntero. */
function collapse(errors: SchemaError[]): SchemaError[] {
  const by = new Map<string, SchemaError>();
  for (const e of errors) {
    const prev = by.get(e.pointer);
    if (!prev || (prev.keyword === "oneOf" && e.keyword !== "oneOf")) by.set(e.pointer, e);
  }
  return [...by.values()];
}

/** Orden de los títulos: un solo h1 y sin saltos de nivel (de h2 a h4). Avisos, no errores. */
function headings(
  body: PageNode[],
  warn: (code: "a11y.heading-order" | "a11y.multiple-h1", message: string, node: PageNode, path: string[]) => void,
) {
  let last = 0;
  let h1 = 0;
  walk(body, (node, path) => {
    if (isText(node)) return;
    const level =
      node.type === "Heading"
        ? Number(node.props?.level ?? 2)
        : node.type === "LandingHero"
          ? 1
          : node.type === "PageHeader"
            ? Number(node.props?.headingLevel ?? 1)
            : 0;
    if (!level) return;
    if (level === 1 && ++h1 === 2)
      warn("a11y.multiple-h1", `${node.type} «${node.id}»: la página ya tiene un título de nivel 1`, node, path);
    if (last && level > last + 1) warn("a11y.heading-order", `${node.type} «${node.id}»: salta del nivel ${last} al ${level}`, node, path);
    last = level;
  });
}

function finish(issues: Issue[]): ValidationResult {
  const errors = issues.filter((i) => i.severity === "error");
  return { valid: errors.length === 0, errors, warnings: issues.filter((i) => i.severity === "warning") };
}

export type { CatalogBlock };
