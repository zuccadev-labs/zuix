"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref, type UIEvent } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import type { AsyncLoader } from "../../core/async-options";
import { logicalKey } from "../../core/dir";
import { trackScrollEdges } from "../../core/edges";
import { move } from "../../core/roving";
import { createTypeahead, isPrintable } from "../../core/typeahead";
import { wantsVirtual } from "../../core/virtual";
import { cx } from "../../cx";
import { useAsyncOptions } from "../../primitives/async-options";
import { useControllable, useIsoLayoutEffect } from "../../primitives/hooks";
import { useVirtual } from "../../primitives/virtual";
import { estimateRow, optionRows, renderRows, rowOfOption } from "./option-rows.internal";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl, useFieldLabel } from "./Field";
import { withRef } from "../../react-compat";

export interface ListboxOption {
  value: string;
  label: string;
  description?: ReactNode;
  icon?: IconName;
  disabled?: boolean;
}

export interface ListboxOptionGroup {
  label: string;
  options: ReadonlyArray<ListboxOption>;
}

interface ListboxBase {
  /** Opciones sueltas, grupos `{ label, options }` o una mezcla. Con `loadOptions`, las primeras mientras carga. */
  options?: ReadonlyArray<ListboxOption | ListboxOptionGroup>;
  /**
   * Opciones del servidor: se piden al montar (consulta vacía) y página a página al llegar al final de la lista. La
   * función recibe `{ signal, page }`: pasa `signal` a `fetch` para que se cancele al desmontar.
   */
  loadOptions?: AsyncLoader<ListboxOption>;
  /** Texto mientras cargan las primeras opciones o la página siguiente. */
  loadingText?: string;
  /** Texto si la carga falla (con un botón para reintentar). */
  errorText?: string;
  retryLabel?: string;
  /**
   * Ventana virtual: solo se pintan las opciones que se ven (la activa no sale del documento). `true` siempre,
   * `false` nunca, un número es el umbral; por defecto, a partir de 100 opciones.
   */
  virtualize?: boolean | number;
  /** Nombre accesible si no lo da un Field. */
  label?: string;
  "aria-labelledby"?: string;
  orientation?: "vertical" | "horizontal";
  size?: ControlSize;
  disabled?: boolean;
  invalid?: boolean;
  /** Nombre del campo: cada opción elegida se envía con él. */
  name?: string;
  /** Texto si no hay opciones. */
  emptyText?: string;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export interface ListboxSingleProps extends ListboxBase {
  /** Una opción; la selección sigue al foco. */
  selectionMode?: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export interface ListboxMultipleProps extends ListboxBase {
  /** Varias: Espacio marca, Mayús+flecha extiende, Ctrl/⌘+A marca todas. */
  selectionMode: "multiple";
  value?: ReadonlyArray<string>;
  defaultValue?: ReadonlyArray<string>;
  onValueChange?: (value: string[]) => void;
}

export type ListboxProps = ListboxSingleProps | ListboxMultipleProps;

const isGroup = (entry: ListboxOption | ListboxOptionGroup): entry is ListboxOptionGroup => "options" in entry;
const EMPTY: ReadonlyArray<string> = [];
const EMPTY_OPTIONS: ReadonlyArray<ListboxOption> = [];

/**
 * Lista de opciones siempre visible (patrón APG «listbox»): una sola parada de Tab, flechas, Inicio, Fin y búsqueda
 * por letra. En `single` la selección sigue al foco; en `multiple`, Espacio marca, Mayús+flecha extiende la selección
 * y Ctrl/⌘+A marca todas.
 */
export const Listbox = withRef(function Listbox(props: ListboxProps) {
  const {
    options: given = EMPTY_OPTIONS,
    loadOptions,
    loadingText = "Loading",
    errorText = "Couldn't load the options",
    retryLabel = "Retry",
    virtualize,
    label,
    orientation = "vertical",
    size = "md",
    disabled,
    invalid,
    name,
    emptyText = "No options",
    id,
    className,
    ref,
  } = props;
  const remote = useAsyncOptions(loadOptions);
  // Con `loadOptions`, la primera página se pide al montar; las siguientes, al llegar al final.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al montar (o al pasar a cargar del servidor).
  useEffect(() => {
    if (loadOptions) remote.search("", true);
  }, [Boolean(loadOptions)]);
  const options = loadOptions && remote.state.status !== "idle" ? remote.state.options : given;
  const multiple = props.selectionMode === "multiple";
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid });
  const fieldLabel = useFieldLabel();
  const auto = useId();
  const listId = control.id ?? `${auto}-list`;
  const [single, setSingle] = useControllable<string>(
    multiple ? undefined : props.value,
    multiple ? "" : (props.defaultValue ?? ""),
    multiple ? undefined : props.onValueChange,
  );
  const [many, setMany] = useControllable<ReadonlyArray<string>>(
    multiple ? props.value : undefined,
    multiple ? (props.defaultValue ?? EMPTY) : EMPTY,
    multiple ? (props.onValueChange as (value: ReadonlyArray<string>) => void) : undefined,
  );
  const { rows, options: flat } = optionRows<ListboxOption, ListboxOptionGroup>(options, isGroup);
  const usable = flat.filter((option) => !disabled && !option.disabled);
  const selected = (value: string) => (multiple ? many.includes(value) : single === value);
  const [active, setActive] = useState<string | null>(null);
  const stop = (usable.find((o) => o.value === active) ?? usable.find((o) => selected(o.value)) ?? usable[0])?.value;
  const list = useRef<HTMLDivElement | null>(null);
  // En fila, la lista desplaza en horizontal: el borde con opciones ocultas se difumina.
  useEffect(() => (list.current && orientation === "horizontal" ? trackScrollEdges(list.current) : undefined), [orientation]);
  const [search] = useState(() => createTypeahead());
  const indexOf = new Map(flat.map((o, i) => [o.value, i]));
  const optionId = (value: string) => `${listId}-${indexOf.get(value) ?? -1}`;
  // Ventana virtual (vertical): la parada de Tab no sale del documento aunque se desplace lejos.
  const virtual = orientation === "vertical" && wantsVirtual(virtualize, flat.length, 100);
  const stopRow = stop === undefined ? -1 : rowOfOption(rows, indexOf.get(stop) ?? -1);
  const win = useVirtual({
    enabled: virtual,
    count: rows.length,
    size: estimateRow(rows, size),
    key: (i) => rows[i]?.key ?? String(i),
    keep: stopRow >= 0 ? [stopRow] : [],
    scroller: list,
    rowSelector: "[data-key]",
  });
  const pendingFocus = useRef<string | null>(null);
  useIsoLayoutEffect(() => {
    const value = pendingFocus.current;
    if (value === null) return;
    pendingFocus.current = null;
    list.current?.querySelector<HTMLElement>(`[id="${optionId(value)}"]`)?.focus();
  });

  const focusOption = (value: string) => {
    setActive(value);
    const el = list.current?.querySelector<HTMLElement>(`[id="${optionId(value)}"]`);
    if (el) el.focus();
    else {
      // Fuera de la ventana: se desplaza a ella y el foco llega tras pintarla.
      pendingFocus.current = value;
      win.scrollToIndex(rowOfOption(rows, indexOf.get(value) ?? 0));
    }
  };
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (loadOptions && remote.state.hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 48) remote.more();
  };
  const toggle = (value: string, on = !many.includes(value)) =>
    setMany(on ? (many.includes(value) ? many : [...many, value]) : many.filter((v) => v !== value));
  const choose = (value: string) => (multiple ? toggle(value) : setSingle(value));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const values = usable.map((o) => o.value);
    const current = active ?? stop ?? null;
    const vertical = orientation === "vertical";
    const key = vertical ? event.key : logicalKey(event.key, event.currentTarget);
    const next = move(values, current, key, vertical, false);
    // Al llegar al final con más páginas en el servidor, se pide la siguiente.
    if (loadOptions && next === values[values.length - 1] && remote.state.hasMore) remote.more();
    if (next !== undefined) {
      event.preventDefault();
      focusOption(next);
      if (!multiple) setSingle(next);
      else if (event.shiftKey) toggle(next, true);
      return;
    }
    if (multiple && (event.key === "a" || event.key === "A") && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setMany(values.every((v) => many.includes(v)) ? [] : values);
      return;
    }
    if ((event.key === " " && !search.pending()) || event.key === "Enter") {
      if (!current) return;
      event.preventDefault();
      choose(current);
      return;
    }
    if (isPrintable(event)) {
      const hit =
        usable[
          search(
            usable.map((o) => o.label),
            event.key,
            current ? values.indexOf(current) : -1,
          )
        ];
      if (!hit) return;
      event.preventDefault();
      focusOption(hit.value);
      if (!multiple) setSingle(hit.value);
    }
  };

  const renderOption = (option: ListboxOption) => {
    const on = selected(option.value);
    const off = Boolean(disabled || option.disabled);
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: el teclado lo atiende la lista (flechas, Espacio e Intro).
      <div
        key={option.value}
        id={optionId(option.value)}
        role="option"
        className="z-listbox__option"
        data-key={virtual ? `o:${option.value}` : undefined}
        aria-posinset={virtual ? (indexOf.get(option.value) ?? 0) + 1 : undefined}
        aria-setsize={virtual ? flat.length : undefined}
        tabIndex={option.value === stop ? 0 : -1}
        data-value={option.value}
        data-label={option.label}
        data-state={on ? "checked" : "unchecked"}
        data-disabled={off ? "" : undefined}
        aria-selected={on}
        aria-disabled={off || undefined}
        onFocus={() => setActive(option.value)}
        onClick={() => {
          if (off) return;
          setActive(option.value);
          choose(option.value);
        }}
      >
        {option.icon ? (
          <span className="z-listbox__icon">
            <Icon name={option.icon} size={ICON_SIZE[size]} />
          </span>
        ) : null}
        {option.description ? (
          <span className="z-listbox__content">
            <span className="z-listbox__text">{option.label}</span>
            <span className="z-listbox__description">{option.description}</span>
          </span>
        ) : (
          <span className="z-listbox__text">{option.label}</span>
        )}
        <span className="z-listbox__check">
          <Icon name="check" size={ICON_SIZE[size]} />
        </span>
      </div>
    );
  };

  const chosen = multiple ? many : single ? [single] : [];
  const status = remote.state.status;
  const loadingFirst = Boolean(loadOptions) && status === "loading" && flat.length === 0;
  const failed = Boolean(loadOptions) && status === "error";
  return (
    <div
      ref={ref}
      className={cx("z-listbox", className)}
      data-inline=""
      data-size={size}
      data-orientation={orientation}
      data-multiple={multiple || undefined}
      data-invalid={isInvalid || undefined}
      data-disabled={disabled || undefined}
      data-name={name}
    >
      <div
        ref={list}
        id={listId}
        role="listbox"
        className="z-listbox__viewport"
        aria-label={label}
        aria-labelledby={props["aria-labelledby"] ?? (label ? undefined : fieldLabel)}
        aria-describedby={control["aria-describedby"]}
        aria-invalid={control["aria-invalid"]}
        aria-multiselectable={multiple || undefined}
        aria-orientation={orientation}
        aria-disabled={disabled || undefined}
        aria-busy={(loadOptions && (status === "loading" || remote.state.loadingMore)) || undefined}
        data-virtual={virtual || undefined}
        onKeyDown={onKeyDown}
        onScroll={loadOptions ? onScroll : undefined}
      >
        {renderRows({
          rows,
          indices: win.indices,
          listId,
          renderOption: (option) => renderOption(option),
          virtual: win.virtual,
          before: win.before,
          after: win.after,
        })}
      </div>
      {failed ? (
        <div className="z-listbox__empty" role="status" data-error="">
          {errorText}{" "}
          <button type="button" className="z-btn z-btn--ghost z-listbox__retry" data-size="sm" onClick={() => remote.retry()}>
            {retryLabel}
          </button>
        </div>
      ) : loadingFirst || remote.state.loadingMore ? (
        <div className="z-listbox__empty" role="status" data-loading="">
          {loadingText}
        </div>
      ) : flat.length === 0 ? (
        <div className="z-listbox__empty">{emptyText}</div>
      ) : null}
      {name ? chosen.map((value) => <input key={value} type="hidden" name={name} value={value} />) : null}
    </div>
  );
});
