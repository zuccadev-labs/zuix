import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { presenceOf, type PresenceStatus } from "../../core/user-presence";
import { cx } from "../../cx";
import { Avatar } from "../data/Avatar";
import { PresenceBadge } from "./PresenceBadge";
import type { UserStat } from "./UserCard";

export interface ProfileMeta {
  icon: IconName;
  label: string;
  href?: string;
}

export interface ProfileHeaderUser {
  name: string;
  handle?: string;
  avatar?: string;
  cover?: string;
  /** Descripción de la portada si no es decorativa. */
  coverAlt?: string;
  role?: string;
  bio?: string;
  presence?: PresenceStatus;
}

export interface ProfileHeaderProps {
  user: ProfileHeaderUser;
  stats?: readonly UserStat[];
  /** Acciones principales (seguir, mensaje, editar). */
  actions?: ReactNode;
  /** Insignias junto al nombre (Badge). */
  badges?: ReactNode;
  meta?: readonly ProfileMeta[];
  /** Pestañas bajo la cabecera (Tabs o TabStrip). */
  tabs?: ReactNode;
  /** Botón sobre la portada («Change cover»), para editar. */
  coverAction?: ReactNode;
  /** Botón sobre el avatar («Change photo»), para editar. */
  avatarAction?: ReactNode;
  /** Nivel del encabezado con el nombre: 1 en la página del perfil (por defecto). */
  headingLevel?: 1 | 2 | 3;
  className?: string;
  id?: string;
}

/**
 * Cabecera de perfil: portada a sangre, avatar superpuesto con anillo de cristal, nombre (h1), insignias, usuario,
 * biografía, metadatos (ubicación, web, alta), estadísticas como pares, acciones y pestañas.
 */
export function ProfileHeader({
  user,
  stats,
  actions,
  badges,
  meta,
  tabs,
  coverAction,
  avatarAction,
  headingLevel = 1,
  className,
  id,
}: ProfileHeaderProps) {
  const H = `h${headingLevel}` as "h1";
  const status = user.presence ? presenceOf(user.presence) : null;
  return (
    <header id={id} className={cx("z-profile-header", className)}>
      <div className="z-profile-header__cover">
        {user.cover ? <img className="z-profile-header__cover-image" src={user.cover} alt={user.coverAlt ?? ""} /> : null}
        {coverAction ? <div className="z-profile-header__cover-action">{coverAction}</div> : null}
      </div>
      <div className="z-profile-header__main z-liquid">
        <div className="z-profile-header__top">
          <span className="z-profile-header__avatar">
            <Avatar size="xl" name={user.name} src={user.avatar} alt="" />
            {status ? <PresenceBadge className="z-profile-header__presence" status={status} size="lg" /> : null}
            {avatarAction ? <span className="z-profile-header__avatar-action">{avatarAction}</span> : null}
          </span>
          {actions ? <div className="z-profile-header__actions">{actions}</div> : null}
        </div>
        <div className="z-profile-header__identity">
          <div className="z-profile-header__title">
            <H className="z-profile-header__name">{user.name}</H>
            {badges ? <span className="z-profile-header__badges">{badges}</span> : null}
          </div>
          <p className="z-profile-header__subtitle">
            {user.handle ? <span className="z-profile-header__handle">@{user.handle.replace(/^@/, "")}</span> : null}
            {user.handle && user.role ? <span aria-hidden="true"> · </span> : null}
            {user.role ? <span className="z-profile-header__role">{user.role}</span> : null}
          </p>
          {user.bio ? <p className="z-profile-header__bio">{user.bio}</p> : null}
        </div>
        {meta?.length ? (
          <ul className="z-profile-header__meta">
            {meta.map((m) => (
              <li key={m.label} className="z-profile-header__meta-item">
                <Icon name={m.icon} size={14} />
                {m.href ? <a href={m.href}>{m.label}</a> : <span>{m.label}</span>}
              </li>
            ))}
          </ul>
        ) : null}
        {stats?.length ? (
          <dl className="z-profile-header__stats">
            {stats.map((s) => (
              <div key={s.label} className="z-profile-header__stat">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {tabs ? <div className="z-profile-header__tabs">{tabs}</div> : null}
      </div>
    </header>
  );
}
