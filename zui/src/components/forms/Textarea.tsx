"use client";
import { useState, type Ref, type TextareaHTMLAttributes } from "react";
import { cx } from "../../cx";
import { useFieldControl } from "./Field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: "sm" | "md";
  invalid?: boolean;
  mono?: boolean;
  /** Crece con el contenido hasta `maxRows`. */
  autoRows?: boolean;
  maxRows?: number;
  /** Permite redimensionar a mano. */
  resize?: "none" | "vertical";
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  size = "md",
  invalid,
  mono,
  autoRows,
  maxRows = 10,
  resize = "vertical",
  rows = 3,
  className,
  id,
  required,
  onChange,
  "aria-describedby": describedBy,
  ...rest
}: TextareaProps) {
  // Sin controlar, el texto vive en el DOM: se guarda lo último escrito para contar sus líneas.
  const [typed, setTyped] = useState<string | null>(null);
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  // Filas calculadas a partir de los saltos de línea del valor.
  const text = String(rest.value ?? typed ?? rest.defaultValue ?? "");
  const computedRows = autoRows ? Math.min(maxRows, Math.max(rows, text.split("\n").length)) : rows;
  return (
    <textarea
      {...rest}
      {...control}
      onChange={(event) => {
        if (autoRows && rest.value === undefined) setTyped(event.target.value);
        onChange?.(event);
      }}
      rows={computedRows}
      className={cx("z-textarea", className)}
      data-size={size}
      data-invalid={isInvalid || undefined}
      data-mono={mono || undefined}
      data-resize={resize}
    />
  );
}
