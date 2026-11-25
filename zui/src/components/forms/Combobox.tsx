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
import { withRef } from "../../react-compat";

export interface ComboboxOption {
  value: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
}

export interface ComboboxOptionGroup {
  /** Título del grupo. */
  label: string;
  options: ReadonlyArray<ComboboxOption>;
}

interface ComboboxBase {
  /** Opciones sueltas, grupos `{ label, options }` o una mezcla. */
  options: ReadonlyArray<ComboboxOption | ComboboxOptionGroup>;
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
  /** Icono decorativo al inicio del campo (se sustituye por el de la opción elegida, si lo tiene). */
  icon?: IconName;
  ref?: Ref<HTMLInputElement>;
}

export interface ComboboxProps extends ComboboxBase {
  multiple?: false;
  /** Valor elegido; `null` es sin selección. Con `allowCustomValue`, también un texto libre. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null, option: ComboboxOption | null) => void;
  /**
   * Autocompletar: el texto escrito vale aunque no coincida con ninguna opción. Se confirma con Intro (sin opción
   * activa) o al salir del campo; `onValueChange` recibe el texto y `option` null.
   */
  allowCustomValue?: boolean;
}

export interface ComboboxMultipleProps extends ComboboxBase {
  /** Varias opciones, como piezas dentro del campo: elegir no cierra la lista y Retroceso quita la última. */
  multiple: true;
  value?: ReadonlyArray<string>;
  defaultValue?: ReadonlyArray<string>;
  onValueChange?: (value: string[], options: ComboboxOption[]) => void;
  /** Máximo de opciones elegidas. */
  maxSelected?: number;
  /** Nombre del botón de quitar una pieza. */
  removeLabel?: (label: string) => string;
  allowCustomValue?: never;
}

const isGroup = (entry: ComboboxOption | ComboboxOptionGroup): entry is ComboboxOptionGroup => "options" in entry;
const NONE: ReadonlyArray<string> = [];

const matches = (option: ComboboxOption, text: string) => fold(option.label).includes(fold(text.trim()));

/**
 * Campo con lista filtrable (patrón ARIA combobox): el foco se queda en el campo y la opción activa va por
 * aria-activedescendant. Admite grupos, varias opciones como piezas (`multiple`) y texto libre (`allowCustomValue`).
 */
