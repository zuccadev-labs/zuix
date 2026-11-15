import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  /** Acción principal (normalmente un `Button`). */
  action?: ReactNode;
  size?: "sm" | "md";
  /** Nivel del encabezado para respetar la jerarquía de la página. */
  headingLevel?: 2 | 3 | 4;
}

/** Estado vacío: explica por qué no hay contenido y qué hacer. */
export function EmptyState({ icon, title, description, action, size = "md", headingLevel = 3, className, ...rest }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div {...rest} className={cx("z-empty", className)} data-size={size}>
      {icon ? (
        <span className="z-empty__icon">
          <Icon name={icon} size={size === "sm" ? 20 : 28} />
        </span>
      ) : null}
      <Heading className="z-empty__title">{title}</Heading>
      {description ? <p className="z-empty__description">{description}</p> : null}
      {action ? <div className="z-empty__action">{action}</div> : null}
    </div>
  );
}
