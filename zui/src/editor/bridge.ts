// Puente entre un editor y su lienzo en un iframe, sobre el protocolo de ./protocol.
//
//   Editor (página que contiene el iframe)      connectCanvas(iframe, { origin })
//   Lienzo (documento dentro del iframe)        createCanvas({ container, catalog, allowedOrigins })
//
// Seguridad. El lienzo solo acepta el saludo si viene de `window.parent` y de un origen de `allowedOrigins` (comparado
// exacto, nunca por prefijo, y nunca el origen opaco "null"). El saludo trae un MessagePort y todo lo demás va por él:
// ningún otro documento puede escribir en el canal aunque comparta origen. Recomendado: el lienzo en otro origen o con
// `sandbox="allow-scripts"` (origen opaco) para que no lea la página del editor; el editor pasa entonces `origin:
// "null"` y el saludo sale con targetOrigin "*", que solo entrega el puerto (el lienzo lo descarta si el emisor no es
// su padre con un origen admitido).

import { createUndoStack } from "../core/undo";
import { type DomView, type Hydrator, renderToDOM } from "./dom";
import { migrateDocument } from "./migrate";
import { createOverlay, rectOf, type Overlay } from "./overlay";
import {
  type CanvasEnvelope,
  type CanvasMessages,
  type CanvasMessageType,
  type ChangeReason,
  type DropTarget,
  type EditorEnvelope,
  type EditorMessages,
  type EditorMessageType,
  PROTOCOL_VERSION,
  envelope,
  envelopeProblem,
  originAllowed,
} from "./protocol";
import type { BlockSpec } from "./render";
import { CHILDREN, findNode, insertNode, moveNode, pathTo, removeNode, slotOf, updateProps, updateStyle, updateText } from "./tree";
import { CATALOG_SCHEMA_VERSION, type Catalog, DOCUMENT_SCHEMA_VERSION, type JsonValue, type PageDocument, isText } from "./types";
import { type Issue, validateDocument } from "./validate";

// ── Lienzo ────────────────────────────────────────────────────────────────────────────────────────────────

export interface CanvasOptions {
  /** Elemento donde se pinta el documento. */
  container: HTMLElement;
  catalog: Catalog;
  /** Orígenes del editor admitidos, exactos (`https://editor.example.com`). Sin comodines. */
  allowedOrigins: readonly string[];
  /** Ventana del lienzo. Por defecto, la global. */
  window?: Window;
  hydrate?: Hydrator[] | false;
  blocks?: readonly BlockSpec[];
  /** Pasos de deshacer guardados y ventana de fusión (ms) de los cambios seguidos de una misma prop. */
  history?: { limit?: number; merge?: number };
  /** Aviso de cada mensaje rechazado (origen, emisor o forma). Para registro; no responde al emisor. */
  onReject?: (reason: string, event: MessageEvent) => void;
}

export interface Canvas {
  readonly document: PageDocument;
  readonly selected: string | null;
  /** Mensajes rechazados desde que arrancó. */
  readonly rejected: number;
  readonly connected: boolean;
  destroy(): void;
}

/** Códigos de error que no impiden aplicar un cambio: se devuelven como avisos en `changed`. */
const SOFT = new Set(["a11y.name", "a11y.alt", "a11y.text", "nesting.required", "a11y.heading-order", "a11y.multiple-h1"]);

