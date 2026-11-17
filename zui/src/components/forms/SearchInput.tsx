"use client";
import { useRef, useState, type ChangeEvent, type InputHTMLAttributes, type KeyboardEvent, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useMergedRef } from "../../refs";
import { useFieldControl } from "./Field";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type" | "value" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  /** Cambio de texto ya extraído del evento. */
  onValueChange?: (value: string) => void;
  /** Envío con Enter. */
  onSearch?: (value: string) => void;
  onClear?: () => void;
  size?: ControlSize;
  /** Nombre accesible del botón de borrado. */
  clearLabel?: string;
  /** Muestra un anillo de carga en lugar del botón de borrado. */
  loading?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de búsqueda con icono, botón de borrado y Escape para limpiar. */
export function SearchInput({ value, defaultValue = "", onValueChange, onSearch, onClear, onChange, onKeyDown, size = "md", clearLabel = "Clear search", loading, placeholder = "Search", className, id, ref, "aria-describedby": describedBy, ...rest }: SearchInputProps) {
  const { invalid: _invalid, ...control } = useFieldControl({ id, "aria-describedby": describedBy });
  const [inner, setInner] = useState(defaultValue);
  const node = useRef<HTMLInputElement | null>(null);
  const current = value ?? inner;

  const setRef = useMergedRef(node, ref);
  const update = (next: string) => {
    setInner(next);
    onValueChange?.(next);
  };
  const clear = () => {
    update("");
    onClear?.();
    node.current?.focus();
  };
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    update(event.target.value);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter") onSearch?.(current);
    else if (event.key === "Escape" && current) {
      event.preventDefault();
      clear();
    }
  };

  return (
    <span className={cx("z-input", "z-input--search", className)} data-size={size} data-disabled={rest.disabled || undefined}>
      <span className="z-input__icon">
        <Icon name="magnifying-glass" size={ICON_SIZE[size]} />
      </span>
      <input
        // Con id (propio o de un Field) el nombre lo da la etiqueta enlazada.
        aria-label={control.id ? undefined : placeholder}
        {...rest}
        {...control}
        ref={setRef}
        type="search"
        placeholder={placeholder}
        value={current}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="z-input__control"
      />
      {loading ? (
        <span className="z-input__trailing">
          <span className="z-input__spinner" aria-hidden="true" />
        </span>
      ) : current && !rest.disabled && !rest.readOnly ? (
        <button type="button" className="z-input__action" aria-label={clearLabel} title={clearLabel} onClick={clear}>
          <Icon name="x-mark" size={ICON_SIZE[size]} />
        </button>
      ) : null}
    </span>
  );
}
