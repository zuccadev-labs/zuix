"use client";
import type { Ref } from "react";
import {
  categoryBarWidget,
  type CategoryBarLabels,
  type CategoryBarMarker,
  type CategoryBarProps as CoreProps,
} from "../../core/category-bar";
import { withRef } from "../../react-compat";
import { useWidget } from "../agenda/vtree";

export type { CategoryBarLabels, CategoryBarMarker };

export interface CategoryBarProps extends CoreProps {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Barra partida en tramos por categoría, con marcador opcional, rótulos acumulados y leyenda. */
export const CategoryBar = withRef(function CategoryBar({ id, className, ref, ...props }: CategoryBarProps) {
  return useWidget(categoryBarWidget, props, { id, className, ref });
});
