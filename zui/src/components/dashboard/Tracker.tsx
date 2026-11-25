"use client";
import type { Ref } from "react";
import { trackerWidget, type TrackerDay, type TrackerLabels, type TrackerProps as CoreProps, type TrackerStatus } from "../../core/tracker";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { TrackerDay, TrackerLabels, TrackerStatus };

export interface TrackerProps extends CoreProps {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Tira de estados por día (disponibilidad, ejecuciones): una sola parada de tabulación, flechas entre días y una
 * etiqueta con el día activo al pasar el puntero o con el foco. Cada día se lee como texto, no por su color.
 */
export const Tracker = withRef(function Tracker({ id, className, ref, ...props }: TrackerProps) {
  return useWidget(trackerWidget, props, { id, className, ref });
});
