"use client";
import { useRef, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { pickForClass, variantClasses, variantMap, type AdaptiveMap, type SizeClass } from "../adaptive";
import type { MeasureMode } from "../adaptive-runtime";
import { SizeClassContext, useIsoLayoutEffect, useMeasuredSizeClass } from "./size-class";

export interface AdaptiveSwitchProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Variantes por nombre: `{ tabs: <Tabs … />, select: <NativeSelect … /> }`. */
  variants: Record<string, ReactNode>;
  /**
   * Variante de cada clase: `{ compact: { variant: "select" }, medium: { variant: "tabs" } }`, heredada hacia arriba.
   * La que falte por abajo es `fallback`.
   */
  adaptive: AdaptiveMap;
  /** Variante de las clases sin ajuste. Por defecto, la primera de `variants`. */
  fallback?: string;
  /** Qué se mide: su propia caja (por defecto, es su contenedor de consulta) o la ventana. */
  measure?: MeasureMode;
  /** Aviso con cada cambio de variante (también la primera medida). */
  onVariantChange?: (variant: string, sizeClass: SizeClass) => void;
  as?: ElementType;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Una variante de un componente por clase de tamaño (Tabs en ancho, Select en compacto). Es su propio contenedor de
 * consulta: decide con el ancho que le queda. Hasta medir están todas en el documento y la hoja muestra la de la clase
 * activa, así que el servidor y la hidratación no saltan; medido, queda montada solo esa. Si el foco estaba en la
 * variante que se va, pasa al primer control de la nueva.
 */
export function AdaptiveSwitch({
  variants,
  adaptive,
  fallback,
  measure = "container",
  onVariantChange,
  as: Tag = "div",
  className,
  ...rest
}: AdaptiveSwitchProps) {
  const ref = useRef<HTMLElement>(null);
  const hadFocus = useRef(false);
  const base = fallback ?? Object.keys(variants)[0] ?? "";
  const map = variantMap(adaptive);
  const state = useMeasuredSizeClass(ref, measure, () => {
    const el = ref.current;
    hadFocus.current = !!el && el.contains(el.ownerDocument.activeElement);
  });
  const active = state ? pickForClass(map, state.sizeClass, base) : null;

  const notify = useRef(onVariantChange);
  notify.current = onVariantChange;
  useIsoLayoutEffect(() => {
    if (!active || !state) return;
    notify.current?.(active, state.sizeClass);
    const el = ref.current;
    if (!hadFocus.current || !el) return;
    hadFocus.current = false;
    // Al fotograma siguiente, cuando el resto de la página ya cambió con la misma medida (un cajón que se cierra, una
    // zona que deja de ser inerte), y solo si el foco se perdió.
    const frame = requestAnimationFrame(() => {
      const doc = el.ownerDocument;
      if (!doc.activeElement || doc.activeElement === doc.body) el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const groups = [...variantClasses(map, base)].filter(([name]) => name in variants);
  return (
    <Tag
      {...rest}
      ref={ref}
      className={cx("z-adaptive-switch", className)}
      data-measure={measure === "window" ? "window" : undefined}
      data-measured={active ? "" : undefined}
      data-variant={active ?? undefined}
    >
      <SizeClassContext.Provider value={state}>
        {groups.map(([name, classes]) =>
          active && name !== active ? null : (
            <div key={name} className="z-adaptive-switch__variant" data-variant={name} data-classes={classes.join(" ")}>
              {variants[name]}
            </div>
          ),
        )}
      </SizeClassContext.Provider>
    </Tag>
  );
}
