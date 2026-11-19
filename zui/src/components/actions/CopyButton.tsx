"use client";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { announceText, copyableText, copyText } from "../../core/clipboard";
import { cx } from "../../cx";
import { BUTTON_ICON_SIZE, type ButtonSize, type ButtonVariant } from "./types";

export interface CopyButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "children" | "onCopy"> {
  /** Texto que se copia, o función que lo devuelve en el momento de copiar. */
  value?: string | (() => string);
  /** Id del elemento cuyo texto (o valor, si es un campo) se copia. Se usa si no hay `value`. */
  target?: string;
  /** Nombre accesible; di qué se copia («Copy API key»). Con `children` el nombre es el texto visible. */
  label?: string;
  /** Mensaje tras copiar (visible y anunciado). */
  copiedLabel?: string;
  /** Mensaje si el navegador no deja copiar. */
  failedLabel?: string;
  /** Milisegundos que dura la confirmación. */
  timeout?: number;
  variant?: Exclude<ButtonVariant, "link">;
  size?: ButtonSize;
  /** Texto visible junto al icono. Sin él, botón de solo icono. */
  children?: ReactNode;
  onCopied?: (text: string) => void;
  onCopyError?: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Botón que copia un texto al portapapeles. El icono pasa a una marca y una burbuja (`role="status"`, fuera del
 * botón) dice «Copied» o «Copy failed»: lo ven y lo oyen igual. No se deshabilita mientras confirma.
 */
export function CopyButton({
  value,
  target,
  label = "Copy",
  copiedLabel = "Copied",
  failedLabel = "Copy failed",
  timeout = 2000,
  variant = "ghost",
  size = "sm",
  children,
  onCopied,
  onCopyError,
  className,
  onClick,
  ...rest
}: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const iconOnly = children == null;
  const px = BUTTON_ICON_SIZE[size];

  const report = (ok: boolean) => {
    clearTimeout(timer.current);
    setState(ok ? "copied" : "failed");
    setMessage("");
    // La región se vacía y se vuelve a escribir en el siguiente cuadro: el lector lo anuncia como un cambio.
    requestAnimationFrame(() => setMessage(announceText(ok ? copiedLabel : failedLabel)));
    timer.current = setTimeout(() => {
      setState("idle");
      setMessage("");
    }, timeout);
  };

  return (
    <span className={cx("z-copy", className)}>
      <button
        type="button"
        title={iconOnly ? label : undefined}
        {...rest}
        aria-label={iconOnly ? label : undefined}
        className={cx("z-btn", `z-btn--${variant}`, iconOnly && "z-btn--icon", "z-copy__button")}
        data-size={size}
        data-copied={state === "copied" || undefined}
        data-failed={state === "failed" || undefined}
        data-value={typeof value === "string" ? value : undefined}
        // Copia declarativa de otro elemento (Invoker Commands); el clic lo atiende este componente.
        {...(target && value === undefined ? { command: "--copy", commandfor: target } : {})}
        onClick={async (event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          const text = typeof value === "function" ? value() : (value ?? copyableText(target ? document.getElementById(target) : null));
          const ok = await copyText(text);
          report(ok);
          if (ok) onCopied?.(text);
          else onCopyError?.();
        }}
      >
        <span className="z-copy__icons" aria-hidden="true">
          <span className="z-copy__icon" data-for="idle">
            <Icon name="document-duplicate" size={px} />
          </span>
          <span className="z-copy__icon" data-for="copied">
            <Icon name="check" size={px} />
          </span>
          <span className="z-copy__icon" data-for="failed">
            <Icon name="x-mark" size={px} />
          </span>
        </span>
        {children}
      </button>
      <span className="z-copy__status" role="status" data-state={state}>
        {message}
      </span>
    </span>
  );
}
