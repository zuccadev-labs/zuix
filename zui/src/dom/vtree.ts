// Árbol de core/vnode → nodos del documento, con parcheo por posición y clave (el texto siempre como nodo de texto,
// nunca como marcado). Lo usan la agenda y las demás piezas de la agenda del modo DOM.

import { getIcon, iconSvg } from "@zuccadev-labs/zuix-zicon/dom";
import type { VEl, VNode, VSlot } from "../core/vnode";
import { setSrcdoc } from "../trusted";
import { fragment } from "./shared";

const keys = new WeakMap<Node, string>();
/** Último nodo memorizado (`m`) con el que se pintó cada elemento: si llega el mismo, no hay nada que parchear. */
const painted = new WeakMap<Node, object>();
/** Último nodo con el que se pintó cada elemento (para comparar atributos sin leer el documento). */
const previous = new WeakMap<Element, VEl>();
function sameRecord(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  let n = 0;
  for (const k in a) {
    if (a[k] !== b[k]) return false;
    n++;
  }
  return n === Object.keys(b).length;
}

/** Contenido propio de un hueco (`event`): texto o nodos de la aplicación. */
export type SlotRenderers = Partial<Record<"event", (p: Record<string, unknown>) => Node | string | null | undefined>>;

const slotKey = (v: VSlot) =>
  v.slot === "icon"
    ? `icon:${v.p.name}:${v.p.size}:${v.p.variant ?? ""}`
    : v.slot === "minical"
      ? "minical"
      : v.slot === "event"
        ? `event:${v.k ?? ""}`
        : `calendar:${String(v.p.name ?? "")}`;

const SVG_NS = "http://www.w3.org/2000/svg";

function create(v: VNode, doc: Document, slots: SlotRenderers, svg = false): Node {
  if (typeof v === "string") return doc.createTextNode(v);
  if (!v) return doc.createTextNode("");
  if ("slot" in v) {
    if (v.slot === "icon") {
      // Un icono que esta copia del registro no tiene (el de un aviso o una acción de la aplicación) se deja al
      // elemento <z-icon>, que lo dibuja con el set que haya cargado la página.
      if (!getIcon(String(v.p.name))) {
        const el = doc.createElement("z-icon");
        el.setAttribute("name", String(v.p.name));
        el.setAttribute("size", String(Number(v.p.size)));
        if (v.p.variant === "solid") el.setAttribute("variant", "solid");
        keys.set(el, slotKey(v));
        return el;
      }
      const frag = fragment(iconSvg(String(v.p.name), { size: Number(v.p.size), variant: v.p.variant === "solid" ? "solid" : "outline" }));
      const glyph = frag.firstElementChild ?? doc.createElement("span");
      keys.set(glyph, slotKey(v));
      return glyph;
    }
    if (v.slot === "event") {
      const span = doc.createElement("span");
      span.className = "z-event__custom";
      const content = slots.event?.(v.p);
      if (typeof content === "string") span.textContent = content;
      else if (content) span.append(content);
      keys.set(span, slotKey(v));
      return span;
    }
    const cal = doc.createElement("div");
    cal.className = v.slot === "minical" ? "z-calendar z-agenda__minical" : `z-calendar${v.p.className ? ` ${v.p.className}` : ""}`;
    if (v.slot === "calendar") cal.dataset.slot = String(v.p.name ?? "");
    keys.set(cal, slotKey(v));
    return cal;
  }
  // Dentro de un <svg> (y el propio <svg>) los elementos van en el espacio de nombres de SVG.
  const el = svg || v.t === "svg" ? doc.createElementNS(SVG_NS, v.t) : doc.createElement(v.t);
  keys.set(el, v.k !== undefined ? `${v.t}:${v.k}` : v.t);
  patchElement(el, v, true, slots);
  if (v.m) painted.set(el, v);
  return el;
}

const keyOf = (v: VNode): string =>
  typeof v === "string" || !v ? "#text" : "slot" in v ? slotKey(v) : v.k !== undefined ? `${v.t}:${v.k}` : v.t;

