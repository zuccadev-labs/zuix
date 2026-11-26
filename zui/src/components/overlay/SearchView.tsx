"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { attachSearchView, type SearchViewApi } from "../../core/search-view";
import { cx } from "../../cx";

export interface SearchViewLabels {
  back: string;
  clear: string;
}

export interface SearchViewProps {
  /** Lo escrito (controlado). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Intro en el campo. */
  onSubmit?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Nombre del campo y de la vista. */
  label?: string;
  placeholder?: string;
  /** `auto`: pantalla completa en estrecho y acoplada bajo la barra en ancho. */
  mode?: "auto" | "fullscreen" | "docked";
  /** Al final de la barra (un avatar, un botón de voz). */
  trailing?: ReactNode;
  labels?: Partial<SearchViewLabels>;
  className?: string;
  id?: string;
  /** Resultados y sugerencias de la vista. */
  children?: ReactNode;
}

/**
 * Búsqueda de Material 3: una barra que al pulsarla crece hasta una vista de búsqueda (pantalla completa en móvil,
 * acoplada en ancho). Es un `<dialog>` modal: Escape o volver cierran y el foco vuelve a la barra.
 */
export function SearchView({
  value,
  defaultValue = "",
  onValueChange,
  onSubmit,
  open,
  defaultOpen,
  onOpenChange,
  label = "Search",
  placeholder = "Search",
  mode = "auto",
  trailing,
  labels: labelsProp,
  className,
  id,
  children,
}: SearchViewProps) {
  const labels = { back: "Back", clear: "Clear search", ...labelsProp };
  const auto = useId().replace(/:/g, "");
  const viewId = `${id ?? `z-sv-${auto}`}-view`;
  const root = useRef<HTMLDivElement | null>(null);
  const api = useRef<SearchViewApi | null>(null);
  const live = useRef({ onValueChange, onSubmit, onOpenChange });
  live.current = { onValueChange, onSubmit, onOpenChange };
  const text = useRef(value ?? defaultValue);
  // biome-ignore lint/correctness/useExhaustiveDependencies: se conecta una vez al montar; `defaultOpen` solo cuenta entonces.
  useEffect(() => {
    if (!root.current) return;
    const view = attachSearchView(root.current, {
      openChange: (next) => live.current.onOpenChange?.(next),
      valueChange: (next) => {
        text.current = next;
        live.current.onValueChange?.(next);
      },
      submit: (next) => live.current.onSubmit?.(next),
    });
    api.current = view;
    if (defaultOpen) view.open();
    return () => {
      view.detach();
      api.current = null;
    };
  }, []);
  // Controlado: abrir y cerrar desde la aplicación.
  useEffect(() => {
    if (open === undefined) return;
    if (open) api.current?.open();
    else api.current?.close();
  }, [open]);
  // Valor controlado que cambia desde fuera: se escribe en el campo (no controlado, para no pisar lo que se teclea).
  useEffect(() => {
    if (value === undefined || !root.current) return;
    const field = root.current.querySelector<HTMLInputElement>(".z-searchview__input");
    if (field && field.value !== value) field.value = value;
    text.current = value;
  }, [value]);
  const shown = value ?? text.current;
  return (
    <div ref={root} id={id} className={cx("z-searchview", className)} data-mode={mode} data-filled={shown ? "" : undefined}>
      <button type="button" className="z-searchview__bar" aria-haspopup="dialog" aria-expanded="false" aria-controls={viewId}>
        <Icon name="magnifying-glass" size={18} />
        <span className="z-searchview__text">{shown || placeholder}</span>
        {trailing ? <span className="z-searchview__trailing">{trailing}</span> : null}
      </button>
      <dialog className="z-searchview__view" id={viewId} aria-label={label} data-state="closed">
        <div className="z-searchview__header">
          <button type="button" className="z-btn z-btn--ghost z-btn--icon z-searchview__back" data-size="md" aria-label={labels.back} title={labels.back}>
            <Icon name="arrow-left" size={18} />
          </button>
          <input
            className="z-searchview__input"
            type="search"
            aria-label={label}
            placeholder={placeholder}
            defaultValue={value ?? defaultValue}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="button" className="z-btn z-btn--ghost z-btn--icon z-searchview__clear" data-size="md" aria-label={labels.clear} title={labels.clear}>
            <Icon name="x-mark" size={18} />
          </button>
        </div>
        <div className="z-searchview__results">{children}</div>
      </dialog>
    </div>
  );
}
