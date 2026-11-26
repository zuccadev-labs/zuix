"use client";
import type { ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { IconButton } from "../actions/IconButton";
import { Spinner } from "../feedback/Spinner";
import { Menu } from "../overlay/Menu";
import type { MenuEntry } from "../overlay/internal";
import { DashboardGridItem } from "./DashboardGrid";

export type WidgetStatus = "ready" | "loading" | "empty" | "error";

export interface WidgetLabels {
  /** Nombre del menú de la pieza: «{title} options». */
  menu: string;
  loading: string;
  empty: string;
  error: string;
  retry: string;
}

const LABELS: WidgetLabels = {
  menu: "{title} options",
  loading: "Loading",
  empty: "No data yet",
  error: "Couldn't load this widget",
  retry: "Retry",
};

export interface WidgetProps {
  /** El de su pieza en la disposición de DashboardGrid. */
  id: string;
  title: string;
  description?: ReactNode;
  /** Acciones de la cabecera antes del menú (un selector de periodo). */
  actions?: ReactNode;
  /** Entradas del menú «⋯» de la cabecera. */
  menu?: MenuEntry[];
  /** Estado del contenido: listo, cargando, vacío o error. */
  status?: WidgetStatus;
  /** Texto del estado vacío o de error (en vez de los de `labels`). */
  message?: ReactNode;
  /** Reintentar desde el estado de error (sin él no hay botón). */
  onRetry?: () => void;
  surface?: "glass" | "solid";
  labels?: Partial<WidgetLabels>;
  className?: string;
  children?: ReactNode;
}

/**
 * Marco de widget de un dashboard: cabecera con título, acciones y menú, y el cuerpo según su estado (cargando con
 * `aria-busy`, vacío o error con reintento). Dentro de DashboardGrid es una de sus piezas: se mueve y se redimensiona
 * con la rejilla. Fuera de ella, una tarjeta.
 */
export function Widget({ id, title, description, actions, menu, status = "ready", message, onRetry, surface, labels: labelsProp, className, children }: WidgetProps) {
  const labels = { ...LABELS, ...labelsProp };
  const menuLabel = labels.menu.replace("{title}", title);
  const head =
    actions || menu?.length ? (
      <>
        {actions}
        {menu?.length ? <Menu trigger={<IconButton icon="ellipsis-horizontal" label={menuLabel} size="sm" />} items={menu} label={menuLabel} /> : null}
      </>
    ) : undefined;
  let body: ReactNode = children;
  if (status === "loading")
    body = (
      <div className="z-widget__state" data-status="loading">
        <Spinner size="sm" label={labels.loading} />
      </div>
    );
  else if (status === "empty")
    body = (
      <div className="z-widget__state" data-status="empty">
        <Icon name="inbox" size={20} />
        <p className="z-widget__message">{message ?? labels.empty}</p>
      </div>
    );
  else if (status === "error")
    body = (
      <div className="z-widget__state" data-status="error" role="alert">
        <Icon name="exclamation-triangle" size={20} />
        <p className="z-widget__message">{message ?? labels.error}</p>
        {onRetry ? (
          <button type="button" className="z-btn z-btn--secondary z-widget__retry" data-size="sm" onClick={onRetry}>
            <Icon name="arrow-path" size={14} />
            {labels.retry}
          </button>
        ) : null}
      </div>
    );
  return (
    <DashboardGridItem id={id} title={title} description={description} actions={head} surface={surface} className={["z-widget", className].filter(Boolean).join(" ")}>
      <div className="z-widget__body" data-status={status} aria-busy={status === "loading" || undefined}>
        {body}
      </div>
    </DashboardGridItem>
  );
}
