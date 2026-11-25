// Migraciones del documento de página entre versiones del esquema. Cada paso sube una versión (de N a N + 1) y es
// puro; `migrateDocument` encadena los que hagan falta. La versión 0 es la forma suelta que escribe una persona o
// un adaptador antes de tener ids: un nodo o una lista de nodos, con texto como cadenas y sin envoltura.
//
// Para cambiar el formato: se sube DOCUMENT_SCHEMA_VERSION en ./types, se añade aquí el paso desde la anterior y
// su prueba en tests/unit/editor.test.ts, y se anota en el CHANGELOG. Un documento guardado nunca se rompe: se sube.

import { idGenerator } from "./tree";
import { DOCUMENT_FORMAT, DOCUMENT_SCHEMA_VERSION, type ElementNode, type JsonValue, type PageDocument, type PageNode } from "./types";

export interface MigrateOptions {
  /** Ids para los nodos que no lo traen. Por defecto, deterministas (`m0`, `m1`…): la misma entrada da la misma salida. */
  nextId?: () => string;
}

export interface MigrationResult {
  document: PageDocument;
  /** Versión de la que partía. */
  from: number;
  /** Pasos aplicados, en orden («0→1»). */
  applied: string[];
}

type Step = (input: unknown, o: Required<MigrateOptions>) => unknown;

/** Nodo suelto de la versión 0: `type`, `props`, `children` (con cadenas como texto), `slots`, `style` y `id` opcional. */
type LooseNode =
  | string
  | {
      id?: string;
      type?: string;
      props?: Record<string, JsonValue>;
      children?: LooseNode[];
      slots?: Record<string, LooseNode[]>;
      style?: Record<string, string>;
      preset?: string;
      text?: string;
    };

const STEPS: Record<number, Step> = {
  // 0 → 1: envoltura con `format` y `schemaVersion`, ids en todos los nodos y texto como nodos `#text`.
  0: (input, o) => {
    const loose = input as
      | { body?: LooseNode[]; title?: string; lang?: string; dir?: "ltr" | "rtl"; theme?: PageDocument["theme"] }
      | LooseNode
      | LooseNode[];
    const wrapper = !Array.isArray(loose) && typeof loose === "object" && loose !== null && "body" in loose ? loose : null;
    const list: LooseNode[] = wrapper ? (wrapper.body ?? []) : Array.isArray(loose) ? loose : [loose as LooseNode];
    const doc: PageDocument = { format: DOCUMENT_FORMAT, schemaVersion: 1, body: list.map((n) => node(n, o.nextId)) };
    if (wrapper?.title !== undefined) doc.title = wrapper.title;
    if (wrapper?.lang !== undefined) doc.lang = wrapper.lang;
    if (wrapper?.dir !== undefined) doc.dir = wrapper.dir;
    if (wrapper?.theme !== undefined) doc.theme = wrapper.theme;
    return doc;
  },
};

function node(n: LooseNode, nextId: () => string): PageNode {
  if (typeof n === "string") return { id: nextId(), type: "#text", text: n };
  if (n.type === "#text") return { id: n.id ?? nextId(), type: "#text", text: n.text ?? "" };
  if (typeof n.type !== "string") throw new Error(`nodo sin tipo: ${JSON.stringify(n).slice(0, 80)}`);
  const out: ElementNode = { id: n.id ?? nextId(), type: n.type };
  if (n.props && Object.keys(n.props).length) out.props = n.props;
  if (n.children?.length) out.children = n.children.map((c) => node(c, nextId));
  if (n.slots && Object.keys(n.slots).length)
    out.slots = Object.fromEntries(Object.entries(n.slots).map(([k, v]) => [k, v.map((c) => node(c, nextId))]));
  if (n.style && Object.keys(n.style).length) out.style = n.style;
  if (n.preset) out.preset = n.preset;
  return out;
}

/** Versión del esquema de una entrada: la de `schemaVersion`, o 0 si es la forma suelta. */
export function versionOf(input: unknown): number {
  if (input && typeof input === "object" && !Array.isArray(input) && "schemaVersion" in input) {
    const v = (input as { schemaVersion: unknown }).schemaVersion;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) throw new Error(`schemaVersion no válido: ${JSON.stringify(v)}`);
    return v;
  }
  return 0;
}

/**
 * Sube un documento a la versión actual. Un documento ya actual se devuelve tal cual (misma referencia). Una versión
 * posterior a la que conoce este paquete lanza: hay que actualizar zuix, no adivinar.
 */
export function migrateDocument(input: unknown, o: MigrateOptions = {}): MigrationResult {
  const from = versionOf(input);
  if (from > DOCUMENT_SCHEMA_VERSION)
    throw new Error(
      `el documento es de la versión ${from} del esquema y este zuix solo conoce hasta la ${DOCUMENT_SCHEMA_VERSION}: actualiza el paquete`,
    );
  const opts: Required<MigrateOptions> = { nextId: o.nextId ?? idGenerator("m") };
  let doc: unknown = input;
  const applied: string[] = [];
  for (let v = from; v < DOCUMENT_SCHEMA_VERSION; v++) {
    const step = STEPS[v];
    if (!step) throw new Error(`falta la migración ${v}→${v + 1}`);
    doc = step(doc, opts);
    applied.push(`${v}→${v + 1}`);
  }
  return { document: doc as PageDocument, from, applied };
}
