"use client";
import type { Ref } from "react";
import { countdownWidget, type CountdownLabels, type CountdownProps as CoreProps } from "../../core/countdown-widget";
import { useWidget } from "../agenda/vtree";

export type { CountdownLabels };

export interface CountdownProps extends CoreProps {
  /** Al llegar al instante (una vez). */
  onComplete?: (detail: { to: number }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Cuenta atrás hasta un instante: días, horas, minutos y segundos en cajas (`segments`), en línea o con cifras que
 * giran (`flip`). Es un `role="timer"`; solo se anuncian los hitos y el final, nunca cada segundo.
 */
export function Countdown({ onComplete, id, className, ref, ...props }: CountdownProps) {
  return useWidget(countdownWidget, props, { id, className, ref, handlers: { complete: onComplete } });
}
