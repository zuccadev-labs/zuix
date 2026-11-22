"use client";
import type { Ref } from "react";
import { toolCallWidget, type ToolCallProps as CoreProps } from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";

export interface ToolCallProps extends Omit<CoreProps, "id"> {
  /** Id de la llamada (vuelve en los avisos de aprobar y rechazar). */
  callId?: string;
  /** Con `status="awaiting-approval"`. */
  onApprove?: (detail: { id?: string }) => void;
  onReject?: (detail: { id?: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Llamada a una herramienta: nombre, estado en texto e icono, duración y entrada/salida plegables. */
export function ToolCall({ callId, onApprove, onReject, id, className, ref, ...props }: ToolCallProps) {
  return useWidget(toolCallWidget, { ...props, id: callId }, { id, className, ref, handlers: { approve: onApprove, reject: onReject } });
}
