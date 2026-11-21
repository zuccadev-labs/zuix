"use client";
import { useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { download, downloadUrl, mimeFromName, type DownloadSource } from "../../core/download";
import { cx } from "../../cx";

export { download, mimeFromName, type DownloadSource };

export interface DownloadTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onError"> {
  /** Contenido: texto, Blob, bytes o una función (también asíncrona) que lo devuelve al pulsar. */
  data?: DownloadSource;
  /** URL que se descarga tal cual (del mismo origen, `blob:` o `data:`), en lugar de `data`. */
  href?: string;
  /** Nombre del archivo. */
  fileName: string;
  /** Tipo MIME; por defecto, el de la extensión del nombre. */
  mimeType?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  /** Icono; `null` sin icono. */
  icon?: IconName | null;
  onDownload?: (blob: Blob | null) => void;
  onError?: (error: unknown) => void;
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}

/**
 * Botón de descarga: genera el archivo al pulsar (también desde una promesa, con estado de carga) y lo descarga con
 * un enlace temporal, sin dejar URLs abiertas.
 */
export function DownloadTrigger({
  data,
  href,
  fileName,
  mimeType,
  variant = "secondary",
  size = "md",
  icon = "arrow-down-tray",
  onDownload,
  onError,
  className,
  onClick,
  disabled,
  ref,
  children,
  ...rest
}: DownloadTriggerProps) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      {...rest}
      ref={ref}
      className={cx("z-btn", `z-btn--${variant}`, "z-download", className)}
      data-size={size}
      data-loading={busy || undefined}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      disabled={disabled}
      onClick={async (event) => {
        onClick?.(event);
        if (event.defaultPrevented || busy) return;
        if (href) {
          downloadUrl(href, fileName);
          onDownload?.(null);
          return;
        }
        if (data === undefined) return;
        setBusy(true);
        try {
          onDownload?.(await download(data, fileName, mimeType ?? mimeFromName(fileName)));
        } catch (error) {
          onError?.(error);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <span className="z-btn__spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
