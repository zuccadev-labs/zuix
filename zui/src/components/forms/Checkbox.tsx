"use client";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { NativeInput } from "../../primitives/native-input";
import { useFieldControl } from "./Field";

export type CheckedState = boolean | "indeterminate";

export interface CheckboxProps extends Omit<ComponentProps<"button">, "children" | "value" | "onChange" | "defaultChecked"> {
  checked?: CheckedState;
  defaultChecked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
  /** Nombre del campo al enviar un formulario. */
  name?: string;
  /** Valor que envía el formulario cuando está marcada. */
  value?: string;
  required?: boolean;
  /** Etiqueta visible. Sin ella hace falta `aria-label`. */
  children?: ReactNode;
  /** Texto secundario bajo la etiqueta. */
  description?: ReactNode;
  invalid?: boolean;
}

/** Casilla con estado marcado, sin marcar e indeterminado (`checked="indeterminate"`). Patrón APG «checkbox»: se cambia con Espacio. */
export function Checkbox({ checked: checkedProp, defaultChecked = false, onCheckedChange, name, value = "on", form, children, description, invalid, className, id, required, disabled, onClick, onKeyDown, "aria-describedby": describedBy, ...rest }: CheckboxProps) {
  const { invalid: isInvalid, required: isRequired, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const [checked, setChecked] = useControllable<CheckedState>(checkedProp, defaultChecked, onCheckedChange);
  const state = checked === "indeterminate" ? "indeterminate" : checked ? "checked" : "unchecked";
  return (
    <label className={cx("z-check", className)} data-disabled={disabled || undefined}>
      <button
        type="button"
        {...rest}
        {...control}
        role="checkbox"
        aria-checked={checked === "indeterminate" ? "mixed" : checked}
        aria-required={isRequired}
        data-state={state}
        data-invalid={isInvalid || undefined}
        data-disabled={disabled ? "" : undefined}
        disabled={disabled}
        value={value}
        className="z-check__box"
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setChecked(checked === "indeterminate" ? true : !checked);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          // Una casilla se marca con Espacio; Intro no la cambia (APG).
          if (event.key === "Enter") event.preventDefault();
        }}
      >
        {/* La marca se dibuja con CSS según data-state. */}
        <span className="z-check__mark" data-state={state} />
      </button>
      <NativeInput type="checkbox" name={name} value={value} form={form} checked={checked === true} indeterminate={checked === "indeterminate"} required={isRequired} disabled={disabled} onReset={() => setChecked(defaultChecked)} />
      {children || description ? (
        <span className="z-check__text">
          {children ? <span className="z-check__label">{children}</span> : null}
          {description ? <span className="z-check__description">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
