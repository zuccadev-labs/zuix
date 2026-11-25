import type { ReactNode } from "react";
import { cx } from "../cx";

export interface KanbanLayoutProps {
  title: ReactNode;
  description?: ReactNode;
  /** Acciones (nueva tarjeta, compartir). */
  actions?: ReactNode;
  /** Filtros (búsqueda, personas, etiquetas). */
  filters?: ReactNode;
  /** El tablero (KanbanBoard). */
  children: ReactNode;
  className?: string;
}

/**
 * Página de tablero: cabecera con título, acciones y filtros, y el tablero a todo el ancho con desplazamiento
 * horizontal por columnas (una por pantalla en móvil).
 */
export function KanbanLayout({ title, description, actions, filters, children, className }: KanbanLayoutProps) {
  return (
    <div className={cx("z-kanban-layout", className)}>
      <header className="z-kanban-layout__header">
        <div className="z-kanban-layout__titles">
          <h1 className="z-kanban-layout__title">{title}</h1>
          {description ? <p className="z-kanban-layout__description">{description}</p> : null}
        </div>
        {actions ? <div className="z-kanban-layout__actions">{actions}</div> : null}
      </header>
      {filters ? <div className="z-kanban-layout__filters">{filters}</div> : null}
      <div className="z-kanban-layout__board">{children}</div>
    </div>
  );
}
