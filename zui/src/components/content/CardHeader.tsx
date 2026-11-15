import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Acción alineada a la derecha. */
  action?: ReactNode;
  headingLevel?: 2 | 3 | 4;
}

/** Cabecera de una `Card`: título, subtítulo y acción. */
export function CardHeader({ title, subtitle, action, headingLevel = 3, className, ...rest }: CardHeaderProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div {...rest} className={cx("z-card__header", className)}>
      <div className="z-card__heading">
        <Heading className="z-card__title">{title}</Heading>
        {subtitle ? <p className="z-card__subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="z-card__action">{action}</div> : null}
    </div>
  );
}
