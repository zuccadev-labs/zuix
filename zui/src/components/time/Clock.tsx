"use client";
import type { Ref } from "react";
import { clockWidget, type ClockProps as CoreProps } from "../../core/clock-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export interface ClockProps extends CoreProps {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Reloj digital: 12 o 24 h según el locale (o `hourCycle`), segundos y fecha opcionales, zona IANA y separadores que
 * laten. Texto en un `<time datetime>`, sin región viva: no se anuncia solo.
 */
export const Clock = withRef(function Clock({ id, className, ref, ...props }: ClockProps) {
  return useWidget(clockWidget, props, { id, className, ref });
});
