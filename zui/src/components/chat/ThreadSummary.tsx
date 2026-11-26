import { localize } from "../../core/locale";
import type { MouseEventHandler } from "react";
import type { ChatPerson } from "../../core/chat-group";
import { CHAT_LABELS, threadNode, type ChatLabels } from "../../core/chat-tree";
import { staticNode } from "./static";

export interface ThreadSummaryProps {
  count: number;
  lastAt?: number | string;
  participants?: readonly ChatPerson[];
  now?: number;
  locale?: string;
  labels?: Partial<Pick<ChatLabels, "replies" | "lastReply">>;
  /** Abre el hilo. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

/** «12 replies · Last reply 3 min ago» con avatares: botón que abre el hilo en un panel. */
export function ThreadSummary({ count, lastAt, participants, now, locale, labels, onClick, className }: ThreadSummaryProps) {
  return staticNode(
    threadNode(
      { count, lastAt, participants },
      { ...localize("chat", CHAT_LABELS), ...labels },
      { now: now ?? (lastAt !== undefined ? Date.now() : undefined), locale },
    ),
    { className, onClick },
  );
}
