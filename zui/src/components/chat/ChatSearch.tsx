"use client";
import type { Ref } from "react";
import { chatSearchWidget, type ChatSearchLabels, type ChatSearchProps as CoreProps } from "../../core/chat-search-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { ChatSearchLabels };

export interface ChatSearchProps extends CoreProps {
  /** Lo escrito (tras un breve antirrebote). */
  onQueryChange?: (query: string) => void;
  /** Coincidencia actual: su posición, el total y el índice del mensaje entre los buscados. */
  onMatchChange?: (detail: { index: number; total: number; message: number }) => void;
  /** Cerrar (botón o Escape). */
  onClose?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Buscar en una conversación: campo, contador, anterior y siguiente (Intro, Mayús + Intro) y cerrar (Escape).
 * Resalta con la CSS Custom Highlight API sobre los mensajes de `target`, sin tocar su marcado.
 */
export const ChatSearch = withRef(function ChatSearch({ onQueryChange, onMatchChange, onClose, id, className, ref, ...props }: ChatSearchProps) {
  return useWidget(chatSearchWidget, props, {
    id,
    className,
    ref,
    handlers: {
      "query-change": onQueryChange ? (detail: { query: string }) => onQueryChange(detail.query) : undefined,
      "match-change": onMatchChange,
      close: onClose,
    },
  });
});
