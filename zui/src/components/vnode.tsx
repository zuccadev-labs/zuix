// Árbol de core/vnode → elementos de React, sin estado ni efectos (sirve en un Server Component): lo usan las piezas
// de la agenda y de los gráficos (`useWidget`) y los minigráficos estáticos. Los eventos los atiende la interacción
// común en la raíz.
import { createElement, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import type { VEl, VNode } from "../core/vnode";

const ATTR: Record<string, string> = {
  class: "className",
  tabindex: "tabIndex",
  for: "htmlFor",
  readonly: "readOnly",
  colspan: "colSpan",
  rowspan: "rowSpan",
  "marker-end": "markerEnd",
  datetime: "dateTime",
  maxlength: "maxLength",
  spellcheck: "spellCheck",
  autocomplete: "autoComplete",
  inputmode: "inputMode",
  popovertarget: "popoverTarget",
  "shape-rendering": "shapeRendering",
  "stroke-width": "strokeWidth",
  crossorigin: "crossOrigin",
};
const noop = () => {};

export type SlotRenderer = (p: Record<string, unknown>) => ReactNode;

// Elementos ya creados para un subárbol memorizado (`m`): el mismo nodo da el mismo elemento, y React no lo recorre.
const elements = new WeakMap<object, ReactNode>();

/** Árbol de core/vnode → elementos de React. Los eventos los atiende la interacción común en la raíz. */
export function toReact(node: VNode, slots: Partial<Record<"minical" | "calendar" | "event", SlotRenderer>> = {}): ReactNode {
  if (node === null || node === undefined || node === false) return null;
  if (typeof node === "string") return node;
  if ("slot" in node) {
    if (node.slot === "icon") return <Icon key={node.k} name={node.p.name as IconName} size={Number(node.p.size)} />;
    return slots[node.slot]?.({ ...node.p, key: node.k }) ?? null;
  }
  if (node.m) {
    const hit = elements.get(node);
    if (hit !== undefined) return hit;
    const made = element(node, slots);
    elements.set(node, made);
    return made;
  }
  return element(node, slots);
}

function element(node: VEl, slots: Partial<Record<"minical" | "calendar" | "event", SlotRenderer>>): ReactNode {
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.a ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (node.t === "option" && k === "selected") continue;
    if (k === "value" && node.t === "input") props.defaultValue = v;
    else if (k === "checked") {
      props.checked = Boolean(v);
      props.onChange = noop;
    } else props[ATTR[k] ?? k] = v === true ? true : v;
  }
  if (node.t === "select") {
    const chosen = (node.c ?? []).find((c) => c && typeof c === "object" && !("slot" in c) && c.a?.selected);
    props.value = chosen && typeof chosen === "object" && !("slot" in chosen) ? String(chosen.a?.value ?? "") : undefined;
    props.onChange = noop;
  }
  if (node.s) props.style = node.s as CSSProperties;
  if (node.k !== undefined) props.key = node.k;
  // Hijos como argumentos de createElement: una lista fija, sin claves de array.
  const kids = (node.c ?? []).map((c) => toReact(c, slots));
  return createElement(node.t, props, ...kids);
}
