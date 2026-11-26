"use client";
import type { Ref } from "react";
import { stackTraceWidget, type StackTraceLabels, type StackTraceProps as CoreProps } from "../../core/stack-trace-widget";
import type { StackFrame } from "../../core/stack-trace";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { StackFrame, StackTraceLabels };

export interface StackTraceProps extends CoreProps {
  /** Con `selectable`: un marco elegido (para abrirlo en el editor). */
  onFrameSelect?: (frame: StackFrame, index: number) => void;
  onCopy?: (detail: { ok: boolean }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Traza de un error, plegable: tipo y mensaje, marcos de la aplicación a la vista y los de terceros plegados en grupos,
 * y copiar. Lee las pilas de Chrome, Node, Firefox y Safari.
 */
export const StackTrace = withRef(function StackTrace({ onFrameSelect, onCopy, id, className, ref, ...props }: StackTraceProps) {
  return useWidget(stackTraceWidget, props, {
    id,
    className,
    ref,
    handlers: {
      "frame-select": onFrameSelect ? (detail: { frame: StackFrame; index: number }) => onFrameSelect(detail.frame, detail.index) : undefined,
      copy: onCopy,
    },
  });
});
