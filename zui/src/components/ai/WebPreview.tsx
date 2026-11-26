"use client";
import type { Ref } from "react";
import { webPreviewWidget, type WebPreviewLabels, type WebPreviewProps as CoreProps, type WebPreviewViewport } from "../../core/web-preview-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { WebPreviewLabels, WebPreviewViewport };

export interface WebPreviewProps extends CoreProps {
  /** Dirección nueva desde la barra, atrás o adelante. Con `url`, la aplicación decide si la sigue. */
  onUrlChange?: (url: string) => void;
  onViewportChange?: (viewport: WebPreviewViewport) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Vista previa de una dirección en un iframe aislado (`sandbox`), con barra de dirección, atrás, adelante, recargar,
 * abrir en otra pestaña y anchos de dispositivo. Solo http y https; compatible con una CSP estricta.
 */
export const WebPreview = withRef(function WebPreview({ onUrlChange, onViewportChange, id, className, ref, ...props }: WebPreviewProps) {
  return useWidget(webPreviewWidget, props, {
    id,
    className,
    ref,
    handlers: {
      "url-change": onUrlChange ? (detail: { url: string }) => onUrlChange(detail.url) : undefined,
      "viewport-change": onViewportChange ? (detail: { viewport: WebPreviewViewport }) => onViewportChange(detail.viewport) : undefined,
    },
  });
});
