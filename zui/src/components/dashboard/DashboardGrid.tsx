"use client";
import { useLocale } from "../../locale";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { attachDashboardGrid } from "../../core/dashboard-grid";
import {
  GRID_COLUMNS,
  GRID_LABELS,
  normalizeLayout,
  sortLayout,
  type GridItem,
  type GridLabels,
  type GridLayout,
} from "../../core/grid-layout";
import { cx } from "../../cx";

export type { GridItem as DashboardGridItemLayout, GridLabels as DashboardGridLabels, GridLayout as DashboardLayoutValue };

interface GridContext {
  positions: Map<string, GridItem>;
  editable: boolean;
  labels: GridLabels;
  hintId: string;
}
const Ctx = createContext<GridContext | null>(null);

export interface DashboardGridProps {
  /** Disposición controlada: `{ id, x, y, w, h }` por pieza (columnas y filas desde 0). */
  layout?: GridLayout;
  /** Disposición inicial sin controlar. */
  defaultLayout?: GridLayout;
  /** Tras soltar una pieza movida o redimensionada, con la disposición nueva: guárdala para persistir el orden. */
  onLayoutChange?: (layout: GridLayout) => void;
  /** Modo edición: asas para mover y tiradores para redimensionar. */
  editable?: boolean;
  /** Columnas de la rejilla (12 por defecto). */
  columns?: number;
  /** Alto de una fila en px (88 por defecto). */
  rowHeight?: number;
  /** Nombre de la región. */
  label?: string;
  labels?: Partial<GridLabels>;
  className?: string;
  id?: string;
  /** DashboardGridItem con `id`. */
  children: ReactNode;
}

/**
 * Rejilla de tarjetas de un dashboard: cada pieza ocupa columnas y filas; en edición se mueve y se redimensiona con el
 * puntero (asa y tirador) y con el teclado (Espacio coge, flechas mueven, Mayús + flechas redimensionan, Intro suelta,
 * Escape cancela). Las demás se apartan y la rejilla compacta hacia arriba. En un contenedor estrecho se apila en una
 * columna, en el orden de lectura, que es también el del DOM.
 */
