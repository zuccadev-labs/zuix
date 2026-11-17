"use client";
import type { ReactNode, Ref, SelectHTMLAttributes } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";

export interface NativeSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NativeSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: ControlSize;
  invalid?: boolean;
  /** Opciones como datos; como alternativa se pasan `<option>` hijos. */
  options?: ReadonlyArray<NativeSelectOption>;
  /** Primera opción vacía, no seleccionable. */
  placeholder?: string;
  /** Ancho completo (por defecto) o intrínseco. */
  block?: boolean;
  ref?: Ref<HTMLSelectElement>;
  children?: ReactNode;
}

/** `<select>` nativo con el aspecto del resto de controles: lista del sistema, ideal en móvil y formularios simples. */
export function NativeSelect({
  size = "md",
  invalid,
  options,
  placeholder,
  block = true,
  className,
  children,
  id,
  required,
  "aria-describedby": describedBy,
  ...rest
}: NativeSelectProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  return (
    <span
      className={cx("z-select", className)}
      data-size={size}
      data-block={block || undefined}
      data-invalid={isInvalid || undefined}
      data-disabled={rest.disabled || undefined}
    >
      {/* Sin valor, el `placeholder` es la opción mostrada: el navegador elegiría la primera opción habilitada. */}
      <select
        {...rest}
        {...control}
        defaultValue={rest.value === undefined ? (rest.defaultValue ?? (placeholder ? "" : undefined)) : undefined}
        className="z-select__control"
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <span className="z-select__chevron">
        <Icon name="chevron-down" size={ICON_SIZE[size]} />
      </span>
    </span>
  );
}
