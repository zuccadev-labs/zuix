"use client";
import {
  createElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import type { VEl, VNode } from "../../core/vnode";
import { focusActive, type Widget, type WidgetHost } from "../../core/widget";
import { useMergedRef } from "../../refs";
import { Calendar } from "../forms/Calendar";

const ATTR: Record<string, string> = {
  class: "className",
  tabindex: "tabIndex",
  for: "htmlFor",
  readonly: "readOnly",
  colspan: "colSpan",
  rowspan: "rowSpan",
  "marker-end": "markerEnd",
  datetime: "dateTime",
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

export interface WidgetOptions {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  /** Callbacks de la aplicación por nombre de evento (`"select"` → `onSelect`). */
  handlers?: Record<string, ((detail: never) => void) | undefined>;
}

/**
 * Binding de React de una pieza (core/widget): estado en una ref, el árbol pintado con `toReact`, la interacción
 * conectada a la raíz y los Calendar incrustados como componentes de React.
 */
export function useWidget<P, C, S>(widget: Widget<P, C, S>, props: P, { id, className, ref, handlers = {} }: WidgetOptions): ReactElement {
  const auto = useId().replace(/:/g, "");
  const uid = id ?? `${widget.root}-${auto}`;
  const root = useRef<HTMLDivElement | null>(null);
  const setRoot = useMergedRef(root, ref);
  const config = widget.configure(props);
  const configRef = useRef(config);
  configRef.current = config;
  const state = useRef<S | null>(null);
  state.current ??= widget.initial(config);
  if (widget.control) state.current = widget.control(config, state.current);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const wantFocus = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const host = useMemo<WidgetHost<C, S>>(
    () => ({
      config: () => configRef.current,
      state: () => state.current!,
      update(patch, focus) {
        state.current = { ...state.current!, ...patch };
        if (focus) wantFocus.current = true;
        rerender();
      },
      emit(name, detail) {
        const fn = handlersRef.current[name] as ((d: unknown) => void) | undefined;
        fn?.(detail);
      },
    }),
    [],
  );
  useEffect(() => (root.current ? widget.attach(root.current, host) : undefined), [host, widget]);
  useLayoutEffect(() => {
    if (!root.current) return;
    const focus = wantFocus.current;
    wantFocus.current = false;
    if (widget.after) widget.after(root.current, host, focus);
    else if (focus) focusActive(root.current);
  });

  const tree = widget.tree(config, state.current, uid);
  const calendar: SlotRenderer = (p) => {
    const name = String(p.name ?? "");
    const calendarProps = (p.props ?? {}) as Record<string, unknown>;
    return createElement(Calendar as unknown as (props: Record<string, unknown>) => ReactNode, {
      key: String(p.key ?? name),
      className: p.className,
      ...calendarProps,
      onValueChange: (value: unknown) => widget.calendarChange?.(host, name, value),
    });
  };
  const { className: _c, ...rest } = (toReact(tree, { calendar }) as { props: Record<string, unknown> }).props;
  const base = (tree.a?.class as string) ?? widget.root;
  return createElement("div", { ...rest, id: uid, className: className ? `${base} ${className}` : base, ref: setRoot });
}
