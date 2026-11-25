"use client";
import { useState, type HTMLAttributes } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { initialsOf } from "../../core/initials";
import { safeSrc } from "../../core/linkify";
import { PRESENCE_ICON, PRESENCE_LABELS } from "../../core/user-presence";
import { cx } from "../../cx";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "offline" | "busy" | "away" | "dnd" | "oof";

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
  /** Nombre accesible del indicador de estado; por defecto, el texto del estado en inglés («Do not disturb»). */
  statusLabel?: string;
}

// Hasta dos iniciales (primera y última palabra), sin partir caracteres compuestos.
const initials = (name: string) => initialsOf(name);

/** Imagen de persona o entidad, con iniciales o icono como respaldo. */
export function Avatar({ src, name, alt, size = "md", shape = "circle", status, statusLabel, className, ...rest }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  // La fuente se valida como URL de imagen: un esquema que no es de imagen (`javascript:`) se queda en las iniciales.
  const image = safeSrc(src);
  const showImage = image !== null && failed !== image;
  const label = alt ?? name;
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label solo se emite junto a role="img" (sin imagen); con imagen el nombre lo da su `alt`.
    <span
      {...rest}
      className={cx("z-avatar", className)}
      data-size={size}
      data-shape={shape}
      role={showImage ? undefined : "img"}
      aria-label={showImage ? undefined : label}
      aria-hidden={!showImage && !label ? true : undefined}
    >
      {showImage ? (
        <img
          className="z-avatar__image"
          src={image}
          alt={label ?? ""}
          onError={() => setFailed(image)}
          // Renderizada en servidor, la imagen puede haber fallado antes de hidratar: `error` ya no llegará.
          ref={(node) => {
            if (node?.complete && node.naturalWidth === 0 && node.getAttribute("src")) setFailed(image);
          }}
        />
      ) : name ? (
        <span className="z-avatar__initials" aria-hidden="true">
          {initials(name)}
        </span>
      ) : (
        <Icon name="user" size={ICON_PX[size]} />
      )}
      {status ? (
        <span className="z-avatar__status" data-status={status} role="img" aria-label={statusLabel ?? PRESENCE_LABELS[status] ?? status}>
          {/* La forma dice el estado además del color: marca, reloj, raya, aspa o flecha dentro del punto. */}
          {PRESENCE_ICON[status] && size !== "xs" && size !== "sm" ? (
            <Icon name={PRESENCE_ICON[status] as IconName} size={size === "xl" ? 12 : 8} />
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
