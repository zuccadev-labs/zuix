import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../cx";

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: "section" | "aside" | "header" | "footer" | "nav" | "div";
  /** `glass` es el material de cristal (cromo); `solid` es opaco, para texto denso. */
  material?: "glass" | "solid";
  title?: ReactNode;
  /** Texto secundario bajo el título. */
  description?: ReactNode;
  /** Controles a la derecha de la cabecera. */
  actions?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  headingLevel?: 2 | 3 | 4;
}

/** Panel de cristal líquido: la pieza de cromo sobre la que flota el resto de la interfaz. */
export function Panel({
  as: Tag = "section",
  material = "glass",
  title,
  description,
  actions,
  padding = "md",
  headingLevel = 2,
  className,
  children,
  ...rest
}: PanelProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <Tag {...rest} className={cx("z-panel", material === "glass" ? "z-liquid" : "z-solid", className)} data-padding={padding}>
      {title || actions ? (
        <div className="z-panel__header">
          <div className="z-panel__heading">
            {title ? <Heading className="z-panel__title">{title}</Heading> : null}
            {description ? <p className="z-panel__description">{description}</p> : null}
          </div>
          {actions ? <div className="z-panel__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
