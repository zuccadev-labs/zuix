import { Children, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../cx";
import type { PresenceStatus } from "../../core/user-presence";
import { Popover } from "../overlay/Popover";
import { Persona } from "../people/Persona";
import { Avatar, type AvatarSize } from "./Avatar";

export interface AvatarGroupPerson {
  name: string;
  src?: string;
  /** Línea secundaria en la lista de sobrantes (rol, correo). */
  secondary?: string;
  status?: PresenceStatus;
}

export interface AvatarGroupProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Máximo de avatares visibles; el resto se resume en "+N". */
  max?: number;
  /** Total real si hay más elementos que hijos renderizados. */
  total?: number;
  size?: AvatarSize;
  /** Nombre accesible del contador de sobrantes. */
  overflowLabel?: (hidden: number) => string;
  /**
   * Personas como datos: el grupo es una lista (`ul`) y, con `overflow="list"`, el «+N» es un botón que abre la
   * lista de las que no se ven.
   */
  items?: readonly AvatarGroupPerson[];
  /** `count` (por defecto) solo cuenta; `list` abre la lista de sobrantes (con `items`). */
  overflow?: "count" | "list";
  /** Título de la lista de sobrantes. */
  overflowTitle?: (hidden: number) => string;
  /** Apilado inverso: el primero queda encima. */
  reverse?: boolean;
  /** Solape entre avatares. */
  spacing?: "tight" | "normal" | "loose";
  children?: ReactNode;
}

/** Avatares solapados con contador de sobrantes; con `items` y `overflow="list"`, el contador abre la lista. */
export function AvatarGroup({
  max = 4,
  total,
  size = "md",
  overflowLabel = (hidden) => `${hidden} more`,
  items,
  overflow = "count",
  overflowTitle = (hidden) => `${hidden} more people`,
  reverse,
  spacing,
  className,
  children,
  ...rest
}: AvatarGroupProps) {
  if (items) {
    const visible = items.slice(0, max);
    const rest_ = items.slice(max);
    const hidden = (total ?? items.length) - visible.length;
    return (
      <ul
        {...(rest as HTMLAttributes<HTMLUListElement>)}
        className={cx("z-avatar-group", className)}
        data-size={size}
        data-reverse={reverse ? "" : undefined}
        data-spacing={spacing}
      >
        {visible.map((p) => (
          <li key={p.name} className="z-avatar-group__item">
            <Avatar size={size} name={p.name} src={p.src} status={p.status} />
          </li>
        ))}
        {hidden > 0 ? (
          <li className="z-avatar-group__item">
            {overflow === "list" && rest_.length ? (
              <Popover
                label={overflowTitle(hidden)}
                side="bottom"
                align="start"
                className="z-avatar-group__popover"
                trigger={
                  <button type="button" className="z-avatar z-avatar--overflow z-avatar-group__more" data-size={size} data-shape="circle">
                    <span className="z-sr-only">{overflowLabel(hidden)}</span>
                    <span className="z-avatar__initials" aria-hidden="true">
                      +{hidden}
                    </span>
                  </button>
                }
              >
                <p className="z-avatar-group__title">{overflowTitle(hidden)}</p>
                <ul className="z-avatar-group__list">
                  {rest_.map((p) => (
                    <li key={p.name}>
                      <Persona size="sm" name={p.name} avatar={p.src} secondary={p.secondary} presence={p.status} />
                    </li>
                  ))}
                </ul>
              </Popover>
            ) : (
              <span
                className="z-avatar z-avatar--overflow"
                data-size={size}
                data-shape="circle"
                role="img"
                aria-label={overflowLabel(hidden)}
              >
                <span className="z-avatar__initials" aria-hidden="true">
                  +{hidden}
                </span>
              </span>
            )}
          </li>
        ) : null}
      </ul>
    );
  }
  const list = Children.toArray(children);
  const visible = list.slice(0, max);
  const hidden = (total ?? list.length) - visible.length;
  return (
    <div
      {...(rest as HTMLAttributes<HTMLDivElement>)}
      role="group"
      className={cx("z-avatar-group", className)}
      data-size={size}
      data-reverse={reverse ? "" : undefined}
      data-spacing={spacing}
    >
      {visible}
      {hidden > 0 ? (
        <span className="z-avatar z-avatar--overflow" data-size={size} data-shape="circle" role="img" aria-label={overflowLabel(hidden)}>
          <span className="z-avatar__initials" aria-hidden="true">
            +{hidden}
          </span>
        </span>
      ) : null}
    </div>
  );
}
