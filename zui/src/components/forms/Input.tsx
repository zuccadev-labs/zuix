"use client";
import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";
import { withRef } from "../../react-compat";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: ControlSize;
  invalid?: boolean;
  /** Icono decorativo a la izquierda. */
  icon?: IconName;
  /** Contenido a la derecha (unidad, botón, atajo). */
  trailing?: ReactNode;
  /** Tipografía monoespaciada (rutas, claves, códigos). */
  mono?: boolean;
  /** Clase del `<input>`; `className` va a la envoltura. */
  inputClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export const Input = withRef(function Input({
  size = "md",
  invalid,
  icon,
  trailing,
  mono,
  className,
  inputClassName,
  id,
  required,
  "aria-describedby": describedBy,
  ...rest
}: InputProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  return (
    <span
      className={cx("z-input", className)}
      data-size={size}
      data-invalid={isInvalid || undefined}
      data-disabled={rest.disabled || undefined}
      data-mono={mono || undefined}
    >
      {icon ? (
        <span className="z-input__icon">
          <Icon name={icon} size={ICON_SIZE[size]} />
        </span>
      ) : null}
      <input {...rest} {...control} className={cx("z-input__control", inputClassName)} />
      {trailing ? <span className="z-input__trailing">{trailing}</span> : null}
    </span>
  );
});
