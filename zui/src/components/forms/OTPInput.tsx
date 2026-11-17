"use client";
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cx } from "../../cx";
import { useFieldControl, useFieldLabel } from "./Field";

export interface OTPInputProps {
  /** Número de casillas. */
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Se llama cuando todas las casillas están completas. */
  onComplete?: (value: string) => void;
  /** `numeric` admite solo dígitos; `text` admite letras y dígitos. */
  mode?: "numeric" | "text";
  /** Oculta los caracteres. */
  mask?: boolean;
  size?: "md" | "lg";
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Nombre accesible del grupo. */
  label?: string;
  /** Nombre accesible de cada casilla. */
  cellLabel?: (position: number, total: number) => string;
  /** Nombre del campo oculto para envío en formularios. */
  name?: string;
  className?: string;
}

/** Código de un solo uso en casillas: avance automático, retroceso, flechas y pegado. */
export function OTPInput({
  length = 6,
  value,
  defaultValue = "",
  onChange,
  onComplete,
  mode = "numeric",
  mask,
  size = "md",
  invalid,
  disabled,
  autoFocus,
  label,
  cellLabel = (position, total) => `Character ${position} of ${total}`,
  name,
  className,
}: OTPInputProps) {
  const { invalid: isInvalid, "aria-describedby": describedBy } = useFieldControl({ invalid });
  // Dentro de un Field con etiqueta, el grupo se nombra con ella; si no, con `label`.
  const fieldLabel = useFieldLabel();
  const named = label === undefined && fieldLabel ? { "aria-labelledby": fieldLabel } : { "aria-label": label ?? "Verification code" };
  const [inner, setInner] = useState(defaultValue);
  const cells = useRef<Array<HTMLInputElement | null>>([]);
  const current = (value ?? inner).slice(0, length);
  const clean = (text: string) => text.replace(mode === "numeric" ? /\D/g : /[^a-zA-Z0-9]/g, "");

  const commit = (next: string) => {
    const trimmed = next.slice(0, length);
    setInner(trimmed);
    onChange?.(trimmed);
    if (trimmed.length === length) onComplete?.(trimmed);
  };
  const focusCell = (index: number) => {
    const node = cells.current[Math.max(0, Math.min(length - 1, index))];
    node?.focus();
    node?.select();
  };

  const handleInput = (index: number, raw: string) => {
    const typed = clean(raw);
    if (!typed) return;
    // Escribir sobre una casilla sustituye su carácter; el resto se conserva.
    const next = (current.slice(0, index) + typed + current.slice(index + 1)).slice(0, length);
    commit(next);
    focusCell(Math.min(index + typed.length, length - 1));
  };
  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (current[index]) commit(current.slice(0, index) + current.slice(index + 1));
      else if (index > 0) {
        commit(current.slice(0, index - 1) + current.slice(index));
        focusCell(index - 1);
      }
    } else if (event.key === "Delete") {
      // Supr borra el carácter de la casilla sin mover el foco.
      event.preventDefault();
      if (current[index]) commit(current.slice(0, index) + current.slice(index + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusCell(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusCell(Math.min(index + 1, current.length));
    }
  };
  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = clean(event.clipboardData.getData("text"));
    if (!pasted) return;
    commit(pasted);
    focusCell(Math.min(pasted.length, length - 1));
  };

  return (
    <div
      role="group"
      {...named}
      aria-describedby={describedBy}
      className={cx("z-otp", className)}
      data-size={size}
      data-invalid={isInvalid || undefined}
    >
      {Array.from({ length }, (_, index) => (
        <input
          // biome-ignore lint/suspicious/noArrayIndexKey: una casilla es su posición en el código; la lista solo cambia de longitud.
          key={index}
          ref={(node) => {
            cells.current[index] = node;
          }}
          className="z-otp__cell"
          type={mask ? "password" : "text"}
          inputMode={mode === "numeric" ? "numeric" : "text"}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          // biome-ignore lint/a11y/noAutofocus: es opcional y lo decide quien usa el componente (prop `autoFocus`, desactivada por defecto), para pantallas cuyo único fin es escribir el código.
          autoFocus={autoFocus && index === 0}
          maxLength={length}
          value={current[index] ?? ""}
          disabled={disabled}
          aria-label={cellLabel(index + 1, length)}
          aria-invalid={isInvalid || undefined}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
      {name ? <input type="hidden" name={name} value={current} /> : null}
    </div>
  );
}
