"use client";
import type { Ref } from "react";
import { worldClockWidget, type WorldClockLabels, type WorldClockProps as CoreProps, type WorldClockZone } from "../../core/clock-widget";
import { useWidget } from "../agenda/vtree";

export type { WorldClockLabels, WorldClockZone };

export interface WorldClockProps extends CoreProps {
  /** Con `removable`: la persona quitó una ciudad. */
  onRemove?: (detail: { timeZone: string; index: number }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Varias zonas a la vez, en lista o rejilla: hora, diferencia con la zona de referencia («+6 h»), día («Tomorrow»)
 * y día o noche. Cada ciudad se lee como una frase completa.
 */
export function WorldClock({ onRemove, id, className, ref, ...props }: WorldClockProps) {
  return useWidget(worldClockWidget, props, { id, className, ref, handlers: { remove: onRemove } });
}