export function createCanvas(o: CanvasOptions): Canvas {
  const win = o.window ?? window;
  const doc = o.container.ownerDocument;
  let document: PageDocument = { format: "zuix.page", schemaVersion: DOCUMENT_SCHEMA_VERSION, body: [] };
  let selected: string | null = null;
  let hovered: string | null = null;
  let rejected = 0;
  let port: MessagePort | null = null;
  const history = createUndoStack<PageDocument>({ limit: o.history?.limit, merge: o.history?.merge });
  const view: DomView = renderToDOM(document, o.container, { catalog: o.catalog, blocks: o.blocks, ids: true, hydrate: o.hydrate });
  const overlay: Overlay = createOverlay(doc);
  const typeOf = (id: string | null) => {
    const n = id ? findNode(document, id) : null;
    return n ? n.type : undefined;
  };

  const send = <K extends CanvasMessageType>(type: K, payload: CanvasMessages[K], replyTo?: number) =>
    port?.postMessage(envelope(type, payload, replyTo === undefined ? {} : { replyTo }));

  const check = (next: PageDocument): { hard: Issue[]; soft: Issue[] } => {
    const r = validateDocument(next, o.catalog);
    const all = [...r.errors, ...r.warnings];
    return {
      hard: all.filter((i) => i.severity === "error" && !SOFT.has(i.code)),
      soft: all.filter((i) => i.severity === "warning" || SOFT.has(i.code)),
    };
  };

  const paintSelection = () => {
    const sel = selected ? view.elementOf(selected) : null;
    if (selected && !findNode(document, selected)) selected = null;
    overlay.show("select", sel, typeOf(selected));
    overlay.show("hover", hovered && hovered !== selected ? view.elementOf(hovered) : null, typeOf(hovered));
  };

  const commit = (next: PageDocument, reason: ChangeReason, replyTo?: number, mergeKey?: string) => {
    const { hard, soft } = check(next);
    if (hard.length) {
      send("error", { code: "invalid", message: hard.map((i) => i.message).join("; "), issues: hard }, replyTo);
      return;
    }
    if (reason !== "load" && reason !== "undo" && reason !== "redo") history.record(document, mergeKey);
    if (reason === "load") history.clear();
    document = next;
    view.update(document);
    paintSelection();
    send("changed", { document, reason, canUndo: history.canUndo, canRedo: history.canRedo, warnings: soft }, replyTo);
  };

  const selectNode = (id: string | null, replyTo?: number) => {
    selected = id && findNode(document, id) ? id : null;
    paintSelection();
    const el = selected ? view.elementOf(selected) : null;
    send(
      "selected",
      {
        id: selected,
        path: selected ? (pathTo(document, selected) ?? []) : [],
        type: typeOf(selected),
        ...(el ? { rect: rectOf(el) } : {}),
      },
      replyTo,
    );
  };

  const hoverNode = (id: string | null, replyTo?: number) => {
    if (id === hovered && replyTo === undefined) return;
    hovered = id && findNode(document, id) ? id : null;
    paintSelection();
    const el = hovered ? view.elementOf(hovered) : null;
    send("hovered", { id: hovered, type: typeOf(hovered), ...(el ? { rect: rectOf(el) } : {}) }, replyTo);
  };

  const tokenNames = new Set(o.catalog.tokens.tokens.map((t) => t.name));
  const applyTheme = (p: EditorMessages["theme"]) => {
    const html = doc.documentElement;
    if (p.brand !== undefined) {
      if (!o.catalog.tokens.brands.includes(p.brand) && !/^[a-z][a-z0-9-]*$/.test(p.brand)) throw new Error(`marca no válida: ${p.brand}`);
      html.setAttribute("data-brand", p.brand);
    }
    if (p.theme !== undefined) {
      if (p.theme !== "dark" && p.theme !== "light") throw new Error(`tema no válido: ${String(p.theme)}`);
      html.setAttribute("data-theme", p.theme);
    }
    for (const [name, value] of Object.entries(p.tokens ?? {})) {
      if (!tokenNames.has(name)) throw new Error(`el token «${name}» no existe`);
      if (value === null) html.style.removeProperty(`--z-${name}`);
      else html.style.setProperty(`--z-${name}`, String(value));
    }
    overlay.refresh();
  };

  const measure = (p: EditorMessages["measure"]): DropTarget[] => {
    const out: DropTarget[] = [];
    const containers: { parent: string | null; slot: string; el: HTMLElement }[] = [];
    if (p.parent === undefined || p.parent === null) containers.push({ parent: null, slot: CHILDREN, el: o.container });
    const byType = new Map(o.catalog.blocks.map((b) => [b.type, b]));
    const visit = (id: string) => {
      const node = findNode(document, id);
      const el = view.elementOf(id);
      if (!node || isText(node) || !el) return;
      const block = byType.get(node.type);
      if (!block) return;
      if (block.children && (p.slot === undefined || p.slot === CHILDREN)) containers.push({ parent: id, slot: CHILDREN, el });
      for (const name of Object.keys(block.slots))
        if (p.slot === undefined || p.slot === name) containers.push({ parent: id, slot: name, el });
    };
    if (p.parent) visit(p.parent);
    else for (const el of o.container.querySelectorAll<HTMLElement>("[data-z-node]")) visit(el.getAttribute("data-z-node") as string);
    for (const c of containers) {
      const kids = (c.parent === null ? document.body : slotOf(findNode(document, c.parent) ?? { id: "", type: "#text", text: "" }, c.slot))
        .map((n) => (isText(n) ? null : view.elementOf(n.id)))
        .filter((e): e is HTMLElement => e !== null);
      const box = rectOf(c.el);
      if (!kids.length) {
        out.push({
          parent: c.parent,
          slot: c.slot,
          index: 0,
          orientation: "horizontal",
          rect: { x: box.x, y: box.y + box.height / 2, width: box.width, height: 0 },
        });
        continue;
      }
      const rects = kids.map(rectOf);
      const row =
        rects.length > 1 && Math.abs((rects[1] as DOMRectLike).y - (rects[0] as DOMRectLike).y) < (rects[0] as DOMRectLike).height / 2;
      for (const [i, r] of rects.entries())
        out.push({
          parent: c.parent,
          slot: c.slot,
          index: i,
          orientation: row ? "vertical" : "horizontal",
          rect: row ? { x: r.x, y: r.y, width: 0, height: r.height } : { x: r.x, y: r.y, width: r.width, height: 0 },
        });
      const last = rects[rects.length - 1] as DOMRectLike;
      out.push({
        parent: c.parent,
        slot: c.slot,
        index: rects.length,
        orientation: row ? "vertical" : "horizontal",
        rect: row
          ? { x: last.x + last.width, y: last.y, width: 0, height: last.height }
          : { x: last.x, y: last.y + last.height, width: last.width, height: 0 },
      });
    }
    return out;
  };

  const handle = (event: MessageEvent) => {
    const problem = envelopeProblem(event.data, "editor");
    if (problem) {
      rejected += 1;
      o.onReject?.(problem, event);
      return;
    }
    const msg = event.data as EditorEnvelope;
    const reply = msg.id;
    try {
      switch (msg.type) {
        case "hello":
          return;
        case "load": {
          const { document: next } = migrateDocument(msg.payload.document);
          selected = null;
          hovered = null;
          return commit(next, "load", reply);
        }
        case "insert":
          return commit(insertNode(document, msg.payload.node, msg.payload.at), "insert", reply);
        case "move":
          return commit(moveNode(document, msg.payload.id, msg.payload.at), "move", reply);
        case "remove":
          return commit(removeNode(document, msg.payload.id), "remove", reply);
        case "update": {
          const { id, props, style, text } = msg.payload;
          let next = document;
          if (props)
            next = updateProps(
              next,
              id,
              Object.fromEntries(Object.entries(props).map(([k, v]) => [k, v === null ? undefined : (v as JsonValue)])),
            );
          if (style)
            next = updateStyle(next, id, Object.fromEntries(Object.entries(style).map(([k, v]) => [k, v === null ? undefined : v])));
          if (text !== undefined) next = updateText(next, id, String(text));
          const key = `update:${id}:${Object.keys(props ?? {})
            .sort()
            .join(",")}:${Object.keys(style ?? {})
            .sort()
            .join(",")}:${text !== undefined}`;
          return commit(next, "update", reply, key);
        }
        case "select":
          return selectNode(msg.payload.id, reply);
        case "hover":
          return hoverNode(msg.payload.id, reply);
        case "undo": {
          const prev = history.undo(document);
          if (!prev) return send("error", { code: "nothing-to-undo", message: "no hay nada que deshacer" }, reply);
          return commit(prev, "undo", reply);
        }
        case "redo": {
          const next = history.redo(document);
          if (!next) return send("error", { code: "nothing-to-redo", message: "no hay nada que rehacer" }, reply);
          return commit(next, "redo", reply);
        }
        case "theme":
          applyTheme(msg.payload);
          return send(
            "themed",
            {
              brand: doc.documentElement.getAttribute("data-brand"),
              theme: doc.documentElement.getAttribute("data-theme"),
              tokens: [...doc.documentElement.style].filter((p) => p.startsWith("--z-")).map((p) => p.slice(4)),
            },
            reply,
          );
        case "measure":
          return send("dropTargets", { targets: measure(msg.payload) }, reply);
      }
    } catch (error) {
      send("error", { code: "failed", message: error instanceof Error ? error.message : String(error) }, reply);
    }
  };

  const onWindowMessage = (event: MessageEvent) => {
    // Solo el saludo llega por la ventana. Emisor, origen y forma, en este orden; nada se responde a un rechazado.
    const reason =
      event.source !== win.parent || win.parent === win
        ? "el emisor no es la ventana padre"
        : !originAllowed(event.origin, o.allowedOrigins)
          ? `origen no admitido: ${event.origin}`
          : (envelopeProblem(event.data, "editor") ??
            ((event.data as EditorEnvelope).type !== "hello"
              ? "se esperaba el saludo"
              : !event.ports[0]
                ? "el saludo no trae puerto"
                : null));
    if (reason) {
      rejected += 1;
      o.onReject?.(reason, event);
      return;
    }
    port?.close();
    port = event.ports[0] as MessagePort;
    port.onmessage = handle;
    port.start();
    send("ready", {
      zuix: o.catalog.zuix,
      protocolVersion: PROTOCOL_VERSION,
      documentSchemaVersion: DOCUMENT_SCHEMA_VERSION,
      catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
    });
  };
  win.addEventListener("message", onWindowMessage);

  // Interacción dentro del lienzo: clic selecciona (y no navega ni envía), el puntero marca, Escape deselecciona.
  const nodeAt = (target: EventTarget | null) =>
    (target as Element | null)?.closest?.("[data-z-node]")?.getAttribute("data-z-node") ?? null;
  const onClick = (event: MouseEvent) => {
    if (!o.container.contains(event.target as Node)) return;
    event.preventDefault();
    selectNode(nodeAt(event.target));
  };
  const onSubmit = (event: Event) => event.preventDefault();
  const onMove = (event: PointerEvent) => hoverNode(o.container.contains(event.target as Node) ? nodeAt(event.target) : null);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && selected) selectNode(null);
  };
  o.container.addEventListener("click", onClick, true);
  o.container.addEventListener("submit", onSubmit, true);
  doc.addEventListener("pointermove", onMove, { passive: true });
  doc.addEventListener("keydown", onKey);

  return {
    get document() {
      return document;
    },
    get selected() {
      return selected;
    },
    get rejected() {
      return rejected;
    },
    get connected() {
      return port !== null;
    },
    destroy() {
      win.removeEventListener("message", onWindowMessage);
      o.container.removeEventListener("click", onClick, true);
      o.container.removeEventListener("submit", onSubmit, true);
      doc.removeEventListener("pointermove", onMove);
      doc.removeEventListener("keydown", onKey);
      port?.close();
      port = null;
      overlay.destroy();
      view.destroy();
    },
  };
}

