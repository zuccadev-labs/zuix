"use client";
import type { Ref } from "react";
import { topProgressWidget, type ProgressController, type TopProgressLabels, type TopProgressProps as CoreProps } from "../../core/top-progress";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { ProgressController, TopProgressLabels };

export interface TopProgressProps extends CoreProps {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Barra de carga fija arriba de la ventana: con valor (0–100), indeterminada (`active`) o siguiendo el controlador
 * imperativo `topProgress` (`start()`, `set()`, `inc()`, `done()`, al estilo de NProgress). Anuncia el principio y el final.
 */
export const TopProgress = withRef(function TopProgress({ id, className, ref, ...props }: TopProgressProps) {
  return useWidget(topProgressWidget, props, { id, className, ref });
});
