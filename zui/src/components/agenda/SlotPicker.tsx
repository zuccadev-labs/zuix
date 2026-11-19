"use client";
import type { Ref } from "react";
import type { Availability, HourCycle } from "../../core/slots";
import { slotPickerWidget, type SlotPickerLabels, type SlotPickerProps as CoreProps } from "../../core/slots-widget";
import { useWidget } from "./vtree";

export type { Availability, HourCycle, SlotPickerLabels };

export interface SlotPickerProps extends CoreProps {
  /** Hora elegida (instante ISO en UTC y milisegundos) y la zona en que se mostró. */
  onSelect?: (detail: { start: string; startMs: number; timeZone: string }) => void;
  /** «Next». */
  onConfirm?: (detail: { start: string; startMs: number; timeZone: string }) => void;
  onDateChange?: (detail: { date: string }) => void;
  onTimeZoneChange?: (detail: { timeZone: string }) => void;
  onHourCycleChange?: (detail: { hourCycle: HourCycle }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Franjas de cita: Calendar con los días que tienen hueco (los demás, deshabilitados pero enfocables y anunciados) y
 * un `listbox` con las horas del día en la zona del visitante, en 12 o 24 h; «Next» es un botón aparte.
 */
export function SlotPicker({ onSelect, onConfirm, onDateChange, onTimeZoneChange, onHourCycleChange, id, className, ref, ...props }: SlotPickerProps) {
  return useWidget(slotPickerWidget, props, {
    id,
    className,
    ref,
    handlers: {
      select: onSelect,
      confirm: onConfirm,
      "date-change": onDateChange,
      "time-zone-change": onTimeZoneChange,
      "hour-cycle-change": onHourCycleChange,
    },
  });
}
