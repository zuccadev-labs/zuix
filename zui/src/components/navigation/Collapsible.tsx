"use client";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { useControllable, useIsoLayoutEffect, useLatest } from "../../primitives/hooks";

export interface CollapsibleProps {
  /** Id de la región (`<id>-content`) y del bloque. Sin valor, uno generado. */
  id?: string;
  /** Contenido del botón que pliega y despliega. */
  title: ReactNode;
  /** Icono antes del título. */
  icon?: IconName;
  children?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /**
   * Colapso parcial: alto (px) que se sigue viendo plegado, con un fundido al final. El contenido sigue en la página
   * (lo leen los lectores de pantalla) y se despliega solo si el foco entra en la parte oculta.
   */
  peek?: number;
  /** `plain`: solo la fila del botón. `card`: superficie con borde, como una tarjeta. */
  variant?: "plain" | "card";
  className?: string;
}

/**
 * Bloque que se pliega y despliega (patrón APG «disclosure»): un botón con `aria-expanded` y `aria-controls` y una
 * región que, plegada, lleva `hidden="until-found"`: la búsqueda en la página del navegador la encuentra y la abre.
 */
export function Collapsible({
  id: idProp,
  title,
  icon,
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  disabled,
  peek,
  variant = "plain",
  className,
}: CollapsibleProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const contentId = `${id}-content`;
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  const content = useRef<HTMLDivElement | null>(null);
  const latest = useLatest({ setOpen, disabled, open, partial: peek !== undefined && peek > 0 });
  const partial = peek !== undefined && peek > 0;

  // La búsqueda en la página abre la región que contiene el resultado (evento `beforematch` de `hidden="until-found"`).
  useEffect(() => {
    const el = content.current;
    if (!el) return;
    const reveal = () => {
      if (!latest.current.disabled) latest.current.setOpen(true);
    };
    // Plegado parcial: el foco que entra en la parte recortada la despliega (no queda tapado).
    const focus = () => {
      if (latest.current.partial && !latest.current.open) reveal();
    };
    el.addEventListener("beforematch", reveal);
    el.addEventListener("focusin", focus);
    return () => {
      el.removeEventListener("beforematch", reveal);
      el.removeEventListener("focusin", focus);
    };
  }, [latest]);

  const trigger = (
    <button
      type="button"
      className="z-collapsible__trigger"
      aria-expanded={open}
      aria-controls={contentId}
      disabled={disabled}
      onClick={() => setOpen(!open)}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      <span className="z-collapsible__title">{title}</span>
      <span className="z-collapsible__chevron" aria-hidden="true">
        <Icon name="chevron-down" size={16} />
      </span>
    </button>
  );
  // React solo escribe `hidden` como booleano: plegado, el atributo pasa a `until-found` (la búsqueda en la página
  // del navegador encuentra el texto y lo abre). Sin JavaScript queda `hidden` normal.
  useIsoLayoutEffect(() => {
    const el = content.current;
    if (el && !open && !partial) el.setAttribute("hidden", "until-found");
  }, [open, partial]);
  const style = partial ? ({ "--z-collapsible-peek": `${peek}px` } as CSSProperties) : undefined;
  return (
    <div
      id={idProp}
      className={cx("z-collapsible", className)}
      data-state={open ? "open" : "closed"}
      data-variant={variant}
      data-peek={partial || undefined}
      data-disabled={disabled || undefined}
      style={style}
    >
      {/* Plegado parcial: el botón («Show more») va tras el texto que deja ver, también en el orden de lectura. */}
      {partial ? null : trigger}
      <div
        ref={content}
        id={contentId}
        className="z-collapsible__content"
        data-state={open ? "open" : "closed"}
        // Plegado del todo: fuera de la vista y del árbol accesible, pero la búsqueda en la página lo encuentra.
        hidden={!open && !partial ? true : undefined}
      >
        {children}
      </div>
      {partial ? trigger : null}
    </div>
  );
}
