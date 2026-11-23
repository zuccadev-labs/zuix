"use client";
import type { Ref } from "react";
import { circularSliderWidget, type CircularSliderProps as CoreProps } from "../../core/circular-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export interface CircularSliderProps extends CoreProps {
  /** Cada cambio mientras se arrastra o con una tecla. */
  onValueChange?: (value: number) => void;
  /** Al soltar el puntero o tras una tecla. */
  onValueChangeEnd?: (value: number) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Deslizador circular (círculo completo o arco abierto) con el valor en el centro; patrón APG «slider». */
export const CircularSlider = withRef(function CircularSlider({
  onValueChange,
  onValueChangeEnd,
  id,
  className,
  ref,
  ...props
}: CircularSliderProps) {
  return useWidget(circularSliderWidget, props, {
    id,
    className,
    ref,
    handlers: {
      change: onValueChange ? (d: { value: number }) => onValueChange(d.value) : undefined,
      "change-end": onValueChangeEnd ? (d: { value: number }) => onValueChangeEnd(d.value) : undefined,
    },
  });
});
