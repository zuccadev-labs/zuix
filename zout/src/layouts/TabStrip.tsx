"use client";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";
import { revealOffset, tabKeyIndex } from "../logic";

export interface WorkTab {
  id: string;
  title: ReactNode;
  /** Icono o indicador antes del título. */
  leading?: ReactNode;
  closable?: boolean;
  /** Id del panel (`role="tabpanel"`) que muestra la pestaña: se anuncia con `aria-controls`. */
  controls?: string;
}

export interface TabStripProps {
  tabs: WorkTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  /** Si se pasa, muestra el botón de pestaña nueva. */
  onAdd?: () => void;
  label?: string;
  closeLabel?: string;
  addLabel?: string;
  className?: string;
}

/** Tira de pestañas de trabajo con cierre y alta. Origen: `tabstrip` de zutool. */
export function TabStrip({ tabs, activeId, onSelect, onClose, onAdd, label = "Tabs", closeLabel = "Close tab", addLabel = "New tab", className }: TabStripProps) {
  const listRef = useRef<HTMLDivElement>(null);
  // Tras cerrar con el teclado, el foco pasa a la pestaña que queda activa.
  const refocus = useRef(false);
  // La pestaña activa siempre queda a la vista: la tira se desplaza sola al cambiar de pestaña, al añadir o cerrar y al estrecharse.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tabs.length` no se lee dentro; es el disparador para volver a revelar la pestaña activa cuando se añade o se cierra otra.
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
  }, [activeId, tabs.length]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === activeId);
    // Supr cierra la pestaña activa (patrón de pestañas de WAI-ARIA): es la vía de teclado y de lector de pantalla,
    // porque un `tablist` solo admite pestañas y el botón de cierre queda como ayuda de puntero.
    if (e.key === "Delete" && onClose && tabs[i] && tabs[i].closable !== false) {
      e.preventDefault();
      refocus.current = true;
      onClose(tabs[i].id);
      return;
    }
    const next = tabs[tabKeyIndex(e.key, i, tabs.length, getComputedStyle(e.currentTarget).direction === "rtl")];
    if (!next) return;
    e.preventDefault();
    onSelect(next.id);
    e.currentTarget.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(next.id)}"]`)?.focus();
  };
  const closable = (tab: WorkTab) => Boolean(onClose) && tab.closable !== false;
  return (
    <div className={cx("z-tabstrip", className)}>
      <div ref={listRef} className="z-tabstrip__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <div key={tab.id} className="z-tabstrip__tab" role="presentation" data-selected={selected || undefined}>
              <button type="button" role="tab" className="z-tabstrip__select" aria-selected={selected} aria-controls={tab.controls} aria-keyshortcuts={closable(tab) ? "Delete" : undefined} tabIndex={selected ? 0 : -1} data-tab-id={tab.id} onClick={() => onSelect(tab.id)}>
                {tab.leading}
                <span className="z-tabstrip__title">{tab.title}</span>
              </button>
              {onClose && closable(tab) ? (
                <button type="button" className="z-tabstrip__close" title={closeLabel} aria-hidden="true" tabIndex={-1} onClick={() => onClose(tab.id)}>
                  <Icon name="x-mark" size={12} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {onAdd ? (
        <button type="button" className="z-tabstrip__add" aria-label={addLabel} onClick={onAdd}>
          <Icon name="plus" size={14} />
        </button>
      ) : null}
    </div>
  );
}