export function patchElement(
  el: Element,
  v: Exclude<VNode, string | null | undefined | false>,
  fresh = false,
  slots: SlotRenderers = {},
): void {
  if ("slot" in v) return;
  // Mismos atributos y variables que en el pintado anterior de este elemento: no se leen ni se escriben (es lo más
  // caro de volver a pintar una vista con miles de nodos que apenas cambia).
  const last = previous.get(el);
  const same = !fresh && last !== undefined && sameRecord(last.a, v.a) && sameRecord(last.s, v.s);
  previous.set(el, v);
  if (!same) {
    const want = new Map<string, string>();
    // Lo que teclea la persona en un campo no se pisa: el `value` de un input o textarea solo se escribe la primera
    // vez (y tampoco se quita). El de un <option> sí es parte del árbol: quitarlo hacía que la opción valiese su texto
    // («Month» en vez de «month») tras volver a pintar.
    const typed = !fresh && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement);
    for (const [k, value] of Object.entries(v.a ?? {})) {
      if (value === null || value === undefined || value === false) continue;
      if (k === "value" && typed) continue;
      want.set(k, value === true ? "" : String(value));
    }
    for (const attr of [...el.attributes])
      if (!want.has(attr.name) && attr.name !== "style" && attr.name !== "open" && !(typed && attr.name === "value"))
        el.removeAttribute(attr.name);
    for (const [k, value] of want) {
      if (el.getAttribute(k) === value) continue;
      // El documento de un iframe es un destino de Trusted Types: pasa por la política del paquete (`setSrcdoc`).
      if (k === "srcdoc" && el instanceof HTMLIFrameElement) setSrcdoc(el, value);
      else el.setAttribute(k, value);
    }
    if (el instanceof HTMLElement || el instanceof SVGElement) {
      const style = el.style;
      for (const name of [...style].filter((p) => p.startsWith("--") && !(v.s && p in v.s))) style.removeProperty(name);
      for (const [k, value] of Object.entries(v.s ?? {}))
        if (style.getPropertyValue(k) !== String(value)) style.setProperty(k, String(value));
      if (!v.s && !style.length) el.removeAttribute("style");
    }
  }
  // Estado que la persona cambia sin pasar por los atributos: siempre desde el árbol.
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) el.checked = Boolean(v.a?.checked);
  if (el instanceof HTMLOptionElement) el.selected = Boolean(v.a?.selected);
  // Una región viva la escribe el anuncio (con retraso): su texto no se pisa al volver a pintar.
  if (!fresh && !v.c?.length && (el.hasAttribute("data-live") || el.classList.contains("z-agenda__live"))) return;
  patchChildren(el, v.c ?? [], slots);
}

export function patchChildren(parent: Element, kids: VNode[], slots: SlotRenderers = {}): void {
  const doc = parent.ownerDocument;
  const svg = parent.namespaceURI === SVG_NS && parent.localName !== "foreignObject";
  const existing = [...parent.childNodes];
  // Nodos con clave propia que aún no se han usado: si una pieza cambia de posición (aparece o desaparece una
  // anterior), se mueve en vez de crearse de nuevo (conserva el foco y el texto de las regiones vivas).
  const keyed = new Map<string, ChildNode>();
  const wanted = new Set<string>();
  for (const v of kids) {
    const k = keyOf(v);
    if (k.includes(":")) wanted.add(k);
  }
  for (const node of existing) {
    const k = keys.get(node);
    if (k?.includes(":") && !keyed.has(k)) keyed.set(k, node);
  }
  kids.forEach((v, i) => {
    const key = keyOf(v);
    let cur = parent.childNodes[i] as ChildNode | undefined;
    if (cur && keys.get(cur) !== key && key.includes(":") && typeof v === "object" && v && !("slot" in v) && v.k !== undefined) {
      const moved = keyed.get(key);
      if (moved && moved.parentNode === parent) {
        parent.insertBefore(moved, cur);
        cur = moved;
      }
    }
    if (cur && (cur.nodeType === Node.TEXT_NODE ? key === "#text" : keys.get(cur) === key)) {
      if (cur.nodeType === Node.TEXT_NODE) {
        if (cur.textContent !== v) cur.textContent = v as string;
      } else if (typeof v === "object" && v && !("slot" in v) && !(v.m && painted.get(cur) === v)) {
        patchElement(cur as Element, v, false, slots);
        if (v.m) painted.set(cur, v);
        else painted.delete(cur);
      }
      return;
    }
    const node = create(v, doc, slots, svg);
    // Un nodo con clave que hará falta más adelante (una fila que solo cambia de sitio) no se sustituye: el nuevo va
    // delante y el otro se recoloca al llegar a su clave (conserva foco y estado).
    const curKey = cur ? keys.get(cur) : undefined;
    if (cur && !(curKey?.includes(":") && wanted.has(curKey))) parent.replaceChild(node, cur);
    else if (cur) parent.insertBefore(node, cur);
    else parent.append(node);
  });
  while (parent.childNodes.length > kids.length) parent.lastChild!.remove();
}
