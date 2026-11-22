import type { ChatMessage } from "../../core/chat-group";
import { bubbleRow, CHAT_LABELS, type ChatLabels, type MessageAction } from "../../core/chat-tree";
import { staticNode } from "./static";

export interface MessageBubbleProps {
  message: ChatMessage;
  /** Mensaje propio: a la derecha, con estado de entrega. */
  mine?: boolean;
  /** Posición en su grupo: decide la cola. */
  position?: "single" | "first" | "middle" | "last";
  showAuthor?: boolean;
  /** Avatar del autor (en grupos). */
  showAvatar?: boolean;
  group?: boolean;
  /** Barra de acciones (la atiende MessageList; aquí, solo el marcado). Por defecto ninguna. */
  actions?: readonly MessageAction[];
  locale?: string;
  timeZone?: string;
  hourCycle?: "h12" | "h23";
  now?: number;
  labels?: Partial<ChatLabels>;
  id?: string;
  className?: string;
}

/**
 * Burbuja de mensaje con su cola, autor, cita, adjuntos (imágenes, archivo, nota de voz, ubicación, enlace), texto con
 * enlaces seguros y menciones, hora, «editado» y entrega. Solo marcado: la interacción la da MessageList.
 */
export function MessageBubble({
  message,
  mine = false,
  position = "single",
  showAuthor = false,
  showAvatar,
  group,
  actions = [],
  locale,
  timeZone,
  hourCycle,
  now,
  labels,
  id,
  className,
}: MessageBubbleProps) {
  const node = bubbleRow(
    { message, mine, position, showAuthor, showAvatar, group },
    { labels: { ...CHAT_LABELS, ...labels }, uid: id ?? "bubble", locale, timeZone, hourCycle, now, actions },
    "div",
  );
  return staticNode(node, { className, id });
}
