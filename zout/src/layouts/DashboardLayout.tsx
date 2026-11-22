import type { ReactNode } from "react";
import { cx } from "../cx";

export interface DashboardLayoutProps {
  title: ReactNode;
  description?: ReactNode;
  /** Migas o antetítulo sobre el título. */
  eyebrow?: ReactNode;
  /** Acciones de la página (exportar, compartir, editar la rejilla). */
  actions?: ReactNode;
  /** Barra de filtros (rango de fechas, segmentos): queda fija bajo la cabecera al desplazar. */
  filters?: ReactNode;
  /** Navegación lateral propia de la página; en estrecho pasa a una tira arriba. */
  nav?: ReactNode;
  /** Nombre de la navegación. */
  navLabel?: string;
  /** Panel lateral (detalles, inspector); en estrecho baja bajo el contenido. */
  aside?: ReactNode;
  asideLabel?: string;
  /** Contenido: DashboardGrid, MetricGroup, tablas. */
  children: ReactNode;
  className?: string;
}

/**
 * Página de dashboard: cabecera con título y acciones, barra de filtros fija, contenido (DashboardGrid) y panel
 * lateral opcional. Responde al ancho de su contenedor, no del viewport: dentro de un Shell con la sidebar abierta se
 * reordena igual.
 */
export function DashboardLayout({
  title,
  description,
  eyebrow,
  actions,
  filters,
  nav,
  navLabel = "Dashboard",
  aside,
  asideLabel = "Details",
  children,
  className,
}: DashboardLayoutProps) {
  return (
    <div className={cx("z-dashboard-layout", className)} data-nav={nav ? "" : undefined} data-aside={aside ? "" : undefined}>
      <div className="z-dashboard-layout__grid">
        {nav ? (
          <nav className="z-dashboard-layout__nav" aria-label={navLabel}>
            {nav}
          </nav>
        ) : null}
        <div className="z-dashboard-layout__main">
          <header className="z-dashboard-layout__header">
            <div className="z-dashboard-layout__titles">
              {eyebrow ? <div className="z-dashboard-layout__eyebrow">{eyebrow}</div> : null}
              <h1 className="z-dashboard-layout__title">{title}</h1>
              {description ? <p className="z-dashboard-layout__description">{description}</p> : null}
            </div>
            {actions ? <div className="z-dashboard-layout__actions">{actions}</div> : null}
          </header>
          {filters ? <div className="z-dashboard-layout__filters z-liquid">{filters}</div> : null}
          <div className="z-dashboard-layout__content">{children}</div>
        </div>
        {aside ? (
          <aside className="z-dashboard-layout__aside" aria-label={asideLabel}>
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
