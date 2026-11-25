// Piezas sin framework (agenda: año perpetuo, línea temporal, buscar hueco, franjas, mapa de calor, rachas; gráficos
// y minigráficos): un elemento con la clase raíz de la pieza dentro de `[data-z-dom]` se pinta con el mismo árbol que
// el binding de React (core/widget + core/vnode) y la misma interacción. Configuración en atributos `data-*` y en un hijo
// `<script type="application/json" data-props>`; datos por propiedad con `setWidgetProps(el, props)`. Los avisos salen
// como `z:<nombre>` (`z:select`, `z:taskchange`…). El texto de la aplicación entra siempre como texto.
// Este archivo es solo el registro y el montaje: cada familia registra sus piezas (./widgets-agenda,
// ./widgets-charts, ./color, ./media) y comparte `widgetsPart`.

import type { VNode } from "../core/vnode";
import { domEventName, focusActive, type Widget, type WidgetHost } from "../core/widget";
import { emit, inDom } from "./forms-popup";
import type { DomPart } from "./shared";
import { patchChildren } from "./vtree";

// biome-ignore lint/suspicious/noExplicitAny: el registro guarda piezas de props, configuración y estado distintos.
type AnyWidget = Widget<any, any, any>;
interface Entry {
  widget: AnyWidget;
  state: unknown;
  /** Props por propiedad: mandan sobre los atributos y el JSON. */
  extra: Record<string, unknown>;
  host: WidgetHost<unknown, unknown>;
  detach: () => void;
}
const entries = new WeakMap<HTMLElement, Entry>();
// Las montadas, para que `destroy()` retire también sus listeners del documento. Referencias débiles: un
// elemento que la aplicación retira sin desmontarlo no queda retenido por esta lista.
const mounted = new Set<WeakRef<HTMLElement>>();
const refs = new WeakMap<HTMLElement, WeakRef<HTMLElement>>();
let seq = 0;

// Ranuras que una pieza rellena con otro componente del modo DOM (el Calendar incrustado de SlotPicker): las
// registra la familia que lo trae, para que este registro no dependa de ella.
type SlotFill = (el: HTMLElement, slots: VNode[]) => void;
const slotFills: SlotFill[] = [];

/** Añade un relleno de ranuras (lo usa la familia de agenda para el Calendar incrustado). */
export function registerSlotFill(fill: SlotFill): void {
  if (!slotFills.includes(fill)) slotFills.push(fill);
}

