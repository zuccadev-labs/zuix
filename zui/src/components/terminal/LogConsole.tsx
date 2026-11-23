"use client";
import type { Ref } from "react";
import {
  logConsoleWidget,
  type LogConsoleLabels,
  type LogConsoleProps as CoreProps,
  type LogEntry,
  type LogLevel,
} from "../../core/log-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { LogConsoleLabels, LogEntry, LogLevel };

export interface LogConsoleProps extends CoreProps {
  /** Cambio de los niveles visibles. */
  onLevelsChange?: (detail: { levels: LogLevel[] }) => void;
  /** Botón de limpiar (con `clearable`). */
  onClear?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Consola de logs: hora, nivel, origen y mensaje; filtros por nivel con contadores, búsqueda con las coincidencias
 * marcadas, seguir el final, copiar y descargar. Pinta por ventana: miles de entradas sin miles de nodos.
 */
export const LogConsole = withRef(function LogConsole({ onLevelsChange, onClear, id, className, ref, ...props }: LogConsoleProps) {
  return useWidget(logConsoleWidget, props, { id, className, ref, handlers: { "levels-change": onLevelsChange, clear: onClear } });
});
