"use client";
import type { Ref } from "react";
import { freeBusyWidget, type FreeBusyAttendee, type FreeBusyLabels, type FreeBusyProps as CoreProps } from "../../core/freebusy-widget";
import { useWidget } from "./vtree";

export type { FreeBusyAttendee, FreeBusyLabels };
export type { WorkingHours } from "../../core/freebusy";

export interface FreeBusyProps extends CoreProps {
  /** «Use …»: la franja común propuesta, en reloj de la zona de presentación y en milisegundos. */
  onSelect?: (detail: { start: string; end: string; timeZone: string; startMs: number; endMs: number }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Buscar hueco: una fila por persona con sus ocupados («Busy») y lo que queda fuera de su horario en su zona
 * («Outside hours»), y la primera franja común de `duration` minutos, con anterior, siguiente y «Use …».
 */
export function FreeBusy({ onSelect, id, className, ref, ...props }: FreeBusyProps) {
  return useWidget(freeBusyWidget, props, { id, className, ref, handlers: { select: onSelect } });
}
