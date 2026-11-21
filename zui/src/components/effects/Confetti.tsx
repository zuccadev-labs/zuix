"use client";
import { useEffect, useRef, type RefObject } from "react";
import { confetti, type ConfettiOptions } from "../../core/confetti-runtime";

export { confetti, type ConfettiOptions };

export interface ConfettiProps extends Omit<ConfettiOptions, "origin"> {
  /** Cada cambio de valor (distinto del primero) lanza una ráfaga: un contador o un identificador. */
  trigger: unknown;
  /** Elemento del que sale; por defecto, el centro de la ventana algo por debajo de la mitad. */
  origin?: RefObject<Element | null> | { x: number; y: number };
  /** Al terminar la ráfaga. */
  onComplete?: () => void;
}

/**
 * Confeti de celebración: un lienzo fijo encima de la página, sin puntero ni foco, con los colores de la marca.
 * Decorativo: anuncie el logro con texto. Con movimiento reducido no anima. No pinta nada en el árbol.
 */
export function Confetti({ trigger, origin, onComplete, ...options }: ConfettiProps) {
  const previous = useRef(trigger);
  const latest = useRef({ origin, onComplete, options });
  latest.current = { origin, onComplete, options };
  useEffect(() => {
    // Solo un cambio de valor lanza (el montaje y el doble efecto de StrictMode no).
    if (Object.is(previous.current, trigger)) return;
    previous.current = trigger;
    if (trigger === undefined || trigger === null || trigger === false) return;
    const { origin: o, onComplete: done, options: opts } = latest.current;
    const at = o && "current" in o ? (o.current ?? undefined) : (o as { x: number; y: number } | undefined);
    void confetti({ ...opts, origin: at }).then(() => done?.());
  }, [trigger]);
  return null;
}
