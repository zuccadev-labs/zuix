"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { attachOverflowList, visibleIndexes, type OverflowSide } from "../../core/overflow-list";
import { cx } from "../../cx";
import { inertProp } from "../../react-compat";
import { Menu } from "../overlay/Menu";
import type { MenuEntry } from "../overlay/internal";

export interface OverflowItem {
  id: string;
  label: string;
  icon?: IconName;
  /** Enlace: el elemento es un `<a>` y la entrada del menú también. */
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
}

export interface OverflowListProps {
  items: readonly OverflowItem[];
  /** Cómo se pinta un elemento visible (por defecto, un botón fantasma o un enlace). */
  renderItem?: (item: OverflowItem) => ReactNode;
  /** Por dónde se recorta: por el final (por defecto) o por el principio (migas de pan). */
  side?: OverflowSide;
  /** Los que se quedan siempre a la vista. */
  minVisible?: number;
  /** Nombre del grupo. */
  label?: string;
  /** Nombre del botón «+N»: «{count} more». */
  moreLabel?: string;
  size?: "sm" | "md";
  className?: string;
  id?: string;
}

function defaultItem(item: OverflowItem, size: "sm" | "md") {
  const body = (
    <>
      {item.icon ? <Icon name={item.icon} size={16} /> : null}
      <span className="z-overflow-list__text">{item.label}</span>
    </>
  );
  return item.href ? (
    <a className="z-btn z-btn--ghost" data-size={size} href={item.href} aria-disabled={item.disabled || undefined}>
      {body}
    </a>
  ) : (
    <button type="button" className="z-btn z-btn--ghost" data-size={size} disabled={item.disabled} onClick={item.onSelect}>
      {body}
    </button>
  );
}

/**
 * Fila de elementos en la que los que no caben pasan a un menú «+N» (patrón APG «menu button»). Mide con un
 * ResizeObserver; los que sobran siguen en el documento, fuera del flujo e inertes, y el menú los repite.
 */
export function OverflowList({
  items,
  renderItem,
  side = "end",
  minVisible = 0,
  label,
  moreLabel = "{count} more",
  size = "sm",
  className,
  id,
}: OverflowListProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const [count, setCount] = useState(items.length);
  const live = useRef({ side, minVisible });
  live.current = { side, minVisible };
  useEffect(
    () =>
      root.current
        ? attachOverflowList(root.current, { apply: setCount, side: () => live.current.side, minVisible: () => live.current.minVisible })
        : undefined,
    [],
  );
  const shown = new Set(visibleIndexes(items.length, Math.min(count, items.length), side));
  const hidden = items.filter((_, i) => !shown.has(i));
  const entries: MenuEntry[] = hidden.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    href: item.href,
    disabled: item.disabled,
    onSelect: item.onSelect,
  }));
  const more = (
    <button
      type="button"
      className="z-btn z-btn--ghost z-overflow-list__more"
      data-size={size}
      data-overflow={hidden.length ? undefined : ""}
      inert={inertProp(!hidden.length)}
      aria-label={moreLabel.replace("{count}", String(hidden.length))}
    >
      <span className="z-overflow-list__count">+{hidden.length}</span>
    </button>
  );
  return (
    <div ref={root} id={id} role="group" aria-label={label} className={cx("z-overflow-list", className)} data-side={side}>
      {items.map((item, i) => {
        const off = !shown.has(i);
        return (
          <div
            key={item.id}
            className="z-overflow-list__item"
            data-id={item.id}
            data-overflow={off ? "" : undefined}
            aria-hidden={off || undefined}
            inert={inertProp(off)}
          >
            {renderItem ? renderItem(item) : defaultItem(item, size)}
          </div>
        );
      })}
      <Menu trigger={more} items={entries} size="md" align="end" />
    </div>
  );
}