export function DashboardGrid({
  layout: layoutProp,
  defaultLayout,
  onLayoutChange,
  editable = false,
  columns = GRID_COLUMNS,
  rowHeight = 88,
  label,
  labels: labelsProp,
  className,
  id,
  children,
}: DashboardGridProps) {
  const [own, setOwn] = useState<GridLayout>(() => normalizeLayout(defaultLayout ?? layoutProp ?? [], columns));
  const committed = useMemo(() => (layoutProp ? normalizeLayout(layoutProp, columns) : own), [layoutProp, own, columns]);
  const [preview, setPreview] = useState<GridLayout | null>(null);
  const base = useLocale().messages("dashboardGrid", GRID_LABELS);
  const labels = useMemo(() => ({ ...base, ...labelsProp }), [base, labelsProp]);
  const root = useRef<HTMLDivElement | null>(null);
  const hintId = `${useId().replace(/:/g, "")}-hint`;
  const live = useRef({ committed, editable, labels, onLayoutChange, controlled: Boolean(layoutProp) });
  live.current = { committed, editable, labels, onLayoutChange, controlled: Boolean(layoutProp) };

  useEffect(() => {
    if (!root.current) return;
    return attachDashboardGrid(root.current, {
      layout: () => live.current.committed,
      preview: (next) => setPreview(next),
      commit: (next) => {
        if (!live.current.controlled) setOwn(next);
        live.current.onLayoutChange?.(next);
      },
      editable: () => live.current.editable,
      labels: () => live.current.labels,
    });
  }, []);

  const shown = preview ?? committed;
  const positions = useMemo(() => new Map(shown.map((i) => [i.id, i])), [shown]);
  // El orden del DOM sigue a la disposición confirmada (no a la provisional: mover nodos durante el arrastre haría
  // perder el foco del asa).
  const order = useMemo(() => new Map(sortLayout(committed).map((i, index) => [i.id, index])), [committed]);
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ id?: string }>[];
  items.sort((a, b) => (order.get(a.props.id ?? "") ?? 1e9) - (order.get(b.props.id ?? "") ?? 1e9));
  const ctx = useMemo<GridContext>(() => ({ positions, editable, labels, hintId }), [positions, editable, labels, hintId]);
  return (
    <Ctx.Provider value={ctx}>
      <div
        ref={root}
        id={id}
        role="region"
        aria-label={label}
        className={cx("z-dashboard-grid", className)}
        data-editable={editable ? "" : undefined}
        data-cols={columns}
        style={{ "--z-grid-cols": columns, "--z-grid-row": `${rowHeight}px` } as CSSProperties}
      >
        <div className="z-dashboard-grid__canvas">{items}</div>
        {editable ? (
          <span id={hintId} className="z-sr-only">
            {labels.instructions}
          </span>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}

export interface DashboardGridItemProps {
  /** El de su pieza en `layout`. */
  id: string;
  /** Nombre de la pieza (cabecera, asa y anuncios). */
  title: string;
  /** Texto bajo el título. */
  description?: ReactNode;
  /** Acciones en la cabecera (un Menu, un selector de periodo). */
  actions?: ReactNode;
  /** Sin marco ni cabecera: el contenido (una MetricCard) ya es la tarjeta; en edición el asa flota en la esquina. */
  bare?: boolean;
  /** Superficie del marco. */
  surface?: "glass" | "solid";
  className?: string;
  children?: ReactNode;
}

/** Pieza de DashboardGrid: marco con título, acciones y cuerpo; en edición, asa de mover y tirador de tamaño. */
export function DashboardGridItem({
  id,
  title,
  description,
  actions,
  bare,
  surface = "glass",
  className,
  children,
}: DashboardGridItemProps) {
  const ctx = useContext(Ctx);
  const at = ctx?.positions.get(id);
  const base = useLocale().messages("dashboardGrid", GRID_LABELS);
  const labels = ctx?.labels ?? base;
  const headingId = `${ctx?.hintId ?? "grid"}-${id}`;
  const style = at ? ({ "--z-x": at.x, "--z-y": at.y, "--z-w": at.w, "--z-h": at.h } as CSSProperties) : undefined;
  const handle = ctx?.editable ? (
    <button
      type="button"
      className="z-dashboard-grid__handle"
      aria-label={labels.handle.replace("{name}", title)}
      aria-describedby={ctx.hintId}
      aria-pressed="false"
    >
      <Icon name="arrows-pointing-out" size={14} />
      <span className="z-dashboard-grid__hint" aria-hidden="true">
        <span className="z-dashboard-grid__hint-rest">{labels.hint}</span>
        <span className="z-dashboard-grid__hint-grabbed">{labels.hintGrabbed}</span>
      </span>
    </button>
  ) : null;
  return (
    <section
      className={cx(
        "z-dashboard-grid__item",
        !bare && surface === "glass" && "z-liquid",
        !bare && surface === "solid" && "z-solid",
        className,
      )}
      data-id={id}
      data-name={title}
      data-x={at?.x}
      data-y={at?.y}
      data-w={at?.w}
      data-h={at?.h}
      data-min-w={at?.minW}
      data-min-h={at?.minH}
      data-max-w={at?.maxW}
      data-max-h={at?.maxH}
      data-static={at?.static ? "" : undefined}
      data-bare={bare ? "" : undefined}
      aria-labelledby={bare ? undefined : headingId}
      aria-label={bare ? title : undefined}
      style={style}
    >
      {bare ? (
        handle ? (
          <div className="z-dashboard-grid__float">{handle}</div>
        ) : null
      ) : (
        <header className="z-dashboard-grid__head">
          <div className="z-dashboard-grid__titles">
            <h2 className="z-dashboard-grid__title" id={headingId}>
              {title}
            </h2>
            {description ? <p className="z-dashboard-grid__description">{description}</p> : null}
          </div>
          {actions ? <div className="z-dashboard-grid__actions">{actions}</div> : null}
          {handle}
        </header>
      )}
      <div className="z-dashboard-grid__body">{children}</div>
      {ctx?.editable && !at?.static ? <span className="z-dashboard-grid__resize" aria-hidden="true" /> : null}
    </section>
  );
}
