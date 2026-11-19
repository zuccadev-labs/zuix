"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { logicalKey } from "../../core/dir";
import { move } from "../../core/roving";
import { createTypeahead, isPrintable } from "../../core/typeahead";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl, useFieldLabel } from "./Field";

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
  /** Opciones sueltas, grupos `{ label, options }` o una mezcla. */
  options: ReadonlyArray<ListboxOption | ListboxOptionGroup>;
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

/**
 * Lista de opciones siempre visible (patrón APG «listbox»): una sola parada de Tab, flechas, Inicio, Fin y búsqueda
 * por letra. En `single` la selección sigue al foco; en `multiple`, Espacio marca, Mayús+flecha extiende la selección
 * y Ctrl/⌘+A marca todas.
 */
export function Listbox(props: ListboxProps) {
  const {
    options,
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
  const flat = options.flatMap((entry) => (isGroup(entry) ? entry.options : [entry]));
  const usable = flat.filter((option) => !disabled && !option.disabled);
  const selected = (value: string) => (multiple ? many.includes(value) : single === value);
  const [active, setActive] = useState<string | null>(null);
  const stop = (usable.find((o) => o.value === active) ?? usable.find((o) => selected(o.value)) ?? usable[0])?.value;
  const list = useRef<HTMLDivElement | null>(null);
  const [search] = useState(() => createTypeahead());
  const optionId = (value: string) => `${listId}-${flat.findIndex((o) => o.value === value)}`;

  const focusOption = (value: string) => {
    setActive(value);
    list.current?.querySelector<HTMLElement>(`[id="${optionId(value)}"]`)?.focus();
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
        onKeyDown={onKeyDown}
      >
        {options.map((entry, index) =>
          isGroup(entry) ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: los grupos no tienen identidad propia.
            <div key={`group-${index}`} role="group" className="z-listbox__group" aria-labelledby={`${listId}-group-${index}`}>
              <div id={`${listId}-group-${index}`} className="z-listbox__label">
                {entry.label}
              </div>
              {entry.options.map(renderOption)}
            </div>
          ) : (
            renderOption(entry)
          ),
        )}
      </div>
      {flat.length === 0 ? <div className="z-listbox__empty">{emptyText}</div> : null}
      {name ? chosen.map((value) => <input key={value} type="hidden" name={name} value={value} />) : null}
    </div>
  );
}
