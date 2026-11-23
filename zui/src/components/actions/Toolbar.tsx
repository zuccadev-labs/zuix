"use client";
import { useContext, useEffect, useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { setToolbarStop, toolbarTarget } from "../../core/toolbar";
import { cx } from "../../cx";
import { useMergedRef } from "../../refs";
import { useIsoLayoutEffect } from "../../primitives/hooks";
import { ToolbarContext } from "./toolbar-context";
import { withRef } from "../../react-compat";

interface ToolbarBase extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  orientation?: "horizontal" | "vertical";
  /** `glass`: barra de cromo (cristal, canto y brillo). `plain`: sin fondo, para dentro de un panel. */
  variant?: "glass" | "plain";
  size?: "sm" | "md";
  /** Id del elemento sobre el que actúan los controles (editor, lienzo, vista previa): `aria-controls`. */
  controls?: string;
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

/** La barra es un widget compuesto: necesita nombre, con `label` o con `aria-labelledby`. */
export type ToolbarProps = ToolbarBase & ({ label: string; "aria-labelledby"?: string } | { label?: undefined; "aria-labelledby": string });

/**
 * Barra de herramientas (patrón APG «toolbar»): una sola parada de tabulación para todos sus controles, también los
 * de sus grupos. Las flechas del eje los recorren con vuelta (en RTL la izquierda avanza), Inicio y Fin van a los
 * extremos y la barra recuerda el último control enfocado. Un campo de texto o un select conserva sus flechas.
 */
export const Toolbar = withRef(function Toolbar({
  label,
  orientation = "horizontal",
  variant = "glass",
  size = "md",
  controls,
  className,
  children,
  ref,
  onKeyDown,
  onFocus,
  ...rest
}: ToolbarProps) {
  const node = useRef<HTMLDivElement | null>(null);
  const setRef = useMergedRef(node, ref);
  // Tras cada render (y cuando cambian los controles que hay dentro) la parada sigue en el último control enfocado.
  useIsoLayoutEffect(() => {
    if (node.current) setToolbarStop(node.current);
  });
  useEffect(() => {
    const bar = node.current;
    if (!bar || typeof MutationObserver !== "function") return;
    const observer = new MutationObserver(() => setToolbarStop(bar));
    observer.observe(bar, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden"] });
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !(event.target instanceof Element)) return;
    const next = toolbarTarget(event.currentTarget, event.target, event.key);
    if (!next) return;
    event.preventDefault();
    setToolbarStop(event.currentTarget, next);
    next.focus();
  };

  return (
    <ToolbarContext.Provider value={orientation}>
      <div
        {...rest}
        ref={setRef}
        role="toolbar"
        aria-label={label}
        aria-orientation={orientation}
        aria-controls={controls}
        className={cx("z-toolbar", variant === "glass" && "z-liquid", className)}
        data-variant={variant}
        data-size={size}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          onFocus?.(event);
          if (event.target !== event.currentTarget) setToolbarStop(event.currentTarget, event.target);
        }}
      >
        {children}
      </div>
    </ToolbarContext.Provider>
  );
});

export interface ToolbarGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  /** Nombre del grupo («Style», «Alignment»). */
  label: string;
  children?: ReactNode;
}

/** Grupo de controles relacionados dentro de una barra (`role="group"` con nombre). */
export function ToolbarGroup({ label, className, children, ...rest }: ToolbarGroupProps) {
  return (
    <div {...rest} role="group" aria-label={label} className={cx("z-toolbar__group", className)}>
      {children}
    </div>
  );
}

/** Separador entre grupos de una barra, perpendicular a ella: vertical en una barra horizontal y al revés. */
export function ToolbarSeparator({ className }: { className?: string }) {
  const bar = useContext(ToolbarContext);
  return (
    <div
      role="separator"
      aria-orientation={bar === "vertical" ? "horizontal" : "vertical"}
      className={cx("z-toolbar__separator", className)}
    />
  );
}
