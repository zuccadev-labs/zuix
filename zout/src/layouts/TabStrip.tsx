"use client";
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";
import { beforeFor, dropIndex, finalIndex, moveBefore, revealOffset, tabKeyIndex, tabMoveIndex } from "../logic";

export interface WorkTab {
  id: string;
  title: ReactNode;
  /** Icono o indicador antes del título. */
  leading?: ReactNode;
  closable?: boolean;
  /** Id del panel (`role="tabpanel"`) que muestra la pestaña: se anuncia con `aria-controls`. */
  controls?: string;
  /** Grupo al que pertenece (`groups`). */
  groupId?: string;
  /** Cambios sin guardar: punto tras el título y texto en el nombre accesible. */
  modified?: boolean;
  /** Trabajo en curso: anillo de actividad tras el título. */
  busy?: boolean;
}

export type TabGroupTone = "neutral" | "accent" | "info" | "success" | "warning" | "danger";

export interface TabGroup {
  id: string;
  label: string;
  /** Color del grupo (chip y subrayado de sus pestañas). */
  tone?: TabGroupTone;
  /** Plegado: sus pestañas se ocultan (salvo la activa). */
  collapsed?: boolean;
}

export interface TabStripProps {
  tabs: WorkTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  /** Si se pasa, muestra el botón de pestaña nueva. */
  onAdd?: () => void;
  /** Grupos de pestañas: un chip antes de la primera de cada grupo. */
  groups?: TabGroup[];
  /** Pulsar el chip de un grupo (plegar o desplegar). */
  onGroupToggle?: (id: string) => void;
  /** Activa la reordenación: arrastrar una pestaña o Ctrl+Mayús+flechas. Recibe los ids en el orden nuevo. */
  onReorder?: (ids: string[]) => void;
  label?: string;
  closeLabel?: string;
  addLabel?: string;
  /** Texto accesible de una pestaña con cambios sin guardar. */
  modifiedLabel?: string;
  /** Texto accesible de una pestaña ocupada. */
  busyLabel?: string;
  /** Anuncio tras mover una pestaña con el teclado. */
  movedLabel?: (title: string, position: number, total: number) => string;
  className?: string;
}

const DRAG_START = 4;
const defaultMoved = (title: string, position: number, total: number) => `${title} moved to position ${position} of ${total}`;
const textOf = (tab: WorkTab) => (typeof tab.title === "string" || typeof tab.title === "number" ? String(tab.title) : tab.id);

interface Drag {
  id: string;
  pointerId: number;
  x: number;
  active: boolean;
  gap: number;
  /** Tramos de las pestañas medidos al empezar: durante el arrastre solo se mueve la propia pestaña. */
  spans: { start: number; end: number }[];
}

/**
 * Tira de pestañas de trabajo con cierre, alta, grupos de color y reordenación (arrastre con marca de soltar, o
 * Ctrl+Mayús+flechas con anuncio). Origen: `tabstrip` y `tab-stack` de zutool.
 */
