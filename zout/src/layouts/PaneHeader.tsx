import type { ReactNode } from "react";
import { Toolbar } from "@zuccadev-labs/zuix-zui";
import { cx } from "../cx";

export interface PaneHeaderProps {
  title: ReactNode;
  /** Icono o marca antes del título. */
  icon?: ReactNode;
  /** Línea secundaria o migas, bajo el título o a su lado. */
  subtitle?: ReactNode;
  /** Controles de la cabecera (IconButton, Toggle…): van en una Toolbar con una sola parada de tabulación. */
  actions?: ReactNode;
  /** Disparador de menú (un `Menu` de zui) al final de la barra de acciones. */
  menu?: ReactNode;
  /** Nombre accesible de la barra de acciones. */
  actionsLabel?: string;
  /** El panel tiene el foco: el título se resalta. Sin valor, neutro. */
  focused?: boolean;
  /** Id del título, para nombrar el panel con `aria-labelledby`. */
  titleId?: string;
  className?: string;
}

/**
 * Cabecera de un panel de trabajo: icono, título, línea secundaria y una barra de acciones (Toolbar `plain` sm, una
 * sola parada de tabulación) con menú opcional. Va en `Pane.header` o en un `PaneLayout`. Origen: `PaneHeaderButtons`
 * y `PaneMark` de zutool.
 */
export function PaneHeader({
  title,
  icon,
  subtitle,
  actions,
  menu,
  actionsLabel = "Pane actions",
  focused,
  titleId,
  className,
}: PaneHeaderProps) {
  return (
    <div className={cx("z-paneheader", className)} data-focused={focused === undefined ? undefined : String(focused)}>
      {icon ? <span className="z-paneheader__icon">{icon}</span> : null}
      <div className="z-paneheader__titles">
        <span className="z-paneheader__title" id={titleId}>
          {title}
        </span>
        {subtitle ? <span className="z-paneheader__subtitle">{subtitle}</span> : null}
      </div>
      {actions || menu ? (
        <Toolbar label={actionsLabel} variant="plain" size="sm" className="z-paneheader__actions">
          {actions}
          {menu}
        </Toolbar>
      ) : null}
    </div>
  );
}
