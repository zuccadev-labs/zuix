import type { ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { presenceOf, type PresenceStatus } from "../../core/user-presence";
import { cx } from "../../cx";
import type { CardTone } from "../content/Card";
import { Avatar } from "../data/Avatar";
import { StatGroup } from "../data/StatGroup";
import { PresenceBadge } from "./PresenceBadge";

export interface UserCardUser {
  name: string;
  handle?: string;
  avatar?: string;
  /** Imagen de portada (decorativa). En `portrait` y `neon` es la foto grande (si falta, el avatar). */
  cover?: string;
  role?: string;
  bio?: string;
  presence?: PresenceStatus;
}

export interface UserStat {
  label: string;
  value: ReactNode;
}

export interface UserCardProps {
  user: UserCardUser;
  stats?: readonly UserStat[];
  /** Botones (seguir, mensaje). */
  actions?: ReactNode;
  /**
   * `cover` con portada y avatar superpuesto; `compact` en fila; `profile` limpia y elevada, con foto de esquinas
   * redondeadas, estadísticas en fichas y dos acciones; `neon` de color vivo con halo, ficha de rol con check y nombre
   * en mayúsculas; `portrait` la foto entera con el nombre abajo sobre un desenfoque.
   */
  variant?: "cover" | "compact" | "profile" | "neon" | "portrait";
  /** Color de `neon` (borde, halo, subtítulo) y del brillo. */
  tone?: CardTone;
  /** Ficha de estado arriba («Available»): un Badge o un texto. */
  status?: ReactNode;
  /** Acción de esquina (`portrait`, `compact`): un IconButton. */
  action?: ReactNode;
  /** Nivel del encabezado con el nombre (h3 por defecto). */
  headingLevel?: 2 | 3 | 4;
  /** El nombre enlaza al perfil (en `portrait` y `neon`, la tarjeta entera). */
  href?: string;
  className?: string;
  id?: string;
}

/** Tarjeta de persona: portada o foto, avatar, nombre, usuario, rol, biografía corta, estadísticas y acciones. */
export function UserCard({
  user,
  stats,
  actions,
  variant = "cover",
  tone,
  status,
  action,
  headingLevel = 3,
  href,
  className,
  id,
}: UserCardProps) {
  const H = `h${headingLevel}` as "h3";
  const presence = user.presence ? presenceOf(user.presence) : null;
  const photo = user.cover ?? user.avatar;
  const media = variant === "portrait" || variant === "neon";
  const name = href ? (
    <a className={media ? "z-card__link" : undefined} href={href}>
      {user.name}
    </a>
  ) : (
    user.name
  );
  const statList = stats?.length ? (
    <StatGroup
      className="z-user-card__stats"
      itemClassName="z-user-card__stat"
      variant={variant === "profile" ? "tiles" : "plain"}
      align={variant === "profile" ? "center" : "start"}
      items={stats}
    />
  ) : null;
  if (media)
    return (
      <article
        id={id}
        className={cx("z-user-card", className)}
        data-variant={variant}
        data-tone={tone === undefined ? undefined : String(tone)}
        aria-label={user.name}
      >
        <div className="z-user-card__photo" aria-hidden="true">
          {photo ? <img src={photo} alt="" /> : <Avatar size="xl" name={user.name} alt="" />}
        </div>
        {status || (variant === "neon" && user.role) ? (
          <div className="z-user-card__status">
            {variant === "neon" && user.role ? (
              <span className="z-user-card__role">
                <Icon name="check-badge" size={14} />
                {user.role}
              </span>
            ) : (
              status
            )}
          </div>
        ) : null}
        <div className="z-user-card__overlay">
          <div className="z-user-card__names">
            <H className="z-user-card__name">{name}</H>
            {variant === "neon" ? (
              user.bio ? <span className="z-user-card__tagline">{user.bio}</span> : null
            ) : user.role ? (
              <span className="z-user-card__tagline">{user.role}</span>
            ) : null}
          </div>
          {action ? <span className="z-user-card__action">{action}</span> : null}
        </div>
      </article>
    );
  return (
    <article
      id={id}
      className={cx("z-user-card", variant !== "profile" && "z-liquid", className)}
      data-variant={variant}
      data-tone={tone === undefined ? undefined : String(tone)}
      aria-label={user.name}
    >
      {variant === "cover" ? (
        <div className="z-user-card__cover" aria-hidden="true">
          {user.cover ? <img className="z-user-card__cover-image" src={user.cover} alt="" /> : null}
        </div>
      ) : null}
      <div className="z-user-card__identity">
        {variant === "profile" && user.avatar ? (
          <img className="z-user-card__portrait" src={user.avatar} alt="" />
        ) : (
          <span className="z-user-card__avatar">
            <Avatar size={variant === "compact" ? "lg" : "xl"} name={user.name} src={user.avatar} alt="" />
            {presence ? <PresenceBadge className="z-user-card__presence" status={presence} size="lg" /> : null}
          </span>
        )}
        <div className="z-user-card__names">
          <H className="z-user-card__name">{name}</H>
          {user.handle ? <span className="z-user-card__handle">@{user.handle.replace(/^@/, "")}</span> : null}
          {variant === "profile" && user.role ? <span className="z-user-card__tagline">{user.role}</span> : null}
        </div>
        {variant !== "profile" && user.role ? <span className="z-user-card__role">{user.role}</span> : null}
        {status && variant !== "profile" ? <span className="z-user-card__status">{status}</span> : null}
        {action ? <span className="z-user-card__action">{action}</span> : null}
      </div>
      {user.bio ? <p className="z-user-card__bio">{user.bio}</p> : null}
      {statList}
      {actions ? <div className="z-user-card__actions">{actions}</div> : null}
    </article>
  );
}
