// Piezas de la agenda sin framework (año perpetuo, línea temporal, buscar hueco, franjas, mapa de calor, rachas): un
// elemento con la clase raíz de la pieza dentro de `[data-z-dom]` se pinta con el mismo árbol que el binding de React
// (core/widget + core/vnode) y la misma interacción. Configuración en atributos `data-*` y en un hijo
// `<script type="application/json" data-props>`; datos por propiedad con `setWidgetProps(el, props)`. Los avisos salen
// como `z:<nombre>` (`z:select`, `z:taskchange`…). El texto de la aplicación entra siempre como texto.

import { findSlots, type VAttr } from "../core/vnode";
import { domEventName, focusActive, type Widget, type WidgetHost } from "../core/widget";
import { setCalendarOptions, type CalendarOptions } from "./forms-calendar";
import { emit, inDom } from "./forms-popup";
import { patchChildren } from "./vtree";
import { freeBusyWidget } from "../core/freebusy-widget";
import { habitWidget } from "../core/habit-widget";
import { heatmapWidget } from "../core/heatmap-widget";
import { perpetualWidget } from "../core/perpetual-widget";
import { slotPickerWidget } from "../core/slots-widget";
import { timelineWidget } from "../core/timeline-widget";

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
const registry: AnyWidget[] = [];
let seq = 0;

registerWidget(perpetualWidget);
registerWidget(timelineWidget);
registerWidget(freeBusyWidget);
registerWidget(slotPickerWidget);
registerWidget(heatmapWidget);
registerWidget(habitWidget);

/** Registra una pieza para que `hydrate` la monte. */
export function registerWidget(widget: AnyWidget): void {
  if (!registry.includes(widget)) registry.push(widget);
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
  for (const s of scripts) s.remove();
  patchChildren(el, tree.c ?? []);
  el.append(...scripts);
  // Calendar incrustados: atributos del modo DOM y funciones con setCalendarOptions (que lo pinta).
  for (const slot of findSlots(tree.c ?? [], "calendar")) {
    const cal = el.querySelector<HTMLElement>(`.z-calendar[data-slot="${CSS.escape(String(slot.p.name ?? ""))}"]`);
    if (!cal) continue;
    const attrs = (slot.p.attrs ?? {}) as Record<string, VAttr>;
    for (const [k, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) cal.removeAttribute(k);
      else if (cal.getAttribute(k) !== String(value === true ? "" : value)) cal.setAttribute(k, value === true ? "" : String(value));
    }
    setCalendarOptions(cal, (slot.p.options ?? {}) as CalendarOptions);
  }
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
}

export function hydrate(root: ParentNode): void {
  for (const widget of registry) {
    const selector = `.${widget.root}`;
    const list = [...root.querySelectorAll<HTMLElement>(selector)];
    if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root);
    for (const el of list) if (inDom(el)) mount(el, widget);
  }
}

export function setup(): void {}