type DOMRectLike = { x: number; y: number; width: number; height: number };

// ── Editor ────────────────────────────────────────────────────────────────────────────────────────────────

export interface ConnectOptions {
  /**
   * Origen del lienzo, exacto. Con un iframe `sandbox` sin `allow-same-origin`, `"null"`: el saludo sale entonces con
   * targetOrigin "*" (solo lleva el puerto y la versión).
   */
  origin: string;
  /** Tiempo máximo para el saludo, en ms. Por defecto 10 000. */
  timeout?: number;
  /** Versión de zuix que se anuncia en el saludo. */
  zuix?: string;
}

export interface CanvasConnection {
  readonly ready: CanvasMessages["ready"];
  /** Envía un mensaje y devuelve su número de petición. */
  send<K extends Exclude<EditorMessageType, "hello">>(type: K, payload: EditorMessages[K]): number;
  /** Envía y espera la respuesta (`changed`, `selected`, `dropTargets`…); rechaza con la de `error`. */
  request<K extends Exclude<EditorMessageType, "hello">>(type: K, payload: EditorMessages[K]): Promise<CanvasEnvelope>;
  /** Escucha un tipo de mensaje del lienzo. Devuelve la función que deja de escuchar. */
  on<K extends CanvasMessageType>(type: K, handler: (payload: CanvasMessages[K], message: Envelope<K>) => void): () => void;
  close(): void;
}

