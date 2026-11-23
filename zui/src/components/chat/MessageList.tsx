"use client";
import { useImperativeHandle, useRef, type Ref } from "react";
import {
  messageListApi,
  messageListWidget,
  type MessageListLabels,
  type MessageListProps as CoreProps,
} from "../../core/message-list-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { MessageListLabels };

/** Lo que expone la `ref` de MessageList. */
export interface MessageListHandle {
  /** Va al final; con `focus`, el foco al último mensaje. */
  scrollToEnd(focus?: boolean): void;
  /** Lleva a un mensaje, lo resalta y le da el foco. `false` si no está cargado. */
  jumpTo(id: string): boolean;
  focus(): void;
  readonly element: HTMLDivElement | null;
}

type Id = { id: string };

export interface MessageListProps extends CoreProps {
  /** Al llegar arriba (o con el botón): pide mensajes anteriores. */
  onLoadOlder?: () => void;
  /** La persona llega al final (marcar como leído). */
  onReachEnd?: () => void;
  onReply?: (detail: Id) => void;
  /** Reacción elegida o pulsada (alterna la propia). */
  onReact?: (detail: Id & { emoji: string }) => void;
  /** «Más reacciones»: la aplicación abre su selector. */
  onReactMore?: (detail: Id) => void;
  onForward?: (detail: Id) => void;
  onCopy?: (detail: Id & { text: string }) => void;
  onEdit?: (detail: Id) => void;
  onDelete?: (detail: Id) => void;
  onRetry?: (detail: Id) => void;
  onOpenMedia?: (detail: Id & { index: number }) => void;
  onOpenThread?: (detail: Id) => void;
  /** Se pulsó una cita: id del mensaje citado (si está cargado, además se salta a él). */
  onQuote?: (detail: Id) => void;
  onVoiceEnded?: (detail: Id) => void;
  /** Escape en la lista. */
  onEscape?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<MessageListHandle>;
}

/**
 * Lista de mensajes de chat: grupos por autor y tiempo, separadores de día, «sin leer», escribiendo, historial hacia
 * arriba sin saltos, ir al final con los nuevos contados y ventana virtual con muchos mensajes. Una sola parada de Tab
 * (↑/↓, Inicio/Fin, RePág/AvPág, Intro a las acciones, R responder). Los mensajes de otros se anuncian cortos y agrupados.
 */
export const MessageList = withRef(function MessageList({
  onLoadOlder,
  onReachEnd,
  onReply,
  onReact,
  onReactMore,
  onForward,
  onCopy,
  onEdit,
  onDelete,
  onRetry,
  onOpenMedia,
  onOpenThread,
  onQuote,
  onVoiceEnded,
  onEscape,
  id,
  className,
  ref,
  ...props
}: MessageListProps) {
  const root = useRef<HTMLDivElement | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: (focus) => messageListApi(root.current)?.scrollToEnd(focus),
      jumpTo: (target) => messageListApi(root.current)?.jumpTo(target) ?? false,
      focus: () => messageListApi(root.current)?.focus(),
      get element() {
        return root.current;
      },
    }),
    [],
  );
  return useWidget(messageListWidget, props, {
    id,
    className,
    ref: root,
    handlers: {
      "load-older": onLoadOlder,
      "reach-end": onReachEnd,
      reply: onReply,
      react: onReact,
      "react-more": onReactMore,
      forward: onForward,
      copy: onCopy,
      edit: onEdit,
      delete: onDelete,
      retry: onRetry,
      "open-media": onOpenMedia,
      "open-thread": onOpenThread,
      quote: onQuote,
      "voice-ended": onVoiceEnded,
      escape: onEscape,
    },
  });
});
