import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { PRESENCE_ICON, presenceOf, presenceText, type PresenceLabels, type PresenceStatus } from "../../core/user-presence";
import { cx } from "../../cx";
import { Avatar, type AvatarSize } from "../data/Avatar";

export interface PersonaProps {
  name: string;
  /** Línea secundaria: rol, correo, cargo. */
  secondary?: ReactNode;
  /** Tercera línea (equipo, ubicación), solo en `md` y `lg`. */
  tertiary?: ReactNode;
  avatar?: string;
  presence?: PresenceStatus;
  /** Con `presence` offline o away: «Last seen …». */
  lastSeen?: number | string | Date;
  /** Muestra el texto de la presencia en la línea secundaria. */
  showPresence?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  orientation?: "horizontal" | "vertical";
  /** El nombre es un enlace (al perfil). */
  href?: string;
  /** Contenido al final (una insignia, un botón). */
  trailing?: ReactNode;
  now?: number;
  locale?: string;
  presenceLabels?: Partial<PresenceLabels>;
  className?: string;
  id?: string;
}

const AVATAR: Record<NonNullable<PersonaProps["size"]>, AvatarSize> = { xs: "xs", sm: "sm", md: "md", lg: "lg", xl: "xl" };

/** Persona: avatar, nombre, línea secundaria y presencia (forma y texto). En fila o en columna, cinco tamaños. */
export function Persona({
  name,
  secondary,
  tertiary,
  avatar,
  presence,
  lastSeen,
  showPresence,
  size = "md",
  orientation = "horizontal",
  href,
  trailing,
  now,
  locale,
  presenceLabels,
  className,
  id,
}: PersonaProps) {
  const status = presence ? presenceOf(presence) : null;
  const text = status ? presenceText(status, { lastSeen, now, locale, labels: presenceLabels }) : "";
  const glyph = status ? PRESENCE_ICON[status] : null;
  const big = size === "lg" || size === "xl";
  return (
    <div id={id} className={cx("z-persona", className)} data-size={size} data-orientation={orientation}>
      <span className="z-persona__media">
        <Avatar size={AVATAR[size]} name={name} src={avatar} alt="" />
        {status ? (
          <span className="z-presence" data-status={status} data-size={big ? "lg" : size === "md" ? "md" : "sm"} aria-hidden="true">
            {glyph && size !== "xs" ? <Icon name={glyph as IconName} size={big ? 10 : 8} /> : null}
          </span>
        ) : null}
      </span>
      <span className="z-persona__text">
        {href ? (
          <a className="z-persona__name" href={href}>
            {name}
          </a>
        ) : (
          <span className="z-persona__name">{name}</span>
        )}
        {secondary || (status && showPresence) ? (
          <span className="z-persona__secondary">
            {showPresence && status ? <span className="z-persona__status">{text}</span> : secondary}
            {showPresence && status && secondary ? <span aria-hidden="true"> · </span> : null}
            {showPresence && status && secondary ? secondary : null}
          </span>
        ) : null}
        {status && !showPresence ? <span className="z-sr-only">{text}</span> : null}
        {tertiary && size !== "xs" && size !== "sm" ? <span className="z-persona__tertiary">{tertiary}</span> : null}
      </span>
      {trailing ? <span className="z-persona__trailing">{trailing}</span> : null}
    </div>
  );
}
