"use client";
import type { Ref } from "react";
import { habitWidget, type HabitCalendarProps as CoreProps, type HabitLabels, type HabitState } from "../../core/habit-widget";
import { useWidget } from "./vtree";
import { withRef } from "../../react-compat";

export type { HabitLabels, HabitState };

export interface HabitCalendarProps extends CoreProps {
  onDayClick?: (detail: { date: string; state: HabitState | null }) => void;
  onMonthChange?: (detail: { month: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Rachas y hábitos: días cumplidos (sólido y marca), fallados (trama y cruz), de descanso (guion; no rompen la racha)
 * y hoy en curso (anillo de progreso), con la banda de la racha actual y leyenda; `variant="week"`, tira compacta.
 */
export const HabitCalendar = withRef(function HabitCalendar({
  onDayClick,
  onMonthChange,
  id,
  className,
  ref,
  ...props
}: HabitCalendarProps) {
  return useWidget(habitWidget, props, { id, className, ref, handlers: { "day-click": onDayClick, "month-change": onMonthChange } });
});
