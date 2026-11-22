import type { ReactNode } from "react";
import { cx } from "../cx";

export interface ProfileLayoutProps {
  /** ProfileHeader. */
  header: ReactNode;
  /** Pestañas bajo la cabecera, si no van dentro de ella. */
  tabs?: ReactNode;
  /** Columna lateral (UserCard, miembros, actividad); en estrecho baja bajo el contenido. */
  aside?: ReactNode;
  asideLabel?: string;
  /** Contenido de la pestaña activa. */
  children: ReactNode;
  className?: string;
}

/** Página de perfil: cabecera (ProfileHeader), pestañas, contenido y columna lateral que baja en estrecho. */
export function ProfileLayout({ header, tabs, aside, asideLabel = "About", children, className }: ProfileLayoutProps) {
  return (
    <div className={cx("z-profile-layout", className)} data-aside={aside ? "" : undefined}>
      <div className="z-profile-layout__header">{header}</div>
      {tabs ? <div className="z-profile-layout__tabs">{tabs}</div> : null}
      <div className="z-profile-layout__body">
        <div className="z-profile-layout__content">{children}</div>
        {aside ? (
          <aside className="z-profile-layout__aside" aria-label={asideLabel}>
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
