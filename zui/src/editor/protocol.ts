// Protocolo del puente entre un editor y su lienzo (un iframe). Los mensajes son objetos planos que se clonan con
// postMessage: un sobre con el nombre y la versión del protocolo, el tipo, un número de petición opcional y la carga.
// El saludo (`hello`) va por window.postMessage y entrega un MessagePort; todo lo demás viaja por ese puerto, que solo
// tienen las dos partes. Ver docs/users/12-conectar-un-editor.md.

import type { AdaptiveOverride, PointerKind, SizeClass } from "./adaptive";
import type { Issue } from "./validate";
import type { Location, NodePath } from "./tree";
import type { JsonValue, PageDocument, PageNode } from "./types";

export const PROTOCOL = "zuix-editor";
/** Versión del protocolo. Un cambio incompatible en un mensaje la sube; añadir un mensaje o un campo opcional, no. */
export const PROTOCOL_VERSION = 1;

/** Caja de un elemento en coordenadas del lienzo (CSS px, relativas a la ventana del iframe). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Punto de anclaje para soltar: dónde quedaría el nodo y la línea que lo marca. */
export interface DropTarget extends Location {
  slot: string;
  /** Línea de inserción: horizontal (entre bloques apilados) o vertical (entre bloques en fila). */
  orientation: "horizontal" | "vertical";
  rect: Rect;
}

export interface EditorMessages {
  /** Primer mensaje, por window.postMessage, con el puerto del canal en `ports[0]`. */
  hello: { zuix: string; protocolVersion: number };
  load: { document: PageDocument };
  insert: { node: PageNode; at: Location };
  move: { id: string; at: Location };
  remove: { id: string };
  update: { id: string; props?: Record<string, JsonValue | null>; style?: Record<string, string | null>; text?: string };
  select: { id: string | null };
  hover: { id: string | null };
  undo: Record<string, never>;
  redo: Record<string, never>;
  /** Marca, tema y tokens en vivo. `null` en un token lo quita. */
  theme: { brand?: string; theme?: "dark" | "light"; tokens?: Record<string, string | null> };
  /** Pide las medidas de los puntos de anclaje de un hueco (o de todos los visibles). */
  measure: { parent?: string | null; slot?: string };
  /**
   * Vista previa por clase de tamaño: fuerza el ancho del contenedor del lienzo (el típico de la clase, o `width`) y el
   * tipo de puntero. `null` en un campo vuelve a medir el lienzo tal cual.
   */
  viewport: { sizeClass?: SizeClass | null; width?: number | null; pointer?: PointerKind | null };
  /** Cambia orden, área, visibilidad, columnas, variante o props de un nodo en una clase. `null` quita el campo. */
  adapt: {
    id: string;
    sizeClass: SizeClass;
    patch: { [K in Exclude<keyof AdaptiveOverride, "props">]?: AdaptiveOverride[K] | null } & {
      props?: Record<string, JsonValue | null> | null;
    };
  };
  /** Pide las áreas de los layouts adaptativos en la clase actual, como zonas de soltar. */
  measureAreas: { parent?: string };
}

export type ChangeReason = "load" | "insert" | "move" | "remove" | "update" | "adapt" | "undo" | "redo";

export interface CanvasMessages {
  ready: { zuix: string; protocolVersion: number; documentSchemaVersion: number; catalogSchemaVersion: number };
  selected: { id: string | null; path: NodePath; type?: string; rect?: Rect };
  hovered: { id: string | null; type?: string; rect?: Rect };
  changed: { document: PageDocument; reason: ChangeReason; canUndo: boolean; canRedo: boolean; warnings: Issue[] };
  error: { code: string; message: string; issues?: Issue[] };
  dropTargets: { targets: DropTarget[] };
  /** Respuesta a `theme`: lo que quedó aplicado. */
  themed: { brand: string | null; theme: string | null; tokens: string[] };
  /** Respuesta a `viewport` (y aviso cuando el lienzo cambia de clase al redimensionarse). */
  viewportChanged: { sizeClass: SizeClass; width: number | null; pointer: PointerKind };
  /** Áreas de cada layout adaptativo en la clase actual: zonas de soltar para mover una pieza de área. */
  areaTargets: { sizeClass: SizeClass; areas: { parent: string; area: string; rect: Rect }[] };
}

export type EditorMessageType = keyof EditorMessages;
export type CanvasMessageType = keyof CanvasMessages;

export interface Envelope<T extends string = string, P = unknown> {
  protocol: typeof PROTOCOL;
  version: number;
  type: T;
  /** Número de petición: la respuesta lo devuelve en `replyTo`. */
  id?: number;
  replyTo?: number;
  payload: P;
}

export type EditorEnvelope = { [K in EditorMessageType]: Envelope<K, EditorMessages[K]> }[EditorMessageType];
export type CanvasEnvelope = { [K in CanvasMessageType]: Envelope<K, CanvasMessages[K]> }[CanvasMessageType];

const EDITOR_TYPES = new Set<string>([
  "hello",
  "load",
  "insert",
  "move",
  "remove",
  "update",
  "select",
  "hover",
  "undo",
  "redo",
  "theme",
  "measure",
  "viewport",
  "adapt",
  "measureAreas",
]);
const CANVAS_TYPES = new Set<string>([
  "ready",
  "selected",
  "hovered",
  "changed",
  "error",
  "dropTargets",
  "themed",
  "viewportChanged",
  "areaTargets",
]);

export function envelope<T extends string, P>(type: T, payload: P, extra: { id?: number; replyTo?: number } = {}): Envelope<T, P> {
  return { protocol: PROTOCOL, version: PROTOCOL_VERSION, type, ...extra, payload };
}

/** Por qué un mensaje no es un sobre válido del protocolo, o `null` si lo es. */
export function envelopeProblem(data: unknown, from: "editor" | "canvas"): string | null {
  if (!data || typeof data !== "object") return "no es un objeto";
  const e = data as Partial<Envelope>;
  if (e.protocol !== PROTOCOL) return "no es del protocolo zuix-editor";
  if (e.version !== PROTOCOL_VERSION) return `versión de protocolo ${String(e.version)}; este lado habla la ${PROTOCOL_VERSION}`;
  if (typeof e.type !== "string" || !(from === "editor" ? EDITOR_TYPES : CANVAS_TYPES).has(e.type))
    return `tipo de mensaje desconocido: ${String(e.type)}`;
  if (e.id !== undefined && !Number.isSafeInteger(e.id)) return "id de petición no válido";
  if (!e.payload || typeof e.payload !== "object") return "falta la carga";
  return null;
}

/**
 * Si un origen está en la lista. Compara orígenes serializados exactos tras normalizarlos con `URL` (sin rutas, con
 * el puerto por defecto quitado) y rechaza siempre el origen opaco `"null"`: dos iframes con sandbox distintos lo
 * comparten. Con la API `Origin` del navegador (si existe) usa `isSameOrigin`.
 */
export function originAllowed(origin: string, allowed: readonly string[]): boolean {
  if (origin === "null" || !origin) return false;
  const O = (globalThis as { Origin?: { from(v: string): { isSameOrigin(o: unknown): boolean; opaque: boolean } } }).Origin;
  for (const a of allowed) {
    try {
      if (O) {
        const x = O.from(origin);
        if (!x.opaque && x.isSameOrigin(O.from(a))) return true;
        continue;
      }
      const u = new URL(origin);
      const t = new URL(a);
      if (u.origin !== "null" && u.origin === t.origin) return true;
    } catch {
      // Una entrada que no es una URL no admite nada.
    }
  }
  return false;
}
