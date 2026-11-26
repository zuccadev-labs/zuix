// Tablero kanban: mover una tarjeta entre columnas y posiciones, destino de una tecla con la tarjeta cogida, la
// tarjeta vecina al navegar sin cogerla y el texto de los anuncios. Sin documento: listas de entrada, listas nuevas
// de salida (no se muta nada).
import { format } from "./locale";

export interface KanbanLabel {
  text: string;
  tone?: "accent" | "success" | "warning" | "danger" | "info" | "neutral";
}

export interface KanbanPerson {
  name: string;
  avatar?: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  labels?: readonly KanbanLabel[];
  assignees?: readonly KanbanPerson[];
  /** Texto de la fecha («Nov 28»); con `dueISO` va en `<time>`. */
  due?: string;
  dueISO?: string;
  /** Prioridad, dicha con texto e icono. */
  priority?: "low" | "medium" | "high" | "urgent";
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: readonly KanbanCard[];
  /** Límite de trabajo en curso: la cabecera lo muestra y avisa al pasarse. */
  limit?: number;
  tone?: KanbanLabel["tone"];
}

export interface CardPlace {
  column: number;
  index: number;
}

/** Columna e índice de una tarjeta, o `null`. */
export function locateCard(columns: readonly KanbanColumn[], cardId: string): CardPlace | null {
  for (let c = 0; c < columns.length; c++) {
    const index = columns[c]!.cards.findIndex((card) => card.id === cardId);
    if (index >= 0) return { column: c, index };
  }
  return null;
}

/**
 * Mueve una tarjeta a la columna `to` en la posición `index` de la lista final (acotada). Sin la tarjeta o la
 * columna, devuelve las mismas columnas.
 */
export function moveCard(columns: readonly KanbanColumn[], cardId: string, to: number, index: number): KanbanColumn[] {
  const from = locateCard(columns, cardId);
  if (!from || to < 0 || to >= columns.length) return [...columns];
  const card = columns[from.column]!.cards[from.index]!;
  const without = columns.map((col, c) => (c === from.column ? { ...col, cards: col.cards.filter((x) => x.id !== cardId) } : col));
  const target = without[to]!;
  const at = Math.max(0, Math.min(target.cards.length, Math.round(index)));
  const cards = [...target.cards];
  cards.splice(at, 0, card);
  return without.map((col, c) => (c === to ? { ...col, cards } : col));
}

/**
 * Destino de una flecha con la tarjeta cogida: arriba y abajo dentro de la columna; izquierda y derecha a la columna
 * vecina en la misma altura (acotada). En RTL las flechas horizontales se invierten. `null` si no hay a dónde ir.
 */
export function keyTarget(columns: readonly KanbanColumn[], cardId: string, key: string, rtl = false): CardPlace | null {
  const at = locateCard(columns, cardId);
  if (!at) return null;
  const len = columns[at.column]!.cards.length;
  if (key === "ArrowUp") return at.index > 0 ? { column: at.column, index: at.index - 1 } : null;
  if (key === "ArrowDown") return at.index < len - 1 ? { column: at.column, index: at.index + 1 } : null;
  if (key === "Home") return at.index > 0 ? { column: at.column, index: 0 } : null;
  if (key === "End") return at.index < len - 1 ? { column: at.column, index: len - 1 } : null;
  const step = key === "ArrowRight" ? (rtl ? -1 : 1) : key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
  if (!step) return null;
  const column = at.column + step;
  if (column < 0 || column >= columns.length) return null;
  return { column, index: Math.min(at.index, columns[column]!.cards.length) };
}

/** Tarjeta a la que va el foco con una flecha sin cogerla (las columnas vacías se saltan), o `null`. */
export function neighborCard(columns: readonly KanbanColumn[], cardId: string, key: string, rtl = false): string | null {
  const at = locateCard(columns, cardId);
  if (!at) return null;
  const col = columns[at.column]!;
  if (key === "ArrowUp") return col.cards[at.index - 1]?.id ?? null;
  if (key === "ArrowDown") return col.cards[at.index + 1]?.id ?? null;
  if (key === "Home") return col.cards[0]?.id ?? null;
  if (key === "End") return col.cards[col.cards.length - 1]?.id ?? null;
  const step = key === "ArrowRight" ? (rtl ? -1 : 1) : key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
  if (!step) return null;
  for (let c = at.column + step; c >= 0 && c < columns.length; c += step) {
    const cards = columns[c]!.cards;
    if (cards.length) return cards[Math.min(at.index, cards.length - 1)]!.id;
  }
  return null;
}

/** Índice de inserción en una lista según la coordenada del puntero y los centros de las tarjetas (sin la arrastrada). */
export function dropIndexAt(pointer: number, centers: readonly number[]): number {
  const i = centers.findIndex((c) => pointer < c);
  return i < 0 ? centers.length : i;
}

export interface KanbanLabels {
  /** «{card} moved to {column}, position {position} of {total}» */
  moved: string;
  /** «{card} grabbed in {column}, position {position} of {total}. Arrows move it, Enter or Space drops, Escape cancels.» */
  grabbed: string;
  /** «{card} returned to {column}, position {position}» */
  cancelled: string;
  /** Descripción de cada tarjeta para el lector. */
  instructions: string;
  /** «{count} cards» */
  count: string;
  /** «{count} of {limit}» con límite. */
  countLimit: string;
  /** Aviso con el límite superado. */
  overLimit: string;
  /** «Add card to {column}» */
  add: string;
  /** Columna vacía. */
  empty: string;
  /** Prioridades. */
  low: string;
  medium: string;
  high: string;
  urgent: string;
  /** «Due {date}» */
  due: string;
  /** «Assigned to {names}» */
  assigned: string;
}

export const KANBAN_LABELS: KanbanLabels = {
  moved: "{card} moved to {column}, position {position} of {total}",
  grabbed: "{card} grabbed in {column}, position {position} of {total}. Arrows move it, Enter or Space drops it, Escape cancels.",
  cancelled: "{card} returned to {column}, position {position}",
  instructions: "Press Space to pick up and move with the arrow keys; Enter opens the card.",
  count: "{count} cards",
  countLimit: "{count} of {limit}",
  overLimit: "Over the limit",
  add: "Add card to {column}",
  empty: "Drop cards here",
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
  urgent: "Urgent",
  due: "Due {date}",
  assigned: "Assigned to {names}",
};

const put = (t: string, v: Record<string, string | number>) => format(t, v, { missing: () => "" });

/** Frase de posición de una tarjeta en su columna, con la plantilla dada. */
export function placeText(columns: readonly KanbanColumn[], cardId: string, template: string): string {
  const at = locateCard(columns, cardId);
  if (!at) return "";
  const col = columns[at.column]!;
  return put(template, { card: col.cards[at.index]!.title, column: col.title, position: at.index + 1, total: col.cards.length });
}
