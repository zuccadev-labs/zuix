"use client";
import type { Ref } from "react";
import {
  conversationListWidget,
  type ConversationFilter,
  type ConversationItem,
  type ConversationListLabels,
  type ConversationListProps as CoreProps,
} from "../../core/conversation-list-widget";
import { useWidget } from "../agenda/vtree";

export type { ConversationFilter, ConversationItem, ConversationListLabels };

export interface ConversationListProps extends CoreProps {
  /** Se abre una conversación (clic o Intro). */
  onSelect?: (detail: { id: string }) => void;
  onSearch?: (detail: { query: string }) => void;
  onFilterChange?: (detail: { filter: ConversationFilter }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Lista de conversaciones: avatar con presencia, último mensaje (o quién escribe, o el borrador), hora corta, no leídos,
 * menciones, silenciado y fijado; búsqueda y filtros. Una sola parada de Tab con ↑/↓.
 */
export function ConversationList({ onSelect, onSearch, onFilterChange, id, className, ref, ...props }: ConversationListProps) {
  return useWidget(conversationListWidget, props, {
    id,
    className,
    ref,
    handlers: { select: onSelect, search: onSearch, "filter-change": onFilterChange },
  });
}
