"use client";
import { createElement, useEffect, useId, useMemo, useReducer, useRef, type ReactElement, type ReactNode, type Ref } from "react";
import { toReact, type SlotRenderer } from "../vnode";
import { focusActive, type Widget, type WidgetHost } from "../../core/widget";
import { useMergedRef } from "../../refs";
import { Calendar } from "../forms/Calendar";
import { useIsoLayoutEffect } from "../../primitives/hooks";

export { toReact, type SlotRenderer };

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
  useIsoLayoutEffect(() => {
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
