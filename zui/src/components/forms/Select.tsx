"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref, type UIEvent } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import type { AsyncLoader } from "../../core/async-options";
import { focusQuiet } from "../../core/focus";
import { step } from "../../core/roving";
import { fold } from "../../core/search";
import { createTypeahead, isPrintable } from "../../core/typeahead";
import { wantsVirtual } from "../../core/virtual";
import { cx } from "../../cx";
import { useAsyncOptions } from "../../primitives/async-options";
import { useControllable, useIsoLayoutEffect, useLayer, usePresence } from "../../primitives/hooks";
import { useVirtual } from "../../primitives/virtual";
import { estimateRow, optionRows, renderRows, type OptionRow } from "./option-rows.internal";
import { Popup, Portal, rectOf } from "../../primitives/popup";
import { useMergedRef } from "../../refs";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";
import { withRef } from "../../react-compat";

export interface SelectOption {
  value: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  /** Título del grupo. */
  label: string;
  options: ReadonlyArray<SelectOption>;
}

interface SelectBase {
  /** Opciones sueltas, grupos `{ label, options }` o una mezcla de ambos. Con `loadOptions`, no hace falta. */
  options?: ReadonlyArray<SelectOption | SelectOptionGroup>;
  /**
   * Campo de búsqueda dentro de la lista: filtra por etiqueta (sin acentos ni mayúsculas) y deja los grupos con su
   * título. El foco va al campo y la opción activa se señala con aria-activedescendant.
   */
  searchable?: boolean;
  /** Texto de ejemplo y nombre accesible del campo de búsqueda. */
  searchPlaceholder?: string;
  /**
   * Opciones del servidor por consulta (activa la búsqueda): antirrebote de `debounce` ms, la petición anterior se
   * cancela (`signal`) y `page` sube al llegar al final si la respuesta trae `hasMore`.
   */
  loadOptions?: AsyncLoader<SelectOption>;
  debounce?: number;
  loadingText?: string;
  errorText?: string;
  retryLabel?: string;
  /**
   * Ventana virtual: solo se pintan las opciones que se ven (la activa no sale del documento). `true` siempre,
   * `false` nunca, un número es el umbral; por defecto, a partir de 100 opciones.
   */
  virtualize?: boolean | number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Nombre del campo al enviar un formulario. */
  name?: string;
  /** Ancho completo (por defecto) o intrínseco. */
  block?: boolean;
  /** Alineación del popup respecto al control. */
  align?: "start" | "center" | "end";
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Clase de la envoltura. */
  className?: string;
  /** Clase del popup. */
  popupClassName?: string;
  /** Texto de la lista cuando no hay opciones. */
  emptyText?: string;
  ref?: Ref<HTMLButtonElement>;
}

export interface SelectProps extends SelectBase {
  multiple?: false;
  /** Valor elegido; cadena vacía muestra el placeholder. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export interface SelectMultipleProps extends SelectBase {
  /** Varias opciones: elegir marca o desmarca sin cerrar la lista. */
  multiple: true;
  value?: ReadonlyArray<string>;
  defaultValue?: ReadonlyArray<string>;
  onValueChange?: (value: string[]) => void;
  /** Máximo de opciones elegidas; al llegar, las demás se deshabilitan. */
  maxSelected?: number;
  /** Texto del control con varias elegidas; por defecto, las etiquetas separadas por comas. */
  formatValue?: (labels: string[]) => string;
}

const EMPTY: ReadonlyArray<string> = [];
const NO_OPTIONS: ReadonlyArray<SelectOption> = [];

const isGroup = (entry: SelectOption | SelectOptionGroup): entry is SelectOptionGroup => "options" in entry;

/** Filas visibles con la búsqueda: un grupo sin coincidencias desaparece con su título. */
function filterRows(rows: OptionRow<SelectOption>[], query: string): OptionRow<SelectOption>[] {
  const q = fold(query.trim());
  if (!q) return rows;
  const out: OptionRow<SelectOption>[] = [];
  let pending: OptionRow<SelectOption> | null = null;
  for (const row of rows) {
    if (row.kind === "label") {
      pending = row;
      continue;
    }
    if (!fold(row.option.label).includes(q)) continue;
    if (pending && row.group === pending.group) {
      out.push(pending);
      pending = null;
    }
    out.push(row);
  }
  return out;
}

