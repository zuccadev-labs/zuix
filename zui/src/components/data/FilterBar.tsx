"use client";
import type { Ref } from "react";
import {
  FILTER_BAR_LABELS,
  filterBarWidget,
  type FilterBarLabels,
  type FilterBarProps as CoreProps,
  type FilterDef,
  type FilterOption,
  type FilterValue,
} from "../../core/filter-bar-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export { FILTER_BAR_LABELS };
export type { FilterBarLabels, FilterDef, FilterOption, FilterValue };

export interface FilterBarProps extends CoreProps {
  /** Cambió un filtro (`id`) o se limpiaron todos (`id` vacío). Con `value`, actualízalo aquí. */
  onChange?: (detail: { value: FilterValue; id: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Barra de filtros: chips de interruptor y de menú en una fila que desplaza con el borde difuminado, «Clear» cuando
 * hay alguno activo y el número de activos para lectores.
 */
export const FilterBar = withRef(function FilterBar({ onChange, id, className, ref, ...props }: FilterBarProps) {
  return useWidget(filterBarWidget, props, {
    id,
    className,
    ref,
    handlers: { change: onChange } as Record<string, ((detail: never) => void) | undefined>,
  });
});
