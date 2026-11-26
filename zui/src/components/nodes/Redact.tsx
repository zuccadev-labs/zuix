"use client";
import { useSyncExternalStore } from "react";
import { isRedacted, onRedactionChange, redactionOptions, redactText, type SensitiveKind } from "../../core/redact";
import { cx } from "../../cx";

export { isRedacted, redactText, setRedaction, type RedactOptions, type SensitiveKind } from "../../core/redact";

/** Estado del interruptor global de enmascarado (`setRedaction`). En el servidor, apagado. */
export function useRedaction(): boolean {
  return useSyncExternalStore(onRedactionChange, isRedacted, () => false);
}

export interface RedactProps {
  /** Valor sensible (un dominio, una IP, un nombre). */
  children: string | number;
  /** Qué contiene: `auto` (dominios, IP y correos), `domain`, `ip`, `email` o `text` (todo es secreto). Por defecto `auto`. */
  kind?: SensitiveKind;
  /** Fuerza el estado; sin él, sigue el interruptor global. */
  redacted?: boolean;
  /** Sustituto fijo en lugar del calculado. */
  placeholder?: string;
  className?: string;
}

/**
 * Dato sensible que se enmascara para capturas y exportaciones: con el interruptor global encendido (`setRedaction`),
 * el valor real no llega al DOM y en su lugar sale uno genérico y estable (`app.example.com`, `203.0.113.7`). Marca
 * `data-sensitive`: el modo DOM y `exportSVG` lo reconocen.
 */
export function Redact({ children, kind = "auto", redacted, placeholder, className }: RedactProps) {
  const global = useRedaction();
  const on = redacted ?? global;
  const text = String(children);
  const shown = on ? (placeholder ?? redactText(text, kind, redactionOptions())) : text;
  return (
    <span className={cx("z-redact", className)} data-sensitive={kind} data-redacted={on ? "" : undefined}>
      {shown}
    </span>
  );
}
