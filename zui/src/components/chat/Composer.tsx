"use client";
import type { Ref } from "react";
import {
  composerWidget,
  type ComposerFile,
  type ComposerLabels,
  type ComposerProps as CoreProps,
  type ComposerSend,
  type ComposerVoice,
} from "../../core/composer-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { ComposerFile, ComposerLabels, ComposerSend, ComposerVoice };

export interface ComposerProps extends Omit<CoreProps, "status" | "models" | "model" | "tools" | "usage"> {
  /** Texto cambiado (cada pulsación). */
  onValueChange?: (value: string) => void;
  /** Enviar: texto con las menciones como `<@id>`, adjuntos y a qué responde o qué edita. */
  onSend?: (detail: ComposerSend) => void;
  /** Archivos añadidos (elegidos, pegados o soltados). */
  onAttach?: (detail: { files: File[] }) => void;
  onRemoveAttachment?: (detail: { id: string; name?: string }) => void;
  /** Nota de voz grabada (con `voice`). */
  onVoice?: (detail: ComposerVoice) => void;
  onRecordError?: () => void;
  onCancelReply?: () => void;
  onCancelEdit?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Caja de texto de chat: crece con el texto, Intro envía y Mayús+Intro salta de línea (sin enviar durante un IME),
 * adjuntos con quitar, emojis, menciones con `@`, respondiendo/editando y notas de voz con MediaRecorder si existe.
 */
export const Composer = withRef(function Composer({
  onValueChange,
  onSend,
  onAttach,
  onRemoveAttachment,
  onVoice,
  onRecordError,
  onCancelReply,
  onCancelEdit,
  id,
  className,
  ref,
  ...props
}: ComposerProps) {
  return useWidget(composerWidget, props, {
    id,
    className,
    ref,
    handlers: {
      "value-change": onValueChange ? (d: { value: string }) => onValueChange(d.value) : undefined,
      send: onSend,
      attach: onAttach,
      "remove-attachment": onRemoveAttachment,
      voice: onVoice,
      "record-error": onRecordError,
      "cancel-reply": onCancelReply,
      "cancel-edit": onCancelEdit,
    },
  });
});
