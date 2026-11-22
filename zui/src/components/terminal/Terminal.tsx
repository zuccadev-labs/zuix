"use client";
import { useImperativeHandle, useRef, type Ref } from "react";
import {
  terminalApi,
  terminalWidget,
  type TerminalLabels,
  type TerminalProps as CoreProps,
  type TerminalResult,
  type TerminalRun,
} from "../../core/terminal-widget";
import { useWidget } from "../agenda/vtree";

export type { TerminalLabels, TerminalResult, TerminalRun };

/** Lo que expone la `ref` de Terminal: escribir salida, limpiar y enfocar. */
export interface TerminalHandle {
  write(chunk: string): void;
  writeln(line?: string): void;
  clear(): void;
  focus(): void;
  /** Texto plano de la salida. */
  text(): string;
  readonly element: HTMLDivElement | null;
}

export interface TerminalProps extends CoreProps {
  /** Ctrl+C con una orden en marcha. */
  onInterrupt?: () => void;
  /** Botón de limpiar. */
  onClear?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<TerminalHandle>;
}

/**
 * Terminal de líneas: prompt, historial con ↑/↓, autocompletado con Tab (con `onComplete`), Ctrl+L y Ctrl+C, salida
 * ANSI (16, 256 y 24 bits) en streaming y copiar. `onCommand` devuelve texto, un código de salida, una promesa o un
 * iterable asíncrono de trozos; la `ref` escribe desde fuera.
 */
export function Terminal({ onInterrupt, onClear, id, className, ref, ...props }: TerminalProps) {
  const root = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      write: (chunk) => terminalApi(root.current)?.write(chunk),
      writeln: (line) => terminalApi(root.current)?.writeln(line),
      clear: () => terminalApi(root.current)?.clear(),
      focus: () => terminalApi(root.current)?.focus(),
      text: () => terminalApi(root.current)?.text() ?? "",
      get element() {
        return root.current;
      },
    }),
    [],
  );
  return useWidget(terminalWidget, props, { id, className, ref: root, handlers: { interrupt: onInterrupt, clear: onClear } });
}
