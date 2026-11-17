"use client";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent, type Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { fold } from "../../core/search";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useLayer, usePresence } from "../../primitives/hooks";
import { Popup, Portal, rectOf } from "../../primitives/popup";
import { useMergedRef } from "../../refs";
import { useFieldControl } from "./Field";

export interface ComboboxOption {
  value: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ReadonlyArray<ComboboxOption>;
  /** Valor elegido; `null` es sin selección. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null, option: ComboboxOption | null) => void;
  /** Texto escrito por la persona. Para cargar opciones de forma asíncrona. */
  onInputChange?: (text: string) => void;
  /**
   * Filtrado local. Por defecto compara la etiqueta sin mayúsculas ni acentos.
   * `false` lo desactiva (las opciones ya llegan filtradas del servidor).
   */
  filter?: boolean | ((option: ComboboxOption, text: string) => boolean);
  /** Muestra el anillo de carga y `loadingText` mientras no haya opciones. */
  loading?: boolean;
  loadingText?: string;
  /** Texto cuando ninguna opción coincide. */
  emptyText?: string;
  placeholder?: string;
  /** Botón para quitar la selección. */
  clearable?: boolean;
  clearLabel?: string;
  /** Nombre accesible del botón que abre la lista. */
  toggleLabel?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Nombre del campo al enviar un formulario (envía el valor, no la etiqueta). */
  name?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Clase de la envoltura. */
  className?: string;
  /** Clase del popup. */
  popupClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

const matches = (option: ComboboxOption, text: string) => fold(option.label).includes(fold(text.trim()));

/** Campo con lista filtrable (patrón ARIA combobox): el foco se queda en el campo y la opción activa va por aria-activedescendant. */
export function Combobox({
  options,
  value,
  defaultValue = null,
  onValueChange,
  onInputChange,
  filter = true,
  loading,
  loadingText = "Loading",
  emptyText = "No results",
  placeholder,
  clearable,
  clearLabel = "Clear selection",
  toggleLabel = "Show options",
  size = "md",
  invalid,
  disabled,
  required,
  name,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": describedBy,
  className,
  popupClassName,
  ref,
}: ComboboxProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const auto = useId();
  const listId = `${auto}-list`;
  const optionId = (index: number) => `${auto}-option-${index}`;

  const [inner, setInner] = useState<string | null>(defaultValue);
  const current = value === undefined ? inner : value;
  // Texto en edición; `null` significa que el campo muestra la etiqueta de la selección.
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Última opción elegida: conserva la etiqueta si las opciones cambian (carga asíncrona).
  const [chosen, setChosen] = useState<ComboboxOption | null>(null);
  const anchor = useRef<HTMLSpanElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const list = useRef<HTMLDivElement | null>(null);
  const popup = useRef<HTMLDivElement | null>(null);
  const present = usePresence(open, popup);

  const selected = current === null ? null : (options.find((option) => option.value === current) ?? (chosen?.value === current ? chosen : null));
  const shownText = text ?? selected?.label ?? "";
  const test = typeof filter === "function" ? filter : matches;
  const visible = text !== null && text.trim() !== "" && filter !== false ? options.filter((option) => test(option, text)) : options;
  const activeOption = open && active >= 0 && active < visible.length ? visible[active] : undefined;

  const setRef = useMergedRef(input, ref);

  // Mantiene visible la opción activa al moverse con el teclado.
  useEffect(() => {
    if (!open || active < 0) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const firstEnabled = (items: ReadonlyArray<ComboboxOption>) => items.findIndex((option) => !option.disabled);
  const lastEnabled = (items: ReadonlyArray<ComboboxOption>) => {
    for (let index = items.length - 1; index >= 0; index--) if (!items[index]?.disabled) return index;
    return -1;
  };
  /** Siguiente opción habilitada en la dirección dada, con vuelta al otro extremo. */
  const step = (from: number, direction: 1 | -1) => {
    const count = visible.length;
    for (let moved = 1; moved <= count; moved++) {
      const index = (from + direction * moved + count * (moved + 1)) % count;
      if (!visible[index]?.disabled) return index;
    }
    return from;
  };

  const commit = (option: ComboboxOption | null) => {
    setChosen(option);
    setInner(option?.value ?? null);
    if ((option?.value ?? null) !== current) onValueChange?.(option?.value ?? null, option);
  };
  const close = () => {
    setOpen(false);
    setActive(-1);
    setText(null);
  };
  const show = (start: "selected" | "first" | "last") => {
    if (disabled) return;
    setOpen(true);
    const at = start === "last" ? lastEnabled(visible) : start === "selected" ? visible.findIndex((option) => option.value === current && !option.disabled) : -1;
    setActive(at >= 0 ? at : firstEnabled(visible));
  };
  const choose = (option: ComboboxOption) => {
    if (option.disabled) return;
    commit(option);
    close();
  };
  const clear = () => {
    commit(null);
    setText(null);
    onInputChange?.("");
    input.current?.focus();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setText(next);
    onInputChange?.(next);
    // Vaciar el campo quita la selección.
    if (next === "" && current !== null) commit(null);
    setOpen(true);
    const filtered = next.trim() !== "" && filter !== false ? options.filter((option) => test(option, next)) : options;
    setActive(firstEnabled(filtered));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) show("selected");
        else if (visible.length) setActive(step(active, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) show("last");
        else if (visible.length) setActive(active < 0 ? lastEnabled(visible) : step(active, -1));
        break;
      case "Home":
        if (!open) return;
        event.preventDefault();
        setActive(firstEnabled(visible));
        break;
      case "End":
        if (!open) return;
        event.preventDefault();
        setActive(lastEnabled(visible));
        break;
      case "Enter":
        if (!open) return;
        // Con la lista abierta, Enter elige y no envía el formulario.
        event.preventDefault();
        if (activeOption) choose(activeOption);
        break;
      case "Escape":
        if (!open) return;
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      default:
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && (anchor.current?.contains(next) || list.current?.contains(next))) return;
    close();
  };

  const status = visible.length === 0 ? (loading ? loadingText : emptyText) : null;

  // El foco no sale del campo: Escape lo atiende el propio campo; una pulsación fuera de él y de la lista la cierra.
  useLayer(open, {
    contains: (target) => (anchor.current?.contains(target) ?? false) || (popup.current?.contains(target) ?? false),
    onPointerOutside: close,
  });

  return (
    <>
        <span ref={anchor} className={cx("z-input", "z-combobox", className)} data-size={size} data-state={open ? "open" : "closed"} data-invalid={isInvalid || undefined} data-disabled={disabled || undefined}>
          {selected?.icon && text === null ? (
            <span className="z-input__icon">
              <Icon name={selected.icon} size={ICON_SIZE[size]} />
            </span>
          ) : null}
          <input
            {...control}
            ref={setRef}
            type="text"
            role="combobox"
            className="z-input__control"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={activeOption ? optionId(active) : undefined}
            aria-busy={loading || undefined}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={placeholder}
            disabled={disabled}
            value={shownText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onClick={() => (open ? undefined : show("selected"))}
          />
          {name ? <input type="hidden" name={name} value={current ?? ""} /> : null}
          {loading ? (
            <span className="z-input__trailing">
              <span className="z-input__spinner" aria-hidden="true" />
            </span>
          ) : null}
          {clearable && (current !== null || shownText) && !disabled ? (
            <button type="button" className="z-input__action" aria-label={clearLabel} title={clearLabel} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={clear}>
              <Icon name="x-mark" size={ICON_SIZE[size]} />
            </button>
          ) : null}
          <button
            type="button"
            className="z-input__action z-combobox__toggle"
            aria-label={toggleLabel}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (open) close();
              else show("selected");
              input.current?.focus();
            }}
          >
            <Icon name="chevron-down" size={ICON_SIZE[size]} />
          </button>
        </span>
      {present ? (
      <Portal anchor={anchor}>
        <Popup
          ref={popup}
          open={open}
          anchorRect={() => rectOf(anchor.current)}
          watch={anchor}
          anchorWidth
          placement="bottom-start"
          gap={4}
          className={cx("z-liquid z-listbox", popupClassName)}
          data-size={size}
          role="presentation"
          // El foco no sale del campo: pulsar en la lista no se lo quita.
          onMouseDown={(event) => event.preventDefault()}
        >
          <div ref={list} id={listId} role="listbox" className="z-listbox__viewport" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} aria-busy={loading || undefined}>
            {visible.map((option, index) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: patrón combobox con aria-activedescendant: el foco no sale del campo, que atiende flechas e Intro.
              // biome-ignore lint/a11y/useFocusableInteractive: las opciones no reciben foco; el campo las señala con aria-activedescendant.
              <div
                key={option.value}
                id={optionId(index)}
                role="option"
                className="z-listbox__option"
                data-index={index}
                data-state={option.value === current ? "checked" : "unchecked"}
                data-highlighted={index === active ? "" : undefined}
                data-disabled={option.disabled ? "" : undefined}
                aria-selected={option.value === current}
                aria-disabled={option.disabled || undefined}
                onMouseMove={() => (option.disabled || index === active ? undefined : setActive(index))}
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
            ))}
          </div>
          {status ? (
            <div className="z-listbox__empty" role="status" data-loading={loading || undefined}>
              {status}
            </div>
          ) : null}
        </Popup>
      </Portal>
      ) : null}
    </>
  );
}
