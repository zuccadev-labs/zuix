"use client";
import { Children, useEffect, useId, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { Popover, Tooltip } from "@zuccadev-labs/zuix-zui";
import { cx } from "../cx";
import { SidebarContext, useSidebar } from "./sidebar-context";

export interface SidebarItemProps {
  /** Texto del item; plegada la sidebar, es el nombre accesible y el tooltip. */
  label: string;
  icon?: IconName;
  /** Con `href` el item es un enlace; sin él, un botón. Un item con submenú es siempre un botón. */
  href?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Página actual: `aria-current="page"` y marca de acento. */
  active?: boolean;
  /** Contador o etiqueta corta al final (sobre el icono si está plegada). */
  badge?: number | string;
  /** Acción al final del item (un IconButton), oculta con la sidebar plegada. */
  action?: ReactNode;
  /** Submenú: `SidebarItem` anidados. Desplegada, una sección que se abre en su sitio; plegada, un panel flotante. */
  children?: ReactNode;
  /** Submenú abierto (controlado). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Item de navegación de la sidebar, con icono, contador, acción y submenú. Desplegado, el submenú es un disclosure
 * (`aria-expanded` y `aria-controls`); con la sidebar plegada a iconos, el item muestra solo el icono con su nombre en
 * un tooltip, y el submenú se abre en un panel flotante junto al rail.
 */
export function SidebarItem({
  label,
  icon,
  href,
  onClick,
  active,
  badge,
  action,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled,
  className,
}: SidebarItemProps) {
  const { collapsed, depth } = useSidebar();
  const id = useId();
  const sub = Children.count(children) > 0;
  const [inner, setInner] = useState(defaultOpen);
  const open = openProp ?? inner;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInner(next);
    onOpenChange?.(next);
  };
  const flyout = sub && collapsed && depth === 0;
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  // Al desplegar la sidebar el panel flotante no se queda abierto.
  useEffect(() => {
    if (!collapsed) setFlyoutOpen(false);
  }, [collapsed]);

  const body = (
    <>
      {icon ? (
        <span className="z-sidebar__icon">
          <Icon name={icon} variant={active ? "solid" : "outline"} size={16} />
        </span>
      ) : null}
      <span className="z-sidebar__label">{label}</span>
      {badge !== undefined ? <span className="z-sidebar__badge">{badge}</span> : null}
      {sub && !flyout ? (
        <span className="z-sidebar__chevron" aria-hidden="true">
          <Icon name="chevron-right-small" size={12} />
        </span>
      ) : null}
    </>
  );
  const common = {
    className: "z-sidebar__link",
    "data-active": active || undefined,
    "aria-current": active ? ("page" as const) : undefined,
  };

  let link: ReactElement;
  if (flyout) {
    link = (
      <Popover
        label={label}
        side="right"
        align="start"
        className="z-sidebar__flyout"
        open={flyoutOpen}
        onOpenChange={setFlyoutOpen}
        trigger={
          <button type="button" {...common} disabled={disabled} data-has-sub="">
            {body}
          </button>
        }
      >
        <div className="z-sidebar__flyout-title">{label}</div>
        <SidebarContext.Provider value={{ collapsed: false, depth: depth + 1 }}>
          <div className="z-sidebar__sub" role="group" aria-label={label}>
            {children}
          </div>
        </SidebarContext.Provider>
      </Popover>
    );
  } else if (sub) {
    link = (
      <button
        type="button"
        {...common}
        disabled={disabled}
        data-has-sub=""
        aria-expanded={open}
        aria-controls={`${id}-sub`}
        onClick={(event) => {
          onClick?.(event);
          setOpen(!open);
        }}
      >
        {body}
      </button>
    );
  } else if (href && !disabled) {
    link = (
      <a {...common} href={href} onClick={onClick}>
        {body}
      </a>
    );
  } else {
    link = (
      <button type="button" {...common} disabled={disabled} onClick={onClick}>
        {body}
      </button>
    );
  }
  // Plegada: el nombre se ve en un tooltip. El item con submenú ya lo muestra como título de su panel flotante.
  if (collapsed && depth === 0 && !flyout) {
    link = (
      <Tooltip content={label} side="right">
        {link}
      </Tooltip>
    );
  }

  return (
    <div className={cx("z-sidebar__item", className)} data-open={(sub && !flyout && open) || undefined}>
      <div className="z-sidebar__row">
        {link}
        {action ? <span className="z-sidebar__action">{action}</span> : null}
      </div>
      {sub && !flyout ? (
        <div className="z-sidebar__sub" id={`${id}-sub`} role="group" aria-label={label} hidden={!open}>
          <SidebarContext.Provider value={{ collapsed: false, depth: depth + 1 }}>{children}</SidebarContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

export interface SidebarTriggerProps {
  /** Estado de la sidebar que controla. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Id de la sidebar (`aria-controls`). */
  controls?: string;
  /** Nombre accesible. */
  label?: string;
  /** Atajo Ctrl+B (⌘B en macOS) en todo el documento. Opt-in: puede chocar con atajos de la aplicación. */
  shortcut?: boolean;
  className?: string;
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Botón que pliega la sidebar a iconos y la despliega. `aria-expanded` dice si está desplegada. */
export function SidebarTrigger({
  collapsed,
  onCollapsedChange,
  controls,
  label = "Toggle sidebar",
  shortcut,
  className,
}: SidebarTriggerProps) {
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || event.altKey || event.shiftKey || !(isMac() ? event.metaKey : event.ctrlKey)) return;
      event.preventDefault();
      onCollapsedChange(!collapsed);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut, collapsed, onCollapsedChange]);
  return (
    <button
      type="button"
      className={cx("z-sidebar__trigger", className)}
      aria-label={label}
      title={label}
      aria-expanded={!collapsed}
      aria-controls={controls}
      aria-keyshortcuts={shortcut ? "Control+B Meta+B" : undefined}
      data-shortcut={shortcut || undefined}
      data-collapsed={collapsed || undefined}
      onClick={() => onCollapsedChange(!collapsed)}
    >
      <Icon name={collapsed ? "chevron-double-right" : "chevron-double-left"} size={16} />
    </button>
  );
}
