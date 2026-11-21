// Piezas sin framework (agenda: año perpetuo, línea temporal, buscar hueco, franjas, mapa de calor, rachas; gráficos
// y minigráficos): un elemento con la clase raíz de la pieza dentro de `[data-z-dom]` se pinta con el mismo árbol que
// el binding de React (core/widget + core/vnode) y la misma interacción. Configuración en atributos `data-*` y en un hijo
// `<script type="application/json" data-props>`; datos por propiedad con `setWidgetProps(el, props)`. Los avisos salen
// como `z:<nombre>` (`z:select`, `z:taskchange`…). El texto de la aplicación entra siempre como texto.

import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { buildingOffice } from "@zuccadev-labs/zuix-zicon/icons/building-office";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { chevronDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-down";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { chevronUpDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-up-down";
import { exclamationTriangle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-triangle";
import { fire } from "@zuccadev-labs/zuix-zicon/icons/fire";
import { flag } from "@zuccadev-labs/zuix-zicon/icons/flag";
import { globeAlt } from "@zuccadev-labs/zuix-zicon/icons/globe-alt";
import { tableCells } from "@zuccadev-labs/zuix-zicon/icons/table-cells";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { findSlots, type VAttr } from "../core/vnode";
import { domEventName, focusActive, type Widget, type WidgetHost } from "../core/widget";
import { setCalendarOptions, type CalendarOptions } from "./forms-calendar";
import { emit, inDom } from "./forms-popup";
import { patchChildren } from "./vtree";
import { chartWidget } from "../core/chart-widget";
import { freeBusyWidget } from "../core/freebusy-widget";
import { habitWidget } from "../core/habit-widget";
import { heatmapWidget } from "../core/heatmap-widget";
import { perpetualWidget } from "../core/perpetual-widget";
import { slotPickerWidget } from "../core/slots-widget";
import { sparklineWidget } from "../core/sparkline";
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
// Las montadas, para que `destroy()` retire también sus listeners del documento. Referencias débiles: un
// elemento que la aplicación retira sin desmontarlo no queda retenido por esta lista.
const mounted = new Set<WeakRef<HTMLElement>>();
const refs = new WeakMap<HTMLElement, WeakRef<HTMLElement>>();
const registry: AnyWidget[] = [];
let seq = 0;

registerIcons([
  buildingOffice,
  check,
  chevronDown,
  chevronLeft,
  chevronRight,
  chevronUpDown,
  exclamationTriangle,
  fire,
  flag,
  globeAlt,
  tableCells,
  xMark,
]);
registerWidget(perpetualWidget);
registerWidget(timelineWidget);
registerWidget(freeBusyWidget);
registerWidget(slotPickerWidget);
registerWidget(heatmapWidget);
registerWidget(habitWidget);
registerWidget(chartWidget);
registerWidget(sparklineWidget);

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
  // Variables locales de la raíz (posición de un tirador, color actual…): se escriben y se quitan las que sobran.
  const vars = tree.s ?? {};
  for (const name of [...el.style].filter((p) => p.startsWith("--z-") && !(p in vars) && el.dataset.zVars?.split(" ").includes(p)))
    el.style.removeProperty(name);
  for (const [k, value] of Object.entries(vars)) if (el.style.getPropertyValue(k) !== String(value)) el.style.setProperty(k, String(value));
  if (Object.keys(vars).length) el.dataset.zVars = Object.keys(vars).join(" ");
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

export function hydrate(root: ParentNode): void {
  for (const widget of registry) {
    const selector = `.${widget.root}`;
    const list = [...root.querySelectorAll<HTMLElement>(selector)];
    if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root);
    for (const el of list) if (inDom(el)) mount(el, widget);
  }
}

export function setup(): void {}
