"use client";
import type { Ref } from "react";
import { analogClockWidget, type AnalogClockProps as CoreProps } from "../../core/clock-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export interface AnalogClockProps extends CoreProps {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Reloj de esfera en SVG: horas, minutos y segundero opcional, marcas y números, zona IANA. Es una imagen con nombre
 * («10:42, Madrid») que cambia una vez por minuto; el segundero es decorativo.
 */
export const AnalogClock = withRef(function AnalogClock({ id, className, ref, ...props }: AnalogClockProps) {
  return useWidget(analogClockWidget, props, { id, className, ref });
});
