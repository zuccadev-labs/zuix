"use client";
import type { Ref } from "react";
import type { CalendarEvent } from "../../core/agenda";
import type { TimelineScale, TimelineTask } from "../../core/timeline";
import type { TimelineLabels } from "../../core/timeline-view";
import { timelineWidget, type Resource, type TimelineViewProps as CoreProps } from "../../core/timeline-widget";
import type { SlotSelection } from "../../core/agenda-control";
import { useWidget } from "./vtree";

export type { Resource, TimelineLabels, TimelineScale, TimelineTask };
export type { TimelineGroup } from "../../core/timeline";

export interface TimelineViewProps extends CoreProps {
  onScaleChange?: (detail: { scale: TimelineScale }) => void;
  onGroupToggle?: (detail: { groupId: string; collapsed: boolean }) => void;
  onTaskClick?: (detail: { task: TimelineTask }) => void;
  /** Mover o cambiar la duración de una tarea (puntero o teclado). La línea temporal no cambia las tareas. */
  onTaskChange?: (detail: { task: TimelineTask; start: string; end: string; kind: "move" | "resize" }) => void;
  onEventClick?: (detail: { event: CalendarEvent; occurrence: string; resourceId?: string }) => void;
  onEventChange?: (detail: {
    event: CalendarEvent;
    occurrence: string;
    seriesId?: string;
    start: string;
    end: string;
    kind: "move";
  }) => void;
  onSelectSlot?: (detail: SlotSelection & { resourceId: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Línea temporal: Gantt (`mode="tasks"`: fases plegables, barras con progreso, hitos, dependencias fin → inicio,
 * camino crítico, línea de hoy y zoom día/semana/mes) o recursos (`mode="resources"`: salas o personas por hora,
 * conflictos con trama y texto, crear arrastrando, ventana virtual de filas). Treegrid/grid con una parada de Tab.
 */
export function TimelineView({
  onScaleChange,
  onGroupToggle,
  onTaskClick,
  onTaskChange,
  onEventClick,
  onEventChange,
  onSelectSlot,
  id,
  className,
  ref,
  ...props
}: TimelineViewProps) {
  return useWidget(timelineWidget, props, {
    id,
    className,
    ref,
    handlers: {
      "scale-change": onScaleChange,
      "group-toggle": onGroupToggle,
      "task-click": onTaskClick,
      "task-change": onTaskChange,
      "event-click": onEventClick,
      "event-change": onEventChange,
      "select-slot": onSelectSlot,
    },
  });
}
