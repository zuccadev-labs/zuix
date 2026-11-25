"use client";
import type { Ref } from "react";
import type { KanbanCard, KanbanColumn, KanbanLabel, KanbanLabels, KanbanPerson } from "../../core/kanban";
import { kanbanWidget, type KanbanBoardProps as CoreProps } from "../../core/kanban-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { KanbanCard, KanbanColumn, KanbanLabel, KanbanLabels, KanbanPerson };

export interface KanbanMove {
  cardId: string;
  fromColumn: string;
  toColumn: string;
  /** Posición en la columna de destino, desde 0. */
  index: number;
  /** Columnas con la tarjeta ya movida: guárdalas tal cual. */
  columns: KanbanColumn[];
}

export interface KanbanBoardProps extends CoreProps {
  /** Tras soltar una tarjeta en otro sitio (puntero o teclado). */
  onMove?: (move: KanbanMove) => void;
  /** Intro sobre una tarjeta. */
  onOpen?: (detail: { cardId: string }) => void;
  /** Botón «añadir» de una columna (con `addable`). */
  onAdd?: (detail: { columnId: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Tablero kanban: columnas con contador (y límite de trabajo en curso) y tarjetas que se arrastran entre columnas con
 * el puntero o se mueven con el teclado (Espacio coge, flechas mueven, Intro suelta, Escape cancela). Cada paso se
 * anuncia con la columna y la posición.
 */
export const KanbanBoard = withRef(function KanbanBoard({ onMove, onOpen, onAdd, id, className, ref, ...props }: KanbanBoardProps) {
  return useWidget(kanbanWidget, props, { id, className, ref, handlers: { move: onMove, open: onOpen, add: onAdd } });
});
