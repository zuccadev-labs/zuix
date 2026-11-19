// Copiar al portapapeles con confirmación visible y anunciada: la burbuja de estado es a la vez el aviso para quien
// ve y la región viva para el lector de pantalla, y queda fuera del botón (los hijos de un botón no se anuncian).
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "@zuccadev-labs/zuix-zui";
import { useCallback, useEffect, useRef, useState } from "react";

export type CopyState = "idle" | "copied" | "failed";

/** Escribe en el portapapeles. Fuera de un contexto seguro (`http:` en la red local) la API no existe y falla. */
export async function writeClipboard(text: string): Promise<void> {
  if (!navigator.clipboard) throw new Error("clipboard");
  await navigator.clipboard.writeText(text);
}

/** Estado de una copia: vuelve a reposo a los 2 s; una pulsación repetida reinicia el plazo. */
export function useCopy(): [CopyState, (text: string | (() => Promise<string>)) => Promise<void>] {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (text: string | (() => Promise<string>)) => {
    clearTimeout(timer.current);
    try {
      await writeClipboard(typeof text === "string" ? text : await text());
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 2000);
  }, []);
  return [state, copy];
}

const MESSAGE: Record<CopyState, string> = { idle: "", copied: "Copiado", failed: "No se pudo copiar" };

export function CopyButton({
  text,
  label = "Copiar",
  name,
  className,
}: {
  text: string | (() => Promise<string>);
  label?: string;
  /** Qué se copia, para el nombre accesible: «Copiar el comando». */
  name?: string;
  className?: string;
}) {
  const [state, copy] = useCopy();
  return (
    <span className="zd-copy">
      <button
        type="button"
        className={cx("z-btn z-btn--secondary zd-copy__button", className)}
        data-size="sm"
        data-copied={state === "copied" || undefined}
        aria-label={name ? `${label} ${name}` : undefined}
        onClick={() => void copy(text)}
      >
        <Icon name={state === "copied" ? "check" : "copy"} size={14} />
        <span aria-hidden={name ? true : undefined}>{state === "copied" ? "Copiado" : label}</span>
      </button>
      <span className="zd-sr-only" role="status">
        {MESSAGE[state]}
      </span>
    </span>
  );
}
