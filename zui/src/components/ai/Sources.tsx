"use client";
import type { Ref } from "react";
import { sourcesWidget, type SourcesProps as CoreProps } from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export interface SourcesProps extends CoreProps {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Fuentes de una respuesta: lista plegable numerada como sus citas, con título y dominio. */
export const Sources = withRef(function Sources({ id, className, ref, ...props }: SourcesProps) {
  return useWidget(sourcesWidget, props, { id, className, ref });
});
