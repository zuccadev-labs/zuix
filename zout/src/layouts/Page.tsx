import type { CSSProperties, ElementType, ReactNode } from "react";
import { cx } from "../cx";

type Space = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20;

export interface StackProps {
  children: ReactNode;
  /** Separación, en pasos de la escala de espaciado. */
  gap?: Space;
  align?: "start" | "center" | "end" | "stretch";
  as?: ElementType;
  className?: string;
}

/** Apila hijos en vertical con separación de la escala. */
export function Stack({ children, gap = 4, align = "stretch", as: Tag = "div", className }: StackProps) {
  return <Tag className={cx("z-stack", className)} data-gap={gap} data-align={align}>{children}</Tag>;
}

export interface InlineProps extends StackProps {
  justify?: "start" | "center" | "end" | "between";
  /** Permite saltar de línea cuando no cabe. Por defecto, true. */
  wrap?: boolean;
}

/** Coloca hijos en horizontal; salta de línea si no caben. */
export function Inline({ children, gap = 2, align = "center", justify = "start", wrap = true, as: Tag = "div", className }: InlineProps) {
  return <Tag className={cx("z-inline", className)} data-gap={gap} data-align={align} data-justify={justify} data-wrap={wrap || undefined}>{children}</Tag>;
}

export interface GridProps {
  children: ReactNode;
  /** Ancho mínimo de cada celda. La rejilla calcula sola cuántas columnas caben. */
  min?: number | string;
  gap?: Space;
  as?: ElementType;
  className?: string;
}

/** Rejilla intrínseca: tantas columnas como quepan con el ancho mínimo dado. Origen: `kpi-grid` y `grid-2` de ui-glass. */
export function Grid({ children, min = 240, gap = 4, as: Tag = "div", className }: GridProps) {
  const style = { "--z-grid-min": typeof min === "number" ? `${min}px` : min } as CSSProperties;
  return <Tag className={cx("z-grid", className)} data-gap={gap} style={style}>{children}</Tag>;
}

export interface ContainerProps {
  children: ReactNode;
  /** `content`: ancho máximo de contenido. `prose`: ancho de lectura. `full`: sin límite. */
  width?: "content" | "prose" | "full";
  as?: ElementType;
  className?: string;
}

/** Centra el contenido y limita su ancho con los tokens `content-max` o `prose-max`. */
export function Container({ children, width = "content", as: Tag = "div", className }: ContainerProps) {
  return <Tag className={cx("z-container", className)} data-width={width}>{children}</Tag>;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Texto pequeño sobre el título (sección, categoría). */
  eyebrow?: ReactNode;
  /** Acciones a la derecha. */
  actions?: ReactNode;
  /** Migas u otro elemento encima del título. */
  breadcrumb?: ReactNode;
  /** Nivel del encabezado del título. Por defecto 1; una página dentro de otra (un Shell anidado) usa 2 o más. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}

/** Cabecera de página: migas, título, descripción y acciones. */
export function PageHeader({ title, description, eyebrow, actions, breadcrumb, headingLevel = 1, className }: PageHeaderProps) {
  const Heading = `h${headingLevel}` as "h1";
  return (
    <header className={cx("z-pagehead", className)}>
      {breadcrumb}
      <div className="z-pagehead__row">
        <div className="z-pagehead__text">
          {eyebrow ? <div className="z-pagehead__eyebrow">{eyebrow}</div> : null}
          <Heading className="z-pagehead__title">{title}</Heading>
          {description ? <p className="z-pagehead__description">{description}</p> : null}
        </div>
        {actions ? <div className="z-pagehead__actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export interface PageProps {
  header?: ReactNode;
  children: ReactNode;
  width?: ContainerProps["width"];
  className?: string;
}

/** Página con desplazamiento propio dentro del área principal del Shell. */
export function Page({ header, children, width = "content", className }: PageProps) {
  return (
    <div className={cx("z-page", className)}>
      <Container width={width}>
        {header}
        <div className="z-page__body">{children}</div>
      </Container>
    </div>
  );
}

export interface PageSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Nivel del encabezado del título. Por defecto 2. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

/** Sección de página con título opcional. */
export function PageSection({ title, description, actions, children, headingLevel = 2, className }: PageSectionProps) {
  const Heading = `h${headingLevel}` as "h2";
  return (
    <section className={cx("z-section", className)}>
      {title || actions ? (
        <div className="z-section__head">
          <div>
            {title ? <Heading className="z-section__title">{title}</Heading> : null}
            {description ? <p className="z-section__description">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
