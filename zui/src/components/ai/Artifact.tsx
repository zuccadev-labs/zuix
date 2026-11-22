"use client";
import type { Ref } from "react";
import { artifactWidget, type ArtifactLabels, type ArtifactProps as CoreProps, type ArtifactVersion } from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";

export type { ArtifactLabels, ArtifactVersion };

export interface ArtifactProps extends CoreProps {
  onVersionChange?: (detail: { index: number }) => void;
  onDownload?: (detail: { name: string; code: string }) => void;
  onClose?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Artefacto: vista previa aislada (HTML sin scripts o Markdown) y código, versiones, copiar y descargar. */
export function Artifact({ onVersionChange, onDownload, onClose, id, className, ref, ...props }: ArtifactProps) {
  return useWidget(artifactWidget, props, {
    id,
    className,
    ref,
    handlers: { "version-change": onVersionChange, download: onDownload, close: onClose },
  });
}
