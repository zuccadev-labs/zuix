// Lógica pura de ChatLayout, sin React ni DOM: las vistas de la pila en pantallas estrechas (lista → conversación →
// detalles), a cuál vuelve cada una, cuántas columnas caben en un ancho y el panel siguiente con F6. La comparten el
// binding de React (layouts/ChatLayout.tsx) y @zuccadev-labs/zuix-zout/dom.

export type ChatView = "list" | "conversation" | "details";
export const CHAT_VIEWS: readonly ChatView[] = ["list", "conversation", "details"];

/** Anchos del layout (px) a partir de los que caben dos y tres columnas. */
export const CHAT_TWO_COLUMNS = 720;
export const CHAT_THREE_COLUMNS = 1100;

export const isChatView = (v: unknown): v is ChatView => typeof v === "string" && (CHAT_VIEWS as readonly string[]).includes(v);

/** Profundidad de una vista en la pila (lista 0, conversación 1, detalles 2). */
export const viewDepth = (view: ChatView) => CHAT_VIEWS.indexOf(view);

/** Vista a la que vuelve el botón de atrás (o `null` desde la lista). */
export function backView(view: ChatView): ChatView | null {
  return view === "details" ? "conversation" : view === "conversation" ? "list" : null;
}

/** Columnas que caben: 1 (pila), 2 (lista y conversación; detalles encima) o 3. */
export function chatColumns(width: number | null): 1 | 2 | 3 {
  if (width === null) return 3;
  if (width >= CHAT_THREE_COLUMNS) return 3;
  return width >= CHAT_TWO_COLUMNS ? 2 : 1;
}

/** Paneles que se ven con ese número de columnas y esa vista. */
export function visiblePanes(columns: 1 | 2 | 3, view: ChatView, details: boolean): ChatView[] {
  if (columns === 1) return [view === "details" && !details ? "conversation" : view];
  if (columns === 2) return details && view === "details" ? ["list", "conversation", "details"] : ["list", "conversation"];
  return details ? ["list", "conversation", "details"] : ["list", "conversation"];
}

/** Siguiente panel con F6 (anterior con Mayús+F6), dando la vuelta. */
export function nextPane(panes: readonly ChatView[], current: ChatView | null, backwards = false): ChatView | null {
  if (!panes.length) return null;
  const i = current ? panes.indexOf(current) : -1;
  if (i < 0) return panes[backwards ? panes.length - 1 : 0]!;
  return panes[(i + (backwards ? -1 : 1) + panes.length) % panes.length]!;
}

/** Al cambiar de vista con el historial sincronizado: `push` si se baja en la pila, `back` si se sube, nada si igual. */
export function historyStep(from: ChatView, to: ChatView): "push" | "back" | null {
  const d = viewDepth(to) - viewDepth(from);
  return d > 0 ? "push" : d < 0 ? "back" : null;
}

export interface ChatLayoutLabels {
  list: string;
  conversation: string;
  details: string;
  /** Botón flotante del asistente (`variant="widget"`). */
  launcher: string;
  close: string;
}

export const CHAT_LAYOUT_LABELS: ChatLayoutLabels = {
  list: "Chats",
  conversation: "Conversation",
  details: "Details",
  launcher: "Open chat",
  close: "Close chat",
};
