"use client";
import { useState, type HTMLAttributes } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "offline" | "busy" | "away";

const ICON_PX: Record<AvatarSize, number> = { xs: 12, sm: 14, md: 18, lg: 24, xl: 32 };

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  /** Nombre de la persona: genera las iniciales y el nombre accesible. */
  name?: string;
  /** Texto alternativo; por defecto `name`. */
  alt?: string;
  size?: AvatarSize;
  shape?: "circle" | "rounded";
  status?: AvatarStatus;
  /** Nombre accesible del indicador de estado; por defecto el propio estado. */
  statusLabel?: string;
}

// Hasta dos iniciales: primera y última palabra.
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Imagen de persona o entidad, con iniciales o icono como respaldo. */
export function Avatar({ src, name, alt, size = "md", shape = "circle", status, statusLabel, className, ...rest }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = Boolean(src) && failed !== src;
  const label = alt ?? name;
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label solo se emite junto a role="img" (sin imagen); con imagen el nombre lo da su `alt`.
    <span {...rest} className={cx("z-avatar", className)} data-size={size} data-shape={shape} role={showImage ? undefined : "img"} aria-label={showImage ? undefined : label} aria-hidden={!showImage && !label ? true : undefined}>
      {showImage ? (
        <img
          className="z-avatar__image"
          src={src}
          alt={label ?? ""}
          onError={() => setFailed(src ?? null)}
          // Renderizada en servidor, la imagen puede haber fallado antes de hidratar: `error` ya no llegará.
          ref={(node) => {
            if (node?.complete && node.naturalWidth === 0 && node.getAttribute("src")) setFailed(src ?? null);
          }}
        />
      ) : name ? (
        <span className="z-avatar__initials" aria-hidden="true">
          {initials(name)}
        </span>
      ) : (
        <Icon name="user" size={ICON_PX[size]} />
      )}
      {status ? <span className="z-avatar__status" data-status={status} role="img" aria-label={statusLabel ?? status} /> : null}
    </span>
  );
}
