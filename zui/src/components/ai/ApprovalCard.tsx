"use client";
import type { Ref } from "react";
import { approvalCardWidget, type ApprovalCardProps as CoreProps } from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";

export interface ApprovalCardProps extends Omit<CoreProps, "id"> {
  /** Id de la petición (vuelve en los avisos). */
  requestId?: string;
  onApprove?: (detail: { id: string; always: boolean }) => void;
  onReject?: (detail: { id: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Petición de permiso de un agente: qué hará, con qué datos y su riesgo; con riesgo alto, aprobar pide confirmar. */
export function ApprovalCard({ requestId, onApprove, onReject, id, className, ref, ...props }: ApprovalCardProps) {
  return useWidget(
    approvalCardWidget,
    { ...props, id: requestId ?? "approval" },
    { id, className, ref, handlers: { approve: onApprove, reject: onReject } },
  );
}
