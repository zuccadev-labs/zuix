"use client";
import type { Ref } from "react";
import {
  durationFieldWidget,
  type DurationFieldLabels,
  type DurationFieldProps as CoreProps,
  type DurationFieldUnit,
} from "../../core/duration-widget";
import { useWidget } from "../agenda/vtree";

export type { DurationFieldLabels, DurationFieldUnit };

export interface DurationFieldProps extends CoreProps {
  /** Valor nuevo en ISO 8601 (`PT1H30M`) y en milisegundos. */
  onValueChange?: (value: string, ms: number) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Duración por segmentos (horas, minutos, segundos), cada uno un `spinbutton` con su valor hablado, y preajustes
 * opcionales. El valor es ISO 8601 y viaja con el formulario.
 */
export function DurationField({ onValueChange, id, className, ref, ...props }: DurationFieldProps) {
  return useWidget(durationFieldWidget, props, {
    id,
    className,
    ref,
    handlers: { change: onValueChange ? (d: { value: string; ms: number }) => onValueChange(d.value, d.ms) : undefined },
  });
}
