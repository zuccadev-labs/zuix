"use client";
import { useId, useState, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";

export interface SidePanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Acciones a la derecha del título. */
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Relleno interior del cuerpo. Por defecto, true. */
  padded?: boolean;
  className?: string;
}

/** Andamiaje de un panel lateral: barra de título, cuerpo con desplazamiento y pie. Origen: Panel de zutool. */
export function SidePanel({ title, subtitle, actions, children, footer, padded = true, className }: SidePanelProps) {
  return (
    <section className={cx("z-sidepanel", className)}>
      {title || actions ? (
        <div className="z-sidepanel__head">
          <div className="z-sidepanel__titles">
            {title ? <div className="z-sidepanel__title">{title}</div> : null}
            {subtitle ? <div className="z-sidepanel__subtitle">{subtitle}</div> : null}
          </div>
          {actions ? <div className="z-sidepanel__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="z-sidepanel__body" data-padded={padded || undefined}>
        {children}
      </div>
      {footer ? <div className="z-sidepanel__foot">{footer}</div> : null}
    </section>
  );
}

export interface SidebarSectionProps {
  title: ReactNode;
  /** Contador junto al título. */
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  /** Controlado. Sin valor, la sección gestiona su propio estado. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** La sección abierta reparte el alto libre con las demás. */
  grow?: boolean;
  className?: string;
}

/** Sección plegable de una sidebar en acordeón. Origen: barra izquierda de zutool. */
export function SidebarSection({
  title,
  count,
  actions,
  children,
  open,
  defaultOpen = true,
  onOpenChange,
  grow,
  className,
}: SidebarSectionProps) {
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open ?? inner;
  const id = useId();
  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInner(next);
    onOpenChange?.(next);
  };
  return (
    <section className={cx("z-sidebar__section", className)} data-open={isOpen || undefined} data-grow={grow || undefined}>
      <div className="z-sidebar__head">
        <button type="button" className="z-sidebar__fold" aria-expanded={isOpen} aria-controls={id} onClick={toggle}>
          <Icon name={isOpen ? "chevron-down-small" : "chevron-right-small"} size={12} />
          <span className="z-sidebar__title">{title}</span>
          {count !== undefined ? <span className="z-sidebar__count">{count}</span> : null}
        </button>
        {actions ? <div className="z-sidebar__actions">{actions}</div> : null}
      </div>
      <div className="z-sidebar__body" id={id} hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}

/** Contenedor de secciones de sidebar, con pie opcional fijo abajo. */
export function Sidebar({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cx("z-sidebar", className)}>
      <div className="z-sidebar__sections">{children}</div>
      {footer ? <div className="z-sidebar__foot">{footer}</div> : null}
    </div>
  );
}
