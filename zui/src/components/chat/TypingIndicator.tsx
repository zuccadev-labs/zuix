import type { ChatPerson } from "../../core/chat-group";
import { CHAT_LABELS, typingNode } from "../../core/chat-tree";
import type { TypingLabels } from "../../core/chat-group";
import { staticNode } from "./static";

export interface TypingIndicatorProps {
  /** Quiénes escriben. Sin nadie no se pinta nada. */
  people: readonly ChatPerson[];
  /** Avatares delante (en grupos). */
  avatars?: boolean;
  labels?: Partial<TypingLabels>;
  className?: string;
}

/** «Ana está escribiendo…» con tres puntos en una burbuja; con varios, «Ana y 2 más». */
export function TypingIndicator({ people, avatars, labels, className }: TypingIndicatorProps) {
  const node = typingNode(
    people.map((p) => p.name),
    { ...CHAT_LABELS, ...labels },
    { people: avatars ? people : undefined },
  );
  return node ? staticNode(node, { className }) : null;
}