type Envelope<K extends CanvasMessageType> = Extract<CanvasEnvelope, { type: K }>;

/** Error de una petición: lleva el `code` y las incidencias que devolvió el lienzo. */
export class CanvasError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly issues: Issue[] = [],
  ) {
    super(message);
    this.name = "CanvasError";
  }
}

/** Conecta con el lienzo de un iframe. Reintenta el saludo hasta que el lienzo carga y responde `ready`. */
export function connectCanvas(iframe: HTMLIFrameElement, o: ConnectOptions): Promise<CanvasConnection> {
  const target = o.origin === "null" ? "*" : new URL(o.origin).origin;
  const timeout = o.timeout ?? 10_000;
  return new Promise((resolve, reject) => {
    const channels: MessageChannel[] = [];
    let done = false;
    const started = Date.now();
    const attempt = () => {
      if (done) return;
      if (Date.now() - started > timeout) {
        done = true;
        for (const c of channels) c.port1.close();
        reject(new Error(`el lienzo no respondió en ${timeout} ms (¿origen ${o.origin} admitido en allowedOrigins?)`));
        return;
      }
      const channel = new MessageChannel();
      channels.push(channel);
      channel.port1.onmessage = (event) => {
        const problem = envelopeProblem(event.data, "canvas");
        if (done || problem || (event.data as CanvasEnvelope).type !== "ready") return;
        done = true;
        for (const c of channels) if (c !== channel) c.port1.close();
        resolve(connection(channel.port1, (event.data as Envelope<"ready">).payload));
      };
      channel.port1.start();
      iframe.contentWindow?.postMessage(envelope("hello", { zuix: o.zuix ?? "", protocolVersion: PROTOCOL_VERSION }), target, [
        channel.port2,
      ]);
      setTimeout(attempt, 250);
    };
    attempt();
  });
}