/**
 * Lista desplegable con popup propio (material liquid), iconos y grupos; patrón APG «select-only combobox» con el foco
 * dentro de la lista. Con `searchable` (o `loadOptions`), un campo de búsqueda arriba que conserva el foco y señala
 * la opción activa con aria-activedescendant. Para la lista del sistema, `NativeSelect`.
 */
export const Select = withRef(function Select(props: SelectProps | SelectMultipleProps) {
  const multiple = props.multiple === true;
  const {
    options: given = NO_OPTIONS,
    searchable: searchableProp,
    searchPlaceholder = "Search",
    loadOptions,
    debounce,
    loadingText = "Loading",
    errorText = "Couldn't load the options",
    retryLabel = "Retry",
    virtualize,
    open: openProp,
    defaultOpen,
    onOpenChange,
    placeholder,
    size = "md",
    invalid,
    disabled,
    required,
    name,
    block = true,
    align = "start",
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": describedBy,
    className,
    popupClassName,
    emptyText = "No options",
    ref,
  } = props;
  const searchable = Boolean(searchableProp || loadOptions);
  const {
    invalid: isInvalid,
    required: isRequired,
    ...control
  } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const auto = useId();
  const listId = `${auto}-list`;
  const [current, setCurrent] = useControllable<string>(
    multiple ? undefined : props.value,
    multiple ? "" : (props.defaultValue ?? ""),
    multiple ? undefined : props.onValueChange,
  );
  const [many, setMany] = useControllable<ReadonlyArray<string>>(
    multiple ? props.value : undefined,
    multiple ? (props.defaultValue ?? EMPTY) : EMPTY,
    multiple ? (props.onValueChange as (value: ReadonlyArray<string>) => void) : undefined,
  );
  const maxSelected = multiple ? props.maxSelected : undefined;
  const isChecked = (value: string) => (multiple ? many.includes(value) : value === current);
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  const remote = useAsyncOptions(loadOptions, debounce);
  // Lo elegido de una carga del servidor conserva su etiqueta aunque la consulta cambie las opciones.
  const known = useRef(new Map<string, SelectOption>());
  const options = loadOptions ? remote.state.options : given;
  const { rows, options: flat } = optionRows<SelectOption, SelectOptionGroup>(options, isGroup);
  for (const option of flat) if (isChecked(option.value)) known.current.set(option.value, option);
  const lookup = (value: string) => flat.find((option) => option.value === value) ?? known.current.get(value);
  const selected = multiple ? undefined : lookup(current);
  const chosenLabels = multiple ? many.map((v) => lookup(v)?.label).filter((l): l is string => Boolean(l)) : [];
  const full = maxSelected !== undefined && many.length >= maxSelected;
  const wrapper = useRef<HTMLSpanElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const setButton = useMergedRef(button, ref);
  const popup = useRef<HTMLDivElement | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const searchField = useRef<HTMLInputElement | null>(null);
  const native = useRef<HTMLSelectElement | null>(null);
  const [search] = useState(() => createTypeahead());
  const present = usePresence(open, popup);
  const [query, setQuery] = useState("");
  // Opción activa (resaltada): con foco real sin búsqueda; con aria-activedescendant con búsqueda.
  const [active, setActiveState] = useState<string | null>(null);
  const pendingFocus = useRef(false);

  const shownRows = loadOptions ? rows : filterRows(rows, query);
  const shownOptions = shownRows.flatMap((row) => (row.kind === "option" ? [row.option] : []));
  const isOff = (option: SelectOption) => Boolean(option.disabled || (multiple && full && !isChecked(option.value)));
  const usable = shownOptions.filter((option) => !isOff(option));
  const optionId = (value: string) => `${auto}-option-${flat.findIndex((o) => o.value === value)}`;
  const rowOfValue = (value: string | null) =>
    value === null ? -1 : shownRows.findIndex((r) => r.kind === "option" && r.option.value === value);
  const activeRow = open ? rowOfValue(active) : -1;
  const virtual = wantsVirtual(virtualize, shownOptions.length, 100);
  const win = useVirtual({
    enabled: virtual && present,
    count: shownRows.length,
    size: estimateRow(shownRows, size),
    key: (i) => shownRows[i]?.key ?? String(i),
    keep: activeRow >= 0 ? [activeRow] : [],
    scroller: viewport,
    rowSelector: "[data-key]",
  });

  /** Resalta una opción; sin búsqueda, además le da el foco (si aún no está pintada, tras pintarla). */
  const activate = (value: string | null, scroll = true) => {
    setActiveState(value);
    if (value === null) return;
    const el = viewport.current?.querySelector<HTMLElement>(`[id="${optionId(value)}"]`);
    if (el) {
      if (scroll) el.scrollIntoView({ block: "nearest" });
      if (!searchable) focusQuiet(el);
    } else {
      win.scrollToIndex(rowOfValue(value));
      pendingFocus.current = true;
    }
  };
  useIsoLayoutEffect(() => {
    if (!pendingFocus.current || active === null) return;
    const el = viewport.current?.querySelector<HTMLElement>(`[id="${optionId(active)}"]`);
    if (!el) return;
    pendingFocus.current = false;
    el.scrollIntoView({ block: "nearest" });
    if (!searchable) focusQuiet(el);
  });

  const show = (from: "selected" | "first" | "last") => {
    if (disabled) return;
    start.current = from;
    setOpen(true);
  };
  // Opción que recibe el foco al abrir: la elegida, la primera o la última.
  const start = useRef<"selected" | "first" | "last">("selected");
  const close = (refocus: boolean) => {
    const inside = popup.current?.contains(document.activeElement) ?? false;
    setOpen(false);
    setQuery("");
    setActiveState(null);
    remote.abort();
    if (refocus && inside) focusQuiet(button.current);
  };
  const choose = (option: SelectOption) => {
    if (option.disabled) return;
    if (multiple) {
      // Varias: marca o desmarca sin cerrar; con el tope alcanzado solo se puede desmarcar.
      if (many.includes(option.value)) setMany(many.filter((v) => v !== option.value));
      else if (!full) setMany([...many, option.value]);
      return;
    }
    close(true);
    setCurrent(option.value);
  };

  useLayer(open, {
    contains: (target) => (popup.current?.contains(target) ?? false) || (wrapper.current?.contains(target) ?? false),
    onEscape: () => close(true),
    onPointerOutside: () => close(false),
    onFocusOutside: () => close(false),
  });

  // Formulario: `form.reset()` devuelve el valor inicial, y un campo obligatorio vacío lleva el foco al control.
  useEffect(() => {
    const field = native.current;
    const form = field?.form;
    if (!field) return;
    const onReset = () =>
      setTimeout(() => (multiple ? setMany(props.defaultValue ?? EMPTY) : setCurrent((props.defaultValue as string | undefined) ?? "")), 0);
    const onInvalid = () => focusQuiet(button.current);
    form?.addEventListener("reset", onReset);
    field.addEventListener("invalid", onInvalid);
    return () => {
      form?.removeEventListener("reset", onReset);
      field.removeEventListener("invalid", onInvalid);
    };
  });

  // Al abrir, el foco entra en la lista (o en el campo de búsqueda): en la opción elegida, la primera o la última.
  const focusStart = () => {
    if (searchable) {
      focusQuiet(searchField.current);
      if (loadOptions && remote.state.status === "idle") remote.search("", true);
    }
    const chosen = usable.find((option) => isChecked(option.value));
    const target = start.current === "last" ? usable[usable.length - 1] : start.current === "selected" ? (chosen ?? usable[0]) : usable[0];
    activate(target?.value ?? null);
  };

  const onControlKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (open || disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || (event.key === " " && !search.pending())) {
      event.preventDefault();
      show("selected");
    } else if (isPrintable(event)) {
      // Cerrado: la letra cambia el valor sin abrir la lista (en múltiple o con búsqueda, la abre).
      event.preventDefault();
      if (multiple || searchable) {
        show("selected");
        return;
      }
      const all = flat.filter((option) => !option.disabled);
      const next =
        all[
          search(
            all.map((option) => option.label),
            event.key,
            all.findIndex((option) => option.value === current),
          )
        ];
      if (next) setCurrent(next.value);
    }
  };
  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const inSearch = event.target === searchField.current;
    const at = usable.find((option) => option.value === active) ?? null;
    // En el campo de búsqueda, Inicio y Fin mueven el cursor del texto.
    const key = inSearch && (event.key === "Home" || event.key === "End") ? "" : event.key;
    const next = step(usable, at, key, false);
    if (next) {
      event.preventDefault();
      activate(next.value);
      if (loadOptions && next === usable[usable.length - 1] && remote.state.hasMore) remote.more();
    } else if (event.key === "Enter" || (event.key === " " && !inSearch && !search.pending())) {
      event.preventDefault();
      if (loadOptions && remote.state.status === "error" && !at) remote.retry();
      else if (at) choose(at);
    } else if (event.key === "Tab") {
      // El tabulador no sale de la lista abierta.
      event.preventDefault();
    } else if (!inSearch && isPrintable(event)) {
      event.preventDefault();
      if (searchable) {
        // Una letra con el foco en una opción va al campo de búsqueda.
        searchField.current?.focus();
        return;
      }
      const hit =
        usable[
          search(
            usable.map((option) => option.label),
            event.key,
            at ? usable.indexOf(at) : -1,
          )
        ];
      if (hit) activate(hit.value);
    }
  };
  const onQuery = (text: string) => {
    setQuery(text);
    if (loadOptions) {
      remote.search(text);
      return;
    }
    const first = filterRows(rows, text).find((row) => row.kind === "option" && !isOff(row.option));
    setActiveState(first?.kind === "option" ? first.option.value : null);
  };
  const onViewportScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (loadOptions && remote.state.hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 48) remote.more();
  };
  // Del servidor: la primera opción de unos resultados nuevos pasa a ser la activa.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al llegar resultados nuevos.
  useEffect(() => {
    if (!loadOptions || !open || remote.state.status !== "ready") return;
    if (active === null || !usable.some((o) => o.value === active)) setActiveState(usable[0]?.value ?? null);
  }, [remote.state.options]);

  const renderOption = (option: SelectOption) => {
    const checked = isChecked(option.value);
    const off = isOff(option);
    const index = shownOptions.indexOf(option);
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: el teclado lo atiende la lista (Intro y Espacio eligen la opción activa).
      <div
        key={option.value}
        id={optionId(option.value)}
        role="option"
        className="z-listbox__option"
        tabIndex={-1}
        data-value={option.value}
        data-label={option.label}
        data-state={checked ? "checked" : "unchecked"}
        data-disabled={off ? "" : undefined}
        data-highlighted={option.value === active ? "" : undefined}
        data-key={win.virtual ? `o:${option.value}` : undefined}
        aria-posinset={win.virtual ? index + 1 : undefined}
        aria-setsize={win.virtual ? shownOptions.length : undefined}
        aria-selected={checked}
        aria-disabled={off || undefined}
        onPointerMove={() => {
          if (!off && active !== option.value) activate(option.value, false);
        }}
        onClick={() => choose(option)}
      >
        {option.icon ? (
          <span className="z-listbox__icon">
            <Icon name={option.icon} size={ICON_SIZE[size]} />
          </span>
        ) : null}
        <span className="z-listbox__text">{option.label}</span>
        <span className="z-listbox__check">
          <Icon name="check" size={ICON_SIZE[size]} />
        </span>
      </div>
    );
  };

  const failed = Boolean(loadOptions) && remote.state.status === "error";
  const loadingNow = Boolean(loadOptions) && (remote.state.status === "loading" || remote.state.loadingMore);
  const status = failed
    ? errorText
    : shownOptions.length === 0
      ? loadingNow
        ? loadingText
        : loadOptions && remote.state.status === "idle"
          ? null
          : emptyText
      : remote.state.loadingMore
        ? loadingText
        : null;

  return (
    <>
      <span
        ref={wrapper}
        className={cx("z-select", className)}
        data-size={size}
        data-block={block || undefined}
        data-invalid={isInvalid || undefined}
        data-disabled={disabled || undefined}
        data-value={multiple ? many.join(",") : current}
        data-placeholder={placeholder}
        data-multiple={multiple || undefined}
        data-max-selected={maxSelected}
        data-searchable={searchable || undefined}
      >
        <button
          {...control}
          ref={setButton}
          type="button"
          role="combobox"
          className="z-select__control"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-required={isRequired}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          data-state={open ? "open" : "closed"}
          data-placeholder={selected || chosenLabels.length ? undefined : ""}
          disabled={disabled}
          onClick={() => (open ? close(true) : show("selected"))}
          onKeyDown={onControlKey}
        >
          {selected?.icon ? (
            <span className="z-select__icon">
              <Icon name={selected.icon} size={ICON_SIZE[size]} />
            </span>
          ) : null}
          <span className="z-select__value">
            {multiple
              ? chosenLabels.length
                ? (props.formatValue ?? ((labels: string[]) => labels.join(", ")))(chosenLabels)
                : placeholder
              : (selected?.label ?? (current || placeholder))}
          </span>
          {multiple && chosenLabels.length > 1 ? (
            <span className="z-select__count" aria-hidden="true">
              {chosenLabels.length}
            </span>
          ) : null}
        </button>
        <span className="z-select__chevron">
          <Icon name="chevron-up-down" size={ICON_SIZE[size]} />
        </span>
        {name || isRequired ? (
          // Campo nativo oculto: envía el valor y da la validación `required` del navegador.
          <select
            ref={native}
            className="z-native-input"
            aria-hidden="true"
            tabIndex={-1}
            name={name}
            required={isRequired}
            disabled={disabled}
            multiple={multiple || undefined}
            value={multiple ? [...many] : selected ? current : ""}
            onChange={(event) =>
              multiple ? setMany([...event.target.selectedOptions].map((o) => o.value)) : setCurrent(event.target.value)
            }
          >
            {multiple ? null : <option value="" />}
            {(loadOptions ? [...known.current.values()] : flat).map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
      </span>
      {present ? (
        <Portal anchor={wrapper}>
          <Popup
            ref={popup}
            open={open}
            anchorRect={() => rectOf(wrapper.current)}
            watch={wrapper}
            anchorWidth
            placement={align === "center" ? "bottom" : `bottom-${align}`}
            gap={4}
            className={cx("z-liquid z-listbox", popupClassName)}
            data-size={size}
            data-searchable={searchable || undefined}
            onKeyDown={onListKey}
            onShown={focusStart}
          >
            {searchable ? (
              <div className="z-listbox__search">
                <span className="z-input z-input--search" data-size="sm">
                  <span className="z-input__icon">
                    <Icon name="magnifying-glass" size={14} />
                  </span>
                  <input
                    ref={searchField}
                    className="z-input__control"
                    type="search"
                    role="combobox"
                    aria-label={searchPlaceholder}
                    aria-autocomplete="list"
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-activedescendant={active !== null && rowOfValue(active) >= 0 ? optionId(active) : undefined}
                    aria-busy={loadingNow || undefined}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={searchPlaceholder}
                    value={query}
                    onChange={(event) => onQuery(event.target.value)}
                  />
                  {loadingNow ? (
                    <span className="z-input__trailing">
                      <span className="z-input__spinner" aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}
            <div
              ref={viewport}
              id={listId}
              role="listbox"
              className="z-listbox__viewport"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? control.id)}
              aria-multiselectable={multiple || undefined}
              aria-busy={loadingNow || undefined}
              data-virtual={win.virtual || undefined}
              onScroll={loadOptions ? onViewportScroll : undefined}
            >
              {renderRows({
                rows: shownRows,
                indices: win.indices,
                listId,
                renderOption: (option) => renderOption(option),
                virtual: win.virtual,
                before: win.before,
                after: win.after,
              })}
            </div>
            {status ? (
              <div
                className="z-listbox__empty"
                role={searchable || loadOptions ? "status" : undefined}
                data-loading={loadingNow && !failed ? "" : undefined}
                data-error={failed ? "" : undefined}
              >
                {status}
                {failed ? (
                  <>
                    {" "}
                    <button type="button" className="z-btn z-btn--ghost z-listbox__retry" data-size="sm" onClick={() => remote.retry()}>
                      {retryLabel}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </Popup>
        </Portal>
      ) : null}
    </>
  );
});
