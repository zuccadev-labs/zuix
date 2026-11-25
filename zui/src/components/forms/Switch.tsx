"use client";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { NativeInput } from "../../primitives/native-input";
import { useFieldControl } from "./Field";
import { withRef } from "../../react-compat";

export interface SwitchProps extends Omit<ComponentProps<"button">, "children" | "value" | "onChange" | "defaultChecked"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Nombre del campo al enviar un formulario. */
  name?: string;
  /** Valor que envía el formulario cuando está activado. */
  value?: string;
  required?: boolean;
  size?: "sm" | "md";
  /** Etiqueta visible. Sin ella hace falta `aria-label`. */
  children?: ReactNode;
  /** Coloca la etiqueta antes o después del interruptor. */
  labelPosition?: "start" | "end";
  /** Texto secundario bajo la etiqueta. */
  description?: ReactNode;
  /** Marca el interruptor como no válido (por ejemplo, unas condiciones obligatorias sin aceptar). */
  invalid?: boolean;
  /** `card`: etiqueta, descripción e interruptor en un recuadro (el interruptor al final). */
  variant?: "default" | "card";
}

/** Interruptor de activación inmediata (role="switch"). */
export const Switch = withRef(function Switch({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  name,
  value = "on",
  form,
  size = "md",
  children,
  labelPosition = "end",
  description,
  invalid,
  variant = "default",
  className,
  id,
  required,
  disabled,
  onClick,
  "aria-describedby": describedBy,
  ...rest
}: SwitchProps) {
  const {
    invalid: isInvalid,
    required: isRequired,
    ...control
  } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const [checked, setChecked] = useControllable(checkedProp, defaultChecked, onCheckedChange);
  const state = checked ? "checked" : "unchecked";
  return (
    <label
      className={cx("z-switch", className)}
      data-size={size}
      data-label={variant === "card" ? "start" : labelPosition}
      data-disabled={disabled || undefined}
      data-variant={variant === "card" ? "card" : undefined}
    >
      <button
        type="button"
        {...rest}
        {...control}
        role="switch"
        aria-checked={checked}
        aria-required={isRequired}
        data-state={state}
        data-invalid={isInvalid || undefined}
        data-disabled={disabled ? "" : undefined}
        disabled={disabled}
        value={value}
        className="z-switch__track"
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setChecked(!checked);
        }}
      >
        <span className="z-switch__thumb" data-state={state} />
      </button>
      <NativeInput
        type="checkbox"
        name={name}
        value={value}
        form={form}
        checked={checked}
        required={isRequired}
        disabled={disabled}
        onReset={() => setChecked(defaultChecked)}
      />
      {children && description ? (
        <span className="z-check__text">
          <span className="z-switch__label">{children}</span>
          <span className="z-check__description">{description}</span>
        </span>
      ) : children ? (
        <span className="z-switch__label">{children}</span>
      ) : null}
    </label>
  );
});