export function TabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onAdd,
  groups,
  onGroupToggle,
  onReorder,
  label = "Tabs",
  closeLabel = "Close tab",
  addLabel = "New tab",
  modifiedLabel = "modified",
  busyLabel = "busy",
  movedLabel = defaultMoved,
  className,
}: TabStripProps) {
  const uid = useId();
  const listRef = useRef<HTMLDivElement>(null);
  // Tras cerrar o mover con el teclado, el foco pasa a la pestaña activa.
  const refocus = useRef(false);
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);
  const [announce, setAnnounce] = useState("");
  const [dropAt, setDropAt] = useState<{ id: string; side: "before" | "after" } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const groupOf = (tab: WorkTab) => (tab.groupId ? groups?.find((g) => g.id === tab.groupId) : undefined);
  const shown = tabs.filter((tab) => !groupOf(tab)?.collapsed || tab.id === activeId);
  const shownIds = shown.map((tab) => tab.id);

  // La pestaña activa siempre queda a la vista: la tira se desplaza sola al cambiar de pestaña, al añadir o cerrar y al estrecharse.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tabs` no se lee dentro; es el disparador para volver a revelar la pestaña activa cuando se añade, se cierra o se mueve otra.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const reveal = () => {
      const tab = list.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`)?.parentElement;
      if (!tab) return;
      const offset = revealOffset(tab.getBoundingClientRect(), list.getBoundingClientRect());
      if (offset) list.scrollLeft += offset;
    };
    reveal();
    if (refocus.current) {
      refocus.current = false;
      list.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`)?.focus();
    }
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(reveal);
    ro.observe(list);
    return () => ro.disconnect();
  }, [activeId, tabs]);

  const rtlOf = (el: Element) => getComputedStyle(el).direction === "rtl";

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = shown.findIndex((t) => t.id === activeId);
    const current = shown[i];
    // Supr cierra la pestaña activa (patrón de pestañas de WAI-ARIA): es la vía de teclado y de lector de pantalla,
    // porque un `tablist` solo admite pestañas y el botón de cierre queda como ayuda de puntero.
    if (e.key === "Delete" && onClose && current && current.closable !== false) {
      e.preventDefault();
      refocus.current = true;
      onClose(current.id);
      return;
    }
    const rtl = rtlOf(e.currentTarget);
    // Ctrl+Mayús+flechas (o Inicio y Fin) mueven la pestaña activa: alternativa de teclado al arrastre.
    if (onReorder && current && e.ctrlKey && e.shiftKey && !e.altKey) {
      const to = tabMoveIndex(e.key, i, shown.length, rtl);
      if (to < 0) return;
      e.preventDefault();
      refocus.current = true;
      onReorder(
        moveBefore(
          tabs.map((t) => t.id),
          current.id,
          beforeFor(shownIds, current.id, to),
        ),
      );
      setAnnounce(movedLabel(textOf(current), to + 1, shown.length));
      return;
    }
    const next = shown[tabKeyIndex(e.key, i, shown.length, rtl)];
    if (!next) return;
    e.preventDefault();
    onSelect(next.id);
    e.currentTarget.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(next.id)}"]`)?.focus();
  };

  /* ---- Arrastre: la pestaña sigue al puntero y una marca señala el hueco; el orden cambia al soltar ---- */
  const spans = () =>
    shownIds.map((id) => {
      const rect = listRef.current?.querySelector(`[data-tab-id="${CSS.escape(id)}"]`)?.parentElement?.getBoundingClientRect();
      return { start: rect?.left ?? 0, end: rect?.right ?? 0 };
    });
  const onPointerDown = (id: string) => (e: PointerEvent<HTMLButtonElement>) => {
    if (!onReorder || e.button !== 0) return;
    drag.current = { id, pointerId: e.pointerId, x: e.clientX, active: false, gap: -1, spans: [] };
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.x;
    if (!d.active) {
      if (Math.abs(dx) < DRAG_START) return;
      d.active = true;
      d.spans = spans();
      setDragging(d.id);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* puntero ya liberado */
      }
    }
    e.currentTarget.parentElement?.style.setProperty("--z-tab-drag", `${dx}px`);
    const list = listRef.current;
    const gap = dropIndex(e.clientX, d.spans, list ? rtlOf(list) : false);
    d.gap = gap;
    const from = shownIds.indexOf(d.id);
    // Soltar en su propio sitio no muestra marca.
    if (gap === from || gap === from + 1) setDropAt(null);
    else if (gap < shownIds.length) setDropAt({ id: shownIds[gap] as string, side: "before" });
    else setDropAt({ id: shownIds[shownIds.length - 1] as string, side: "after" });
  };
  const endDrag = (e: PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    e.currentTarget.parentElement?.style.removeProperty("--z-tab-drag");
    setDropAt(null);
    setDragging(null);
    if (!d.active) return;
    swallowClick.current = true;
    if (cancelled || d.gap < 0 || !onReorder) return;
    const to = finalIndex(shownIds.indexOf(d.id), d.gap);
    const next = moveBefore(
      tabs.map((t) => t.id),
      d.id,
      beforeFor(shownIds, d.id, to),
    );
    if (next.join("\u0000") !== tabs.map((t) => t.id).join("\u0000")) onReorder(next);
  };

  const closable = (tab: WorkTab) => Boolean(onClose) && tab.closable !== false;
  let previousGroup: string | undefined;
  return (
    <div className={cx("z-tabstrip", className)} data-reorderable={onReorder ? "" : undefined}>
      <div ref={listRef} className="z-tabstrip__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          const group = groupOf(tab);
          const chip = group && group.id !== previousGroup;
          previousGroup = group?.id;
          const hidden = Boolean(group?.collapsed) && !selected;
          return (
            <Fragment key={tab.id}>
              {chip ? (
                // El chip es ayuda de puntero (un tablist solo admite pestañas): la pertenencia al grupo se anuncia en
                // cada pestaña (aria-describedby) y plegarlo es opcional.
                <div className="z-tabstrip__group" role="presentation" data-group-id={group.id} data-tone={group.tone ?? "neutral"}>
                  <button
                    type="button"
                    className="z-tabstrip__chip"
                    aria-hidden="true"
                    tabIndex={-1}
                    aria-expanded={!group.collapsed}
                    title={group.label}
                    onClick={() => onGroupToggle?.(group.id)}
                  >
                    {group.label}
                  </button>
                </div>
              ) : null}
              <div
                className="z-tabstrip__tab"
                role="presentation"
                data-selected={selected || undefined}
                data-group={group?.id}
                data-tone={group ? (group.tone ?? "neutral") : undefined}
                data-dragging={dragging === tab.id || undefined}
                data-drop={dropAt?.id === tab.id ? dropAt.side : undefined}
                hidden={hidden || undefined}
              >
                <button
                  type="button"
                  role="tab"
                  className="z-tabstrip__select"
                  aria-selected={selected}
                  aria-controls={tab.controls}
                  aria-describedby={group ? `${uid}-group-${group.id}` : undefined}
                  aria-keyshortcuts={
                    [closable(tab) ? "Delete" : "", onReorder ? "Control+Shift+ArrowLeft Control+Shift+ArrowRight" : ""]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  aria-busy={tab.busy || undefined}
                  tabIndex={selected ? 0 : -1}
                  data-tab-id={tab.id}
                  onClick={() => {
                    if (swallowClick.current) {
                      swallowClick.current = false;
                      return;
                    }
                    onSelect(tab.id);
                  }}
                  onPointerDown={onPointerDown(tab.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={(e) => endDrag(e, false)}
                  onPointerCancel={(e) => endDrag(e, true)}
                  // WebKit puede iniciar un arrastrar y soltar nativo, que cancela los eventos de puntero.
                  onDragStart={(e) => e.preventDefault()}
                >
                  {tab.leading}
                  <span className="z-tabstrip__title">{tab.title}</span>
                  {tab.busy ? (
                    <span className="z-tabstrip__mark" data-mark="busy">
                      <span className="z-sr-only">{`, ${busyLabel}`}</span>
                    </span>
                  ) : tab.modified ? (
                    <span className="z-tabstrip__mark" data-mark="modified">
                      <span className="z-sr-only">{`, ${modifiedLabel}`}</span>
                    </span>
                  ) : null}
                </button>
                {onClose && closable(tab) ? (
                  <button
                    type="button"
                    className="z-tabstrip__close"
                    title={closeLabel}
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={() => onClose(tab.id)}
                  >
                    <Icon name="x-mark" size={12} />
                  </button>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>
      {groups?.map((group) => (
        <span key={group.id} id={`${uid}-group-${group.id}`} hidden>
          {group.label}
        </span>
      ))}
      {onAdd ? (
        <button type="button" className="z-tabstrip__add" aria-label={addLabel} onClick={onAdd}>
          <Icon name="plus" size={14} />
        </button>
      ) : null}
      {onReorder ? (
        <span className="z-tabstrip__status z-sr-only" role="status">
          {announce}
        </span>
      ) : null}
    </div>
  );
}
