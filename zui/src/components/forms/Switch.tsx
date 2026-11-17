"use client";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { NativeInput } from "../../primitives/native-input";
import { useFieldControl } from "./Field";

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
}

/** Interruptor de activación inmediata (role="switch"). */
export function Switch({ checked: checkedProp, defaultChecked = false, onCheckedChange, name, value = "on", form, size = "md", children, labelPosition = "end", className, id, required, disabled, onClick, "aria-describedby": describedBy, ...rest }: SwitchProps) {
  const { invalid: _invalid, "aria-invalid": _ariaInvalid, required: isRequired, ...control } = useFieldControl({ id, required, "aria-describedby": describedBy });
  const [checked, setChecked] = useControllable(checkedProp, defaultChecked, onCheckedChange);
  const state = checked ? "checked" : "unchecked";
  return (
    <label className={cx("z-switch", className)} data-size={size} data-label={labelPosition} data-disabled={disabled || undefined}>
      <button
        type="button"
        {...rest}
        {...control}
        role="switch"
        aria-checked={checked}
        aria-required={isRequired}
        data-state={state}
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
      <NativeInput type="checkbox" name={name} value={value} form={form} checked={checked} required={isRequired} disabled={disabled} onReset={() => setChecked(defaultChecked)} />
      {children ? <span className="z-switch__label">{children}</span> : null}
    </label>
  );
}
