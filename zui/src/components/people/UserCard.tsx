import type { ReactNode } from "react";
import { presenceOf, type PresenceStatus } from "../../core/user-presence";
import { cx } from "../../cx";
import { Avatar } from "../data/Avatar";
import { PresenceBadge } from "./PresenceBadge";

export interface UserCardUser {
  name: string;
  handle?: string;
  avatar?: string;
  /** Imagen de portada (decorativa). */
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
  /** `cover` con portada y avatar superpuesto; `compact` en fila. */
  variant?: "cover" | "compact";
  /** Nivel del encabezado con el nombre (h3 por defecto). */
  headingLevel?: 2 | 3 | 4;
  /** El nombre enlaza al perfil. */
  href?: string;
  className?: string;
  id?: string;
}

/** Tarjeta de persona: portada, avatar, nombre, usuario, rol, biografía corta, estadísticas y acciones. */
export function UserCard({ user, stats, actions, variant = "cover", headingLevel = 3, href, className, id }: UserCardProps) {
  const H = `h${headingLevel}` as "h3";
  const status = user.presence ? presenceOf(user.presence) : null;
  return (
    <article id={id} className={cx("z-user-card", "z-liquid", className)} data-variant={variant} aria-label={user.name}>
      {variant === "cover" ? (
        <div className="z-user-card__cover" aria-hidden="true">
          {user.cover ? <img className="z-user-card__cover-image" src={user.cover} alt="" /> : null}
        </div>
      ) : null}
      <div className="z-user-card__identity">
        <span className="z-user-card__avatar">
          <Avatar size={variant === "cover" ? "xl" : "lg"} name={user.name} src={user.avatar} alt="" />
          {status ? <PresenceBadge className="z-user-card__presence" status={status} size="lg" /> : null}
        </span>
        <div className="z-user-card__names">
          <H className="z-user-card__name">{href ? <a href={href}>{user.name}</a> : user.name}</H>
          {user.handle ? <span className="z-user-card__handle">@{user.handle.replace(/^@/, "")}</span> : null}
        </div>
        {user.role ? <span className="z-user-card__role">{user.role}</span> : null}
      </div>
      {user.bio ? <p className="z-user-card__bio">{user.bio}</p> : null}
      {stats?.length ? (
        <dl className="z-user-card__stats">
          {stats.map((s) => (
            <div key={s.label} className="z-user-card__stat">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions ? <div className="z-user-card__actions">{actions}</div> : null}
    </article>
  );
}
