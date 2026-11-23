"use client";
import type { HTMLAttributes, InputHTMLAttributes, MouseEvent, ReactNode, Ref, TextareaHTMLAttributes } from "react";
import { cx } from "../../cx";
import type { ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";
import { withRef } from "../../react-compat";

export interface InputGroupProps extends HTMLAttributes<HTMLDivElement> {
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

const INTERACTIVE = "button, a, input, select, textarea, label, [tabindex], [contenteditable]";

/** Pulsar en un adorno (no en un botón suyo) lleva el foco al campo, como en un campo nativo. */
function focusGroupControl(event: MouseEvent<HTMLElement>): void {
  const target = event.target as Element;
  if (target.closest(INTERACTIVE)) return;
  const control = event.currentTarget.closest(".z-input-group")?.querySelector<HTMLElement>(".z-input-group__control");
  if (!control || (control as HTMLInputElement).disabled) return;
  event.preventDefault();
  control.focus();
}

/**
 * Campo con adornos: texto, icono, atajo, botón o menú al inicio, al final, encima o debajo del control. Es un solo
 * recuadro (fondo, canto y anillo de foco en el contenedor); el control es `InputGroupInput` o `InputGroupTextarea`.
 */
export const InputGroup = withRef(function InputGroup({ size = "md", invalid, disabled, className, children, ...rest }: InputGroupProps) {
  const field = useFieldControl({ invalid });
  return (
    <div
      {...rest}
      className={cx("z-input-group", className)}
      data-size={size}
      data-invalid={field.invalid || undefined}
      data-disabled={disabled || undefined}
    >
      {children}
    </div>
  );
});

export interface InputGroupAddonProps extends HTMLAttributes<HTMLDivElement> {
  /** Lado del adorno. `block-start` y `block-end` ocupan una fila propia (útil con un textarea). */
  align?: "inline-start" | "inline-end" | "block-start" | "block-end";
  /** `plain`: dentro del recuadro. `segment`: tramo con fondo propio y separador (prefijos como `https://`). */
  variant?: "plain" | "segment";
  children?: ReactNode;
}

export function InputGroupAddon({
  align = "inline-start",
  variant = "plain",
  className,
  children,
  onMouseDown,
  ...rest
}: InputGroupAddonProps) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: solo reenvía el foco al campo (como pulsar en su recuadro); no es un control propio.
    <div
      {...rest}
      className={cx("z-input-group__addon", className)}
      data-align={align}
      data-variant={variant}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        if (!event.defaultPrevented) focusGroupControl(event);
      }}
    >
      {children}
    </div>
  );
}

/** Texto de un adorno (unidad, prefijo, contador). */
export function InputGroupText({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...rest} className={cx("z-input-group__text", className)}>
      {children}
    </span>
  );
}

export interface InputGroupInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export const InputGroupInput = withRef(function InputGroupInput({
  className,
  id,
  invalid,
  required,
  "aria-describedby": describedBy,
  ...rest
}: InputGroupInputProps) {
  const { invalid: _invalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  return <input {...rest} {...control} className={cx("z-input-group__control", className)} />;
});

export interface InputGroupTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

export const InputGroupTextarea = withRef(function InputGroupTextarea({
  className,
  id,
  invalid,
  required,
  rows = 3,
  "aria-describedby": describedBy,
  ...rest
}: InputGroupTextareaProps) {
  const { invalid: _invalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  return <textarea rows={rows} {...rest} {...control} className={cx("z-input-group__control", className)} data-multiline="" />;
});
