"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { focusQuiet } from "../../core/focus";
import { step } from "../../core/roving";
import { createTypeahead, isPrintable } from "../../core/typeahead";
import { cx } from "../../cx";
import { useControllable, useLayer, usePresence } from "../../primitives/hooks";
import { Popup, Portal, rectOf } from "../../primitives/popup";
import { useMergedRef } from "../../refs";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";

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

export interface SelectProps {
  /** Opciones sueltas, grupos `{ label, options }` o una mezcla de ambos. */
  options: ReadonlyArray<SelectOption | SelectOptionGroup>;
  /** Valor elegido; cadena vacía muestra el placeholder. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
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
  ref?: Ref<HTMLButtonElement>;
}

const isGroup = (entry: SelectOption | SelectOptionGroup): entry is SelectOptionGroup => "options" in entry;

const optionsIn = (list: Element) => [...list.querySelectorAll<HTMLElement>(".z-listbox__option")].filter((option) => option.getAttribute("aria-disabled") !== "true");

/** Resalta una opción y le da el foco (foco itinerante dentro de la lista). */
function activate(list: Element, option: HTMLElement | undefined, scroll = true): void {
  for (const other of list.querySelectorAll("[data-highlighted]")) if (other !== option) other.removeAttribute("data-highlighted");
  if (!option) return;
  option.setAttribute("data-highlighted", "");
  if (scroll) option.scrollIntoView({ block: "nearest" });
  focusQuiet(option);
}

/**
 * Lista desplegable con popup propio (material liquid), iconos y grupos; patrón APG «select-only combobox» con el foco
 * dentro de la lista. Para la lista del sistema, `NativeSelect`.
 */
export function Select({
  options,
  value,
  defaultValue = "",
  onValueChange,
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
  ref,
}: SelectProps) {
  const { invalid: isInvalid, required: isRequired, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const listId = `${useId()}-list`;
  const [current, setCurrent] = useControllable(value, defaultValue, onValueChange);
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  const flat = options.flatMap((entry) => (isGroup(entry) ? entry.options : [entry]));
  const selected = flat.find((option) => option.value === current);
  const wrapper = useRef<HTMLSpanElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const setButton = useMergedRef(button, ref);
  const popup = useRef<HTMLDivElement | null>(null);
  const native = useRef<HTMLSelectElement | null>(null);
  // Opción que recibe el foco al abrir: la elegida, la primera o la última.
  const start = useRef<"selected" | "first" | "last">("selected");
  const [search] = useState(() => createTypeahead());
  const present = usePresence(open, popup);

  const show = (from: "selected" | "first" | "last") => {
    if (disabled) return;
    start.current = from;
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    const inside = popup.current?.contains(document.activeElement) ?? false;
    setOpen(false);
    if (refocus && inside) focusQuiet(button.current);
  };
  const choose = (option: SelectOption) => {
    if (option.disabled) return;
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
    const onReset = () => setTimeout(() => setCurrent(defaultValue), 0);
    const onInvalid = () => focusQuiet(button.current);
    form?.addEventListener("reset", onReset);
    field.addEventListener("invalid", onInvalid);
    return () => {
      form?.removeEventListener("reset", onReset);
      field.removeEventListener("invalid", onInvalid);
    };
  });

  // Al abrir, el foco entra en la lista: en la opción elegida, la primera o la última.
  const focusStart = (list: HTMLElement) => {
    const items = optionsIn(list);
    const chosen = items.find((option) => option.dataset.state === "checked");
    activate(list, start.current === "last" ? items[items.length - 1] : start.current === "selected" ? (chosen ?? items[0]) : items[0]);
  };

  const onControlKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (open || disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || (event.key === " " && !search.pending())) {
      event.preventDefault();
      show("selected");
    } else if (isPrintable(event)) {
      // Cerrado: la letra cambia el valor sin abrir la lista.
      event.preventDefault();
      const usable = flat.filter((option) => !option.disabled);
      const next = usable[search(usable.map((option) => option.label), event.key, usable.findIndex((option) => option.value === current))];
      if (next) setCurrent(next.value);
    }
  };
  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = popup.current;
    if (!list) return;
    const items = optionsIn(list);
    const active = items.find((option) => option === document.activeElement) ?? null;
    const next = step(items, active, event.key, false);
    if (next) {
      event.preventDefault();
      activate(list, next);
    } else if (event.key === "Enter" || (event.key === " " && !search.pending())) {
      event.preventDefault();
      active?.click();
    } else if (event.key === "Tab") {
      // El tabulador no sale de la lista abierta.
      event.preventDefault();
    } else if (isPrintable(event)) {
      event.preventDefault();
      const hit = items[search(items.map((option) => option.dataset.label ?? option.textContent ?? ""), event.key, active ? items.indexOf(active) : -1)];
      if (hit) activate(list, hit);
    }
  };

  const renderOption = (option: SelectOption) => {
    const checked = option.value === current;
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: el teclado lo atiende la lista (Intro y Espacio eligen la opción activa).
      <div
        key={option.value}
        role="option"
        className="z-listbox__option"
        tabIndex={-1}
        data-value={option.value}
        data-label={option.label}
        data-state={checked ? "checked" : "unchecked"}
        data-disabled={option.disabled ? "" : undefined}
        aria-selected={checked}
        aria-disabled={option.disabled || undefined}
        onPointerMove={(event) => {
          if (!option.disabled && document.activeElement !== event.currentTarget && popup.current) activate(popup.current, event.currentTarget, false);
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

  return (
    <>
      <span ref={wrapper} className={cx("z-select", className)} data-size={size} data-block={block || undefined} data-invalid={isInvalid || undefined} data-disabled={disabled || undefined} data-value={current}>
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
          data-placeholder={selected ? undefined : ""}
          disabled={disabled}
          onClick={() => (open ? close(true) : show("selected"))}
          onKeyDown={onControlKey}
        >
          {selected?.icon ? (
            <span className="z-select__icon">
              <Icon name={selected.icon} size={ICON_SIZE[size]} />
            </span>
          ) : null}
          <span className="z-select__value">{selected?.label ?? (current || placeholder)}</span>
        </button>
        <span className="z-select__chevron">
          <Icon name="chevron-down" size={ICON_SIZE[size]} />
        </span>
        {name || isRequired ? (
          // Campo nativo oculto: envía el valor y da la validación `required` del navegador.
          <select ref={native} className="z-native-input" aria-hidden="true" tabIndex={-1} name={name} required={isRequired} disabled={disabled} value={selected ? current : ""} onChange={(event) => setCurrent(event.target.value)}>
            <option value="" />
            {flat.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}
      </span>
      {present ? (
        <Portal anchor={wrapper}>
          <Popup ref={popup} open={open} anchorRect={() => rectOf(wrapper.current)} watch={wrapper} anchorWidth placement={align === "center" ? "bottom" : `bottom-${align}`} gap={4} className={cx("z-liquid z-listbox", popupClassName)} data-size={size} onKeyDown={onListKey} onShown={focusStart}>
            <div id={listId} role="listbox" className="z-listbox__viewport" aria-label={ariaLabel} aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? control.id)}>
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
          </Popup>
        </Portal>
      ) : null}
    </>
  );
}
