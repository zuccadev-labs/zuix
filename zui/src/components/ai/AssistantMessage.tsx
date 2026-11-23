"use client";
import type { Ref } from "react";
import {
  assistantMessageWidget,
  type AiLabels,
  type AssistantMessageProps as CoreProps,
  type AssistantPart,
  type Source,
} from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { AiLabels, AssistantPart, Source };

export interface AssistantMessageProps extends CoreProps {
  onCopy?: (detail: { text: string }) => void;
  onRegenerate?: () => void;
  onFeedback?: (detail: { value: "up" | "down" | null }) => void;
  onBranchChange?: (detail: { index: number }) => void;
  onRetry?: () => void;
  /** Aprobar o rechazar una herramienta o una petición de permiso de la respuesta. */
  onApprove?: (detail: { id: string; always?: boolean }) => void;
  onReject?: (detail: { id: string }) => void;
  onOpenArtifact?: (detail: { id: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Respuesta de un asistente: partes en orden (texto en streaming con Markdown propio y cursor, razonamiento, herramientas,
 * aprobaciones, fuentes con citas y artefactos), acciones al terminar y ramas «‹ 2 / 3 ›». Mientras llega lleva
 * `aria-busy` y no se anuncia nada; al terminar se anuncia una vez.
 */
export const AssistantMessage = withRef(function AssistantMessage({
  onCopy,
  onRegenerate,
  onFeedback,
  onBranchChange,
  onRetry,
  onApprove,
  onReject,
  onOpenArtifact,
  id,
  className,
  ref,
  ...props
}: AssistantMessageProps) {
  return useWidget(assistantMessageWidget, props, {
    id,
    className,
    ref,
    handlers: {
      copy: onCopy,
      regenerate: onRegenerate,
      feedback: onFeedback,
      "branch-change": onBranchChange,
      retry: onRetry,
      approve: onApprove,
      reject: onReject,
      "open-artifact": onOpenArtifact,
    },
  });
});
