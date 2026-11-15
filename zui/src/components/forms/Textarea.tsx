"use client";
import type { Ref, TextareaHTMLAttributes } from "react";
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

export function Textarea({ size = "md", invalid, mono, autoRows, maxRows = 10, resize = "vertical", rows = 3, className, id, required, "aria-describedby": describedBy, ...rest }: TextareaProps) {
  const { invalid: isInvalid, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  // Filas calculadas a partir de los saltos de línea del valor.
  const text = String(rest.value ?? rest.defaultValue ?? "");
  const computedRows = autoRows ? Math.min(maxRows, Math.max(rows, text.split("\n").length)) : rows;
  return (
    <textarea
      {...rest}
      {...control}
      rows={computedRows}
      className={cx("z-textarea", className)}
      data-size={size}
      data-invalid={isInvalid || undefined}
      data-mono={mono || undefined}
      data-resize={resize}
    />
  );
}