export const Combobox = withRef(function Combobox(props: ComboboxProps | ComboboxMultipleProps) {
  const multiple = props.multiple === true;
  const allowCustomValue = !multiple && props.allowCustomValue === true;
  const {
    options: entries,
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
    icon,
    ref,
  } = props;
  const options = entries.flatMap((entry) => (isGroup(entry) ? entry.options : [entry]));
  const groupOf = new Map<string, number>();
  entries.forEach((entry, index) => {
    if (isGroup(entry)) for (const option of entry.options) groupOf.set(option.value, index);
  });
  const value = multiple ? undefined : props.value;
  const defaultValue = multiple ? null : (props.defaultValue ?? null);
  const [innerMany, setInnerMany] = useState<ReadonlyArray<string>>(multiple ? (props.defaultValue ?? NONE) : NONE);
  const many = multiple ? (props.value ?? innerMany) : NONE;
  const maxSelected = multiple ? props.maxSelected : undefined;
  const fullMany = maxSelected !== undefined && many.length >= maxSelected;
  const removeLabel = multiple ? (props.removeLabel ?? ((label: string) => `Remove ${label}`)) : undefined;
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

  const selected =
    current === null ? null : (options.find((option) => option.value === current) ?? (chosen?.value === current ? chosen : null));
  // Con texto libre, un valor que no es opción se muestra tal cual.
  const shownText = multiple ? (text ?? "") : (text ?? selected?.label ?? (allowCustomValue && current !== null ? current : ""));
  const test = typeof filter === "function" ? filter : matches;
  const visible = text !== null && text.trim() !== "" && filter !== false ? options.filter((option) => test(option, text)) : options;
  const activeOption = open && active >= 0 && active < visible.length ? visible[active] : undefined;

  const setRef = useMergedRef(input, ref);

  // Mantiene visible la opción activa al moverse con el teclado.
  useEffect(() => {
    if (!open || active < 0) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const firstEnabled = (items: ReadonlyArray<ComboboxOption>) => items.findIndex((option) => !isOff(option));
  const lastEnabled = (items: ReadonlyArray<ComboboxOption>) => {
    for (let index = items.length - 1; index >= 0; index--) if (items[index] && !isOff(items[index]!)) return index;
    return -1;
  };
  /** Siguiente opción habilitada en la dirección dada, con vuelta al otro extremo. */
  const step = (from: number, direction: 1 | -1) => {
    const count = visible.length;
    for (let moved = 1; moved <= count; moved++) {
      const index = (from + direction * moved + count * (moved + 1)) % count;
      if (visible[index] && !isOff(visible[index]!)) return index;
    }
    return from;
  };

  const commit = (option: ComboboxOption | null, custom?: string) => {
    if (multiple) return;
    setChosen(option);
    const next = option?.value ?? custom ?? null;
    setInner(next);
    if (next !== current) (props.onValueChange as ComboboxProps["onValueChange"])?.(next, option);
  };
  const setMany = (next: ReadonlyArray<string>) => {
    if (!multiple) return;
    setInnerMany(next);
    props.onValueChange?.(
      [...next],
      next.map((v) => options.find((o) => o.value === v)).filter((o): o is ComboboxOption => Boolean(o)),
    );
  };
  const isOn = (option: ComboboxOption) => (multiple ? many.includes(option.value) : option.value === current);
  const isOff = (option: ComboboxOption) => Boolean(option.disabled || (multiple && fullMany && !many.includes(option.value)));
  const close = () => {
    setOpen(false);
    setActive(-1);
    setText(null);
  };
  const show = (start: "selected" | "first" | "last") => {
    if (disabled) return;
    setOpen(true);
    const at =
      start === "last"
        ? lastEnabled(visible)
        : start === "selected"
          ? visible.findIndex((option) => option.value === current && !option.disabled)
          : -1;
    setActive(at >= 0 ? at : firstEnabled(visible));
  };
  const choose = (option: ComboboxOption) => {
    if (isOff(option)) return;
    if (multiple) {
      // Varias: marca o desmarca, vacía lo escrito y deja la lista abierta.
      setMany(many.includes(option.value) ? many.filter((v) => v !== option.value) : [...many, option.value]);
      setText(null);
      onInputChange?.("");
      input.current?.focus();
      return;
    }
    commit(option);
    close();
  };
  /** Texto libre (allowCustomValue): lo escrito pasa a ser el valor. */
  const commitCustom = () => {
    if (!allowCustomValue || text === null) return;
    const typed = text.trim();
    const match = options.find((option) => fold(option.label) === fold(typed));
    if (match) commit(match);
    else commit(null, typed === "" ? undefined : typed);
  };
  const clear = () => {
    if (multiple) setMany([]);
    else commit(null);
    setText(null);
    onInputChange?.("");
    input.current?.focus();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setText(next);
    onInputChange?.(next);
    // Vaciar el campo quita la selección.
    if (!multiple && next === "" && current !== null) commit(null);
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
        if (event.nativeEvent.isComposing) return;
        if (!open) {
          if (allowCustomValue && text !== null) {
            event.preventDefault();
            commitCustom();
            setText(null);
          }
          return;
        }
        // Con la lista abierta, Enter elige y no envía el formulario.
        event.preventDefault();
        if (activeOption) choose(activeOption);
        else if (allowCustomValue) {
          commitCustom();
          close();
        }
        break;
      case "Backspace":
        // Varias: con el campo vacío, Retroceso quita la última pieza.
        if (multiple && (text ?? "") === "" && many.length) {
          event.preventDefault();
          setMany(many.slice(0, -1));
        }
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
    commitCustom();
    close();
  };

  const status = visible.length === 0 ? (loading ? loadingText : emptyText) : null;

  // El foco no sale del campo: Escape lo atiende el propio campo; una pulsación fuera de él y de la lista la cierra.
  useLayer(open, {
    contains: (target) => (anchor.current?.contains(target) ?? false) || (popup.current?.contains(target) ?? false),
    onPointerOutside: () => {
      commitCustom();
      close();
    },
  });

  const renderOption = (option: ComboboxOption) => {
    const index = visible.indexOf(option);
    const on = isOn(option);
    const off = isOff(option);
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: patrón combobox con aria-activedescendant: el foco no sale del campo, que atiende flechas e Intro.
      // biome-ignore lint/a11y/useFocusableInteractive: las opciones no reciben foco; el campo las señala con aria-activedescendant.
      <div
        key={option.value}
        id={optionId(index)}
        role="option"
        className="z-listbox__option"
        data-index={index}
        data-value={option.value}
        data-state={on ? "checked" : "unchecked"}
        data-highlighted={index === active ? "" : undefined}
        data-disabled={off ? "" : undefined}
        aria-selected={on}
        aria-disabled={off || undefined}
        onMouseMove={() => (off || index === active ? undefined : setActive(index))}
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
  // Grupos visibles en el orden de las opciones; los que el filtro deja vacíos no se pintan.
  const blocks: Array<{ label?: string; key: string; options: ComboboxOption[] }> = [];
  for (const option of visible) {
    const group = groupOf.get(option.value);
    const last = blocks[blocks.length - 1];
    if (last && last.key === `g${group ?? "-"}`) last.options.push(option);
    else
      blocks.push({
        key: `g${group ?? "-"}`,
        label: group === undefined ? undefined : (entries[group] as ComboboxOptionGroup).label,
        options: [option],
      });
  }
  const chips = multiple ? many.map((v) => options.find((o) => o.value === v) ?? { value: v, label: v }) : [];

  return (
    <>
      <span
        ref={anchor}
        className={cx("z-input", "z-combobox", className)}
        data-size={size}
        data-state={open ? "open" : "closed"}
        data-invalid={isInvalid || undefined}
        data-disabled={disabled || undefined}
        data-value={multiple ? many.join(",") : (current ?? undefined)}
        data-multiple={multiple || undefined}
        data-custom={allowCustomValue || undefined}
        data-max-selected={maxSelected}
        data-name={multiple ? name : undefined}
      >
        {!multiple && selected?.icon && text === null ? (
          <span className="z-input__icon">
            <Icon name={selected.icon} size={ICON_SIZE[size]} />
          </span>
        ) : icon ? (
          <span className="z-input__icon">
            <Icon name={icon} size={ICON_SIZE[size]} />
          </span>
        ) : null}
        {chips.map((option) => (
          <span key={option.value} className="z-tags__tag" data-value={option.value}>
            <span className="z-tags__text">{option.label}</span>
            {disabled ? null : (
              <button
                type="button"
                className="z-tags__remove"
                tabIndex={-1}
                aria-label={removeLabel?.(option.label)}
                title={removeLabel?.(option.label)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setMany(many.filter((v) => v !== option.value))}
              >
                <Icon name="x-mark" size={ICON_SIZE[size] - 2} />
              </button>
            )}
          </span>
        ))}
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
        {name && multiple ? many.map((v) => <input key={v} type="hidden" name={name} value={v} />) : null}
        {name && !multiple ? <input type="hidden" name={name} value={current ?? ""} /> : null}
        {loading ? (
          <span className="z-input__trailing">
            <span className="z-input__spinner" aria-hidden="true" />
          </span>
        ) : null}
        {clearable && (current !== null || shownText || many.length > 0) && !disabled ? (
          <button
            type="button"
            className="z-input__action"
            aria-label={clearLabel}
            title={clearLabel}
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
          >
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
            <div
              ref={list}
              id={listId}
              role="listbox"
              className="z-listbox__viewport"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-busy={loading || undefined}
              aria-multiselectable={multiple || undefined}
            >
              {blocks.map((block) =>
                block.label === undefined ? (
                  block.options.map(renderOption)
                ) : (
                  <div key={block.key} role="group" className="z-listbox__group" aria-labelledby={`${listId}-${block.key}`}>
                    <div id={`${listId}-${block.key}`} className="z-listbox__label">
                      {block.label}
                    </div>
                    {block.options.map(renderOption)}
                  </div>
                ),
              )}
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
});