function propsJSON(el: HTMLElement): Record<string, unknown> {
  const script = el.querySelector<HTMLScriptElement>(':scope > script[type="application/json"][data-props]');
  if (!script?.textContent) return {};
  try {
    const value = JSON.parse(script.textContent) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function configOf(el: HTMLElement, entry: Entry): unknown {
  const props = { ...(entry.widget.fromDom(el, propsJSON(el)) as Record<string, unknown>), ...entry.extra };
  return entry.widget.configure(props);
}

function render(el: HTMLElement, focus = false): void {
  const entry = entries.get(el);
  if (!entry) return;
  const { widget } = entry;
  const config = configOf(el, entry);
  if (widget.control) entry.state = widget.control(config, entry.state);
  if (!el.id) el.id = `${widget.root}-${++seq}`;
  const tree = widget.tree(config, entry.state, el.id);
  const scripts = [...el.querySelectorAll(":scope > script, :scope > template")];
  for (const [k, value] of Object.entries(tree.a ?? {})) {
    if (k === "id" || k === "class") continue;
    if (value === undefined || value === null || value === false) el.removeAttribute(k);
    else el.setAttribute(k, value === true ? "" : String(value));
  }
  for (const cls of String(tree.a?.class ?? widget.root).split(/\s+/)) if (cls) el.classList.add(cls);
  // Variables locales de la raíz (posición de un tirador, color actual…): se escriben y se quitan las que sobran.
  const vars = tree.s ?? {};
  for (const name of [...el.style].filter((p) => p.startsWith("--z-") && !(p in vars) && el.dataset.zVars?.split(" ").includes(p)))
    el.style.removeProperty(name);
  for (const [k, value] of Object.entries(vars)) if (el.style.getPropertyValue(k) !== String(value)) el.style.setProperty(k, String(value));
  if (Object.keys(vars).length) el.dataset.zVars = Object.keys(vars).join(" ");
  for (const s of scripts) s.remove();
  // Recolocar un nodo con clave (la ventana virtual que cambia) lo saca un instante del documento y pierde el foco:
  // si lo tenía y sigue en la pieza, lo recupera.
  const focused = el.contains(el.ownerDocument.activeElement) ? (el.ownerDocument.activeElement as HTMLElement) : null;
  patchChildren(el, tree.c ?? []);
  if (focused && focused !== el.ownerDocument.activeElement && el.contains(focused)) focused.focus({ preventScroll: true });
  el.append(...scripts);
  for (const fill of slotFills) fill(el, tree.c ?? []);
  if (widget.after) widget.after(el, entry.host, focus);
  else if (focus) focusActive(el);
}

function mount(el: HTMLElement, widget: AnyWidget): void {
  if (entries.has(el)) {
    render(el);
    return;
  }
  const entry = { widget, extra: {}, state: null, detach: () => {} } as unknown as Entry;
  entries.set(el, entry);
  const ref = new WeakRef(el);
  refs.set(el, ref);
  mounted.add(ref);
  entry.state = widget.initial(configOf(el, entry));
  entry.host = {
    config: () => configOf(el, entry),
    state: () => entry.state,
    update(patch, focus) {
      entry.state = { ...(entry.state as object), ...(patch as object) };
      render(el, Boolean(focus));
    },
    emit(name, detail) {
      emit(el, domEventName(name), detail);
    },
  };
  // Lo que hubiera de marcado de servidor se sustituye por el árbol.
  for (const child of [...el.childNodes]) if (!(child instanceof HTMLScriptElement || child instanceof HTMLTemplateElement)) child.remove();
  entry.detach = widget.attach(el, entry.host);
  el.addEventListener("z:change", (event) => {
    const cal = (event.target as HTMLElement).closest?.<HTMLElement>(".z-calendar[data-slot]");
    if (!cal || cal.parentElement?.closest(`.${widget.root}`) !== el) return;
    event.stopPropagation();
    widget.calendarChange?.(entry.host, cal.dataset.slot ?? "", (event as CustomEvent<{ value: unknown }>).detail?.value);
  });
  render(el);
}

/** Cambia props de una pieza del modo DOM (datos que no caben en un atributo: tareas, valores, franjas…). */
export function setWidgetProps(el: HTMLElement, props: Record<string, unknown>): void {
  const entry = entries.get(el);
  if (!entry) return;
  entry.extra = { ...entry.extra, ...props };
  render(el);
}

/** Desmonta una pieza (listeners). */
export function destroyWidget(el: HTMLElement): void {
  const entry = entries.get(el);
  if (!entry) return;
  entry.detach();
  entries.delete(el);
  const ref = refs.get(el);
  if (ref) mounted.delete(ref);
  refs.delete(el);
}

/** Desmonta todas las piezas montadas (lo llama `destroy()`). */
export function destroyWidgets(): void {
  for (const ref of [...mounted]) {
    const el = ref.deref();
    if (el) destroyWidget(el);
    else mounted.delete(ref);
  }
}

/**
 * Monta en `root` las piezas de `list` (las de una familia) que encuentre dentro de `[data-z-dom]`. `inside`: selector
 * de piezas que pintan dentro otra con la misma clase (el selector de emojis de la caja de texto, la nota de voz de una
 * lista de mensajes); lo que está dentro de ellas lo pinta su pieza y no se monta aparte.
 */
export function mountWidgets(root: ParentNode, list: readonly AnyWidget[], inside?: string): void {
  for (const widget of list) {
    const selector = `.${widget.root}`;
    const found = [...root.querySelectorAll<HTMLElement>(selector)];
    if (root instanceof HTMLElement && root.matches(selector)) found.unshift(root);
    for (const el of found) if (inDom(el) && !(inside && !entries.has(el) && el.parentElement?.closest(inside))) mount(el, widget);
  }
}

/** Pieza que monta las piezas de árbol de una familia. */
export const widgetPart = (rank: number, list: readonly AnyWidget[], inside?: string): DomPart => ({
  rank,
  setup() {},
  hydrate: (root) => mountWidgets(root, list, inside),
  teardown: destroyWidgets,
});
