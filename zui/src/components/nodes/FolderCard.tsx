import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { colorVar } from "../../core/diagram";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface FolderTabProps {
  title: ReactNode;
  kind?: ReactNode;
  icon?: IconName;
  as?: "h2" | "h3" | "h4" | "h5" | "h6" | "span";
  id?: string;
}

/** Pestaña de carpeta («MikroTik · switch»). La usan FolderCard y los nodos `folder` de NodeCanvas. */
export function FolderTab({ title, kind, icon, as: Title = "h3", id }: FolderTabProps) {
  return (
    <div className="z-folder-card__tab">
      {icon ? (
        <span className="z-folder-card__icon" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      ) : null}
      <Title className="z-folder-card__title" id={id}>
        {title}
      </Title>
      {kind ? <span className="z-folder-card__kind">{kind}</span> : null}
    </div>
  );
}

export interface FolderCardProps extends Omit<HTMLAttributes<HTMLElement>, "title" | "color"> {
  /** Título de la pestaña. */
  title: ReactNode;
  /** Lo que sigue al punto en la pestaña («switch», «server»). */
  kind?: ReactNode;
  icon?: IconName;
  /** Color del borde: tono (`accent`, `danger`…), token (`chart-3`) o color libre. */
  color?: string;
  /** Nivel del título. Por defecto 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Pie: una línea de notas bajo el cuerpo. */
  footer?: ReactNode;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/**
 * Tarjeta con pestaña de carpeta: el título y su tipo van en una pestaña sobre el borde («MikroTik · switch») y el
 * contenido debajo. Sirve dentro de un NodeCanvas (nodo `folder`) y fuera de él, en cualquier página. Es una
 * `section` con nombre (el del título).
 */
export const FolderCard = withRef(function FolderCard({
  title,
  kind,
  icon,
  color,
  headingLevel = 3,
  footer,
  children,
  className,
  style,
  id,
  ref,
  ...rest
}: FolderCardProps) {
  const titleId = `${id ?? "z-folder"}-title`;
  const c = colorVar(color);
  return (
    <section
      {...rest}
      ref={ref}
      id={id}
      className={cx("z-folder-card", className)}
      aria-labelledby={rest["aria-label"] ? undefined : id ? titleId : undefined}
      style={c ? ({ ...style, "--z-folder-color": c } as CSSProperties) : style}
    >
      <FolderTab title={title} kind={kind} icon={icon} as={`h${headingLevel}`} id={id ? titleId : undefined} />
      <div className="z-folder-card__body">
        {children}
        {footer ? <div className="z-folder-card__footer">{footer}</div> : null}
      </div>
    </section>
  );
});
