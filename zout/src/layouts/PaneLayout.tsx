"use client";
import { useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { IconButton, Menu, type MenuEntry } from "@zuccadev-labs/zuix-zui";
import { cx } from "../cx";
import { dropEdge, movePane, neighborPane, paneIds, removePane, setSizesAt, splitPane, type DropEdge, type PaneNode } from "../logic";
import { PaneHeader } from "./PaneHeader";
import { Pane, SplitPane } from "./SplitPane";

export interface PaneInfo {
  title: string;
  icon?: ReactNode;
  subtitle?: ReactNode;
  /** Acciones propias del panel (van en su barra, antes del menú). */
  actions?: ReactNode;
  content: ReactNode;
  /** Se puede cerrar desde su menú. Por defecto, true si hay más de un panel. */
  closable?: boolean;
}

export interface PaneLayoutLabels {
  menu: (title: string) => string;
  splitRight: string;
  splitDown: string;
  moveLeft: string;
  moveRight: string;
  moveUp: string;
  moveDown: string;
  close: string;
  divider: string;
  moved: (title: string) => string;
}

const LABELS: PaneLayoutLabels = {
  menu: (title) => `${title} pane actions`,
  splitRight: "Split right",
  splitDown: "Split down",
  moveLeft: "Move left",
  moveRight: "Move right",
  moveUp: "Move up",
  moveDown: "Move down",
  close: "Close pane",
  divider: "Resize panes",
  moved: (title) => `${title} moved`,
};

export interface PaneLayoutProps {
  /** Árbol de divisiones (controlado): `{ type: "pane", id }` o `{ type: "split", direction, sizes, children }`. */
  layout: PaneNode;
  onLayoutChange: (layout: PaneNode) => void;
  /** Contenido y cabecera de cada panel por su id. */
  panes: Record<string, PaneInfo>;
  /** Dividir un panel: devuelve el id del panel nuevo (y lo añade a `panes`). Sin él, el menú no ofrece dividir. */
  onSplit?: (id: string, direction: "row" | "column") => string | undefined;
  /** Se llama al cerrar un panel desde su menú (ya retirado del árbol). */
  onClose?: (id: string) => void;
  /** Panel con el foco (controlado); sin valor, el último pulsado o enfocado. */
  focusedId?: string;
  onFocusedChange?: (id: string) => void;
  labels?: Partial<PaneLayoutLabels>;
  className?: string;
}

const DIRECTIONS = { moveLeft: "left", moveRight: "right", moveUp: "up", moveDown: "down" } as const;

/**
 * Mosaico de paneles redimensionables: un árbol de divisiones con divisores (puntero y teclado), cabecera por panel y
 * menú para dividir, mover junto al vecino de cada lado o cerrar. Arrastrar la cabecera de un panel sobre otro lo deja
 * en el borde que se señala, o lo intercambia en el centro. Origen: `PaneTree` y `PaneDropZone` de zutool.
 */
export function PaneLayout({
  layout,
  onLayoutChange,
  panes,
  onSplit,
  onClose,
  focusedId,
  onFocusedChange,
  labels: labelsProp,
  className,
}: PaneLayoutProps) {
  const labels = { ...LABELS, ...labelsProp };
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const [innerFocus, setInnerFocus] = useState<string | undefined>(undefined);
  const focused = focusedId ?? innerFocus ?? paneIds(layout)[0];
  const [announce, setAnnounce] = useState("");
  const [drop, setDrop] = useState<{ target: string; edge: DropEdge } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const drag = useRef<{ id: string; pointerId: number; x: number; y: number; active: boolean } | null>(null);
  const count = paneIds(layout).length;

  const focus = (id: string) => {
    if (id === focused) return;
    setInnerFocus(id);
    onFocusedChange?.(id);
  };
  const paneEl = (id: string) => root.current?.querySelector<HTMLElement>(`[data-pane-id="${CSS.escape(id)}"]`) ?? null;
  const rects = () =>
    paneIds(layout).flatMap((id) => {
      const el = paneEl(id);
      return el ? [{ id, rect: el.getBoundingClientRect() }] : [];
    });
  const refocusMenu = (id: string) =>
    requestAnimationFrame(() => paneEl(id)?.querySelector<HTMLElement>(".z-panelayout__menu")?.focus({ preventScroll: true }));

  const moveTo = (id: string, target: string, edge: DropEdge) => {
    const next = movePane(layout, id, target, edge);
    if (next === layout) return;
    onLayoutChange(next);
    setAnnounce(labels.moved(panes[id]?.title ?? id));
  };

  const menuFor = (id: string): MenuEntry[] => {
    const entries: MenuEntry[] = [];
    if (onSplit) {
      for (const [key, direction] of [
        ["splitRight", "row"],
        ["splitDown", "column"],
      ] as const)
        entries.push({
          id: key,
          label: labels[key],
          icon: direction === "row" ? "view-columns" : "bars-2",
          onSelect: () => {
            const created = onSplit(id, direction);
            if (created) onLayoutChange(splitPane(layout, id, created, direction));
          },
        });
      entries.push({ type: "separator" });
    }
    for (const key of ["moveLeft", "moveRight", "moveUp", "moveDown"] as const)
      entries.push({
        id: key,
        label: labels[key],
        onSelect: () => {
          const other = neighborPane(rects(), id, DIRECTIONS[key]);
          if (!other) return;
          moveTo(id, other, "center");
          refocusMenu(id);
        },
      });
    if (panes[id]?.closable ?? count > 1) {
      entries.push({ type: "separator" });
      entries.push({
        id: "close",
        label: labels.close,
        icon: "x-mark",
        danger: true,
        onSelect: () => {
          const next = removePane(layout, id);
          if (!next) return;
          onLayoutChange(next);
          onClose?.(id);
        },
      });
    }
    return entries;
  };

  /* ---- Arrastrar un panel por su cabecera ---- */
  const onHeaderDown = (id: string) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as Element).closest("button, a, input, select, textarea") || count < 2) return;
    drag.current = { id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false };
  };
  const onHeaderMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      d.active = true;
      setDragging(d.id);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* puntero ya liberado */
      }
    }
    const hit = rects().find(
      ({ rect }) => e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom,
    );
    if (!hit || hit.id === d.id) return setDrop(null);
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    setDrop({ target: hit.id, edge: dropEdge(hit.rect, { x: e.clientX, y: e.clientY }, rtl) });
  };
  const onHeaderUp = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    setDragging(null);
    setDrop(null);
    if (d.active && !cancelled && drop) moveTo(d.id, drop.target, drop.edge);
  };

  const render = (node: PaneNode, path: number[]): ReactNode => {
    if (node.type === "pane") {
      const info = panes[node.id];
      const titleId = `${uid}-${node.id}-title`;
      return (
        <section
          key={node.id}
          className="z-panelayout__pane"
          data-pane-id={node.id}
          aria-labelledby={titleId}
          data-dragging={dragging === node.id || undefined}
          onPointerDown={() => focus(node.id)}
          onFocus={() => focus(node.id)}
        >
          <Pane
            focused={count > 1 ? focused === node.id : undefined}
            header={
              <div
                className="z-panelayout__grab"
                onPointerDown={onHeaderDown(node.id)}
                onPointerMove={onHeaderMove}
                onPointerUp={(e) => onHeaderUp(e, false)}
                onPointerCancel={(e) => onHeaderUp(e, true)}
              >
                <PaneHeader
                  title={info?.title ?? node.id}
                  titleId={titleId}
                  icon={info?.icon}
                  subtitle={info?.subtitle}
                  focused={count > 1 ? focused === node.id : undefined}
                  actionsLabel={labels.menu(info?.title ?? node.id)}
                  actions={info?.actions}
                  menu={
                    <Menu
                      label={labels.menu(info?.title ?? node.id)}
                      items={menuFor(node.id)}
                      trigger={
                        <IconButton
                          icon="ellipsis-horizontal"
                          label={labels.menu(info?.title ?? node.id)}
                          size="sm"
                          className="z-panelayout__menu"
                        />
                      }
                    />
                  }
                />
              </div>
            }
          >
            {info?.content}
          </Pane>
          {drop?.target === node.id ? <div className="z-panelayout__drop" data-edge={drop.edge} aria-hidden="true" /> : null}
        </section>
      );
    }
    return (
      <SplitPane
        key={paneIds(node).join("|")}
        direction={node.direction}
        sizes={node.sizes}
        onSizesChange={(sizes) => onLayoutChange(setSizesAt(layout, path, sizes))}
        dividerLabel={labels.divider}
      >
        {node.children.map((child, i) => render(child, [...path, i]))}
      </SplitPane>
    );
  };

  return (
    <div ref={root} className={cx("z-panelayout", className)} data-dragging={dragging ? "" : undefined}>
      {render(layout, [])}
      <span className="z-panelayout__status z-sr-only" role="status">
        {announce}
      </span>
    </div>
  );
}