function connection(port: MessagePort, ready: CanvasMessages["ready"]): CanvasConnection {
  let next = 1;
  const pending = new Map<number, { resolve: (m: CanvasEnvelope) => void; reject: (e: Error) => void }>();
  const handlers = new Map<string, Set<(payload: unknown, message: CanvasEnvelope) => void>>();
  port.onmessage = (event) => {
    if (envelopeProblem(event.data, "canvas")) return;
    const msg = event.data as CanvasEnvelope;
    if (msg.replyTo !== undefined) {
      const p = pending.get(msg.replyTo);
      if (p) {
        pending.delete(msg.replyTo);
        if (msg.type === "error") p.reject(new CanvasError(msg.payload.message, msg.payload.code, msg.payload.issues));
        else p.resolve(msg);
      }
    }
    for (const h of handlers.get(msg.type) ?? []) h(msg.payload, msg);
  };
  const send = (type: string, payload: unknown) => {
    const id = next++;
    port.postMessage(envelope(type, payload, { id }));
    return id;
  };
  return {
    ready,
    send: (type, payload) => send(type, payload),
    request: (type, payload) =>
      new Promise((resolve, reject) => {
        const id = next;
        pending.set(id, { resolve, reject });
        send(type, payload);
      }),
    on(type, handler) {
      const set = handlers.get(type) ?? new Set();
      handlers.set(type, set);
      const h = handler as (payload: unknown, message: CanvasEnvelope) => void;
      set.add(h);
      return () => set.delete(h);
    },
    close() {
      for (const p of pending.values()) p.reject(new Error("conexión cerrada"));
      pending.clear();
      port.close();
    },
  };
}
