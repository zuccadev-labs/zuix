"use client";
import type { Ref } from "react";
import {
  promptInputWidget,
  type ComposerFile,
  type ComposerModel,
  type ComposerProps as CoreProps,
  type ComposerSend,
  type ComposerTool,
} from "../../core/composer-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { ComposerModel as PromptModel, ComposerTool as PromptTool };

export interface PromptInputProps extends Omit<CoreProps, "voice" | "replyTo" | "editing" | "mentions"> {
  onValueChange?: (value: string) => void;
  /** Enviar el prompt (con sus adjuntos). */
  onSubmit?: (detail: ComposerSend) => void;
  /** Parar la respuesta en curso (el botón de enviar pasa a parar). */
  onStop?: () => void;
  onAttach?: (detail: { files: File[] }) => void;
  onRemoveAttachment?: (detail: { id: string; name?: string }) => void;
  onModelChange?: (detail: { model: string }) => void;
  onToolToggle?: (detail: { id: string; active: boolean }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export type { ComposerFile as PromptFile, ComposerSend as PromptSubmit };

/**
 * Entrada de un asistente: campo que crece (Intro envía, sin enviar durante un IME), adjuntos, selector de modelo,
 * herramientas activables, uso de contexto y enviar ↔ parar en el mismo sitio.
 */
export const PromptInput = withRef(function PromptInput({
  onValueChange,
  onSubmit,
  onStop,
  onAttach,
  onRemoveAttachment,
  onModelChange,
  onToolToggle,
  id,
  className,
  ref,
  ...props
}: PromptInputProps) {
  return useWidget(promptInputWidget, props, {
    id,
    className,
    ref,
    handlers: {
      "value-change": onValueChange ? (d: { value: string }) => onValueChange(d.value) : undefined,
      send: onSubmit,
      stop: onStop,
      attach: onAttach,
      "remove-attachment": onRemoveAttachment,
      "model-change": onModelChange,
      "tool-toggle": onToolToggle,
    },
  });
});
