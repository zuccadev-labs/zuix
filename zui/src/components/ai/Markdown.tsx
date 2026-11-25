"use client";
import type { Ref } from "react";
import { markdownWidget, type MarkdownProps as CoreProps } from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export interface MarkdownProps extends CoreProps {
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Markdown mínimo propio (párrafos, encabezados, listas, citas, código con el CodeViewer, tablas, énfasis, enlaces
 * http(s) y citas `[n]`), construido como nodos: nunca marcado. Con `streaming`, cierra lo abierto y pinta el cursor.
 */
export const Markdown = withRef(function Markdown({ id, className, ref, ...props }: MarkdownProps) {
  return useWidget(markdownWidget, props, { id, className, ref });
});
