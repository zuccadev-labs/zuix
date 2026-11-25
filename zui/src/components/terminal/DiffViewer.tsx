"use client";
import type { Ref } from "react";
import { diffViewerWidget, type DiffViewerLabels, type DiffViewerProps as CoreProps } from "../../core/diff-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { DiffViewerLabels };

export interface DiffViewerProps extends CoreProps {
  /** Cambio de vista (unificada o lado a lado). */
  onModeChange?: (detail: { mode: "unified" | "split" }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Diferencias de dos textos o de un parche unificado, en vista unificada o lado a lado, con palabras cambiadas y
 * regiones sin cambios plegadas. Cada línea dice su tipo en texto oculto.
 */
export const DiffViewer = withRef(function DiffViewer({ onModeChange, id, className, ref, ...props }: DiffViewerProps) {
  return useWidget(diffViewerWidget, props, { id, className, ref, handlers: { "mode-change": onModeChange } });
});
