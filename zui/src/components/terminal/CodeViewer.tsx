"use client";
import type { Ref } from "react";
import { codeViewerWidget, type CodeFile, type CodeViewerLabels, type CodeViewerProps as CoreProps } from "../../core/code-viewer-widget";
import { useWidget } from "../agenda/vtree";

export type { CodeFile, CodeViewerLabels };

export interface CodeViewerProps extends CoreProps {
  /** Cambio de pestaña (con `files`). */
  onFileChange?: (detail: { index: number; name: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Visor de código: números de línea, líneas resaltadas, pestañas de archivos, copiar y un resaltado mínimo sin
 * dependencias (JavaScript, TypeScript, JSON, CSS, HTML, shell y Python), o el que dé `highlight`.
 */
export function CodeViewer({ onFileChange, id, className, ref, ...props }: CodeViewerProps) {
  return useWidget(codeViewerWidget, props, { id, className, ref, handlers: { "file-change": onFileChange } });
}
