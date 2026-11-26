"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import {
  SIZE_CLASS_NAMES,
  nodeStyle,
  resolveAdaptive,
  resolveTemplate,
  areaRects,
  templateVars,
  validateTemplate,
  type AdaptiveIssue,
  type AdaptiveMap,
  type AdaptiveTemplates,
} from "../adaptive";
import { isDev, syncLayoutOrder, type MeasureMode, type OrderReport, type ReorderMode, type SizeState } from "../adaptive-runtime";
import { SizeClassContext, useIsoLayoutEffect, useMeasuredSizeClass } from "./size-class";

type Space = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20;

interface LayoutContextValue {
  templates: AdaptiveTemplates;
  report: (issues: AdaptiveIssue[]) => void;
}
const LayoutContext = createContext<LayoutContextValue | null>(null);

export interface AdaptiveLayoutProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /**
   * Plantilla por clase de tamaño: `{ [clase]: { areas, columns?, rows? } }`. Se hereda hacia arriba: la de `compact`
   * vale hasta la siguiente clase definida. Sin plantilla en una clase, las piezas van en una columna por `order`.
   */
  templates: AdaptiveTemplates;
  /** `AdaptiveItem`, directos o dentro de fragmentos. */
  children: ReactNode;
  /**
   * Cómo se respeta el orden de lectura cuando una clase reordena. `dom` (por defecto): se mueven los nodos para que
   * el orden del documento, el de tabulación y el del lector de pantalla sean el que se ve. `visual`: solo CSS; el
   * navegador con `reading-flow` hace seguir el foco al orden de la rejilla y, donde no, se avisa en desarrollo.
   */
  reorder?: ReorderMode;
  /** Qué se mide para elegir la clase: el contenedor (por defecto) o la ventana. */
  measure?: MeasureMode;
  /** Separación entre piezas, en pasos de la escala. Por defecto, 4. */
  gap?: Space;
  /**
   * Cada pieza lleva `view-transition-class: z-adaptive-item`: un cambio de plantilla o de ajustes hecho dentro de
   * `adaptiveTransition` (o de `startViewTransition`) se anima pieza a pieza. Sin animación con `prefers-reduced-motion`.
   */
  transition?: boolean;
  /** Cambio de clase de tamaño o de entrada (también la primera medida). */
  onSizeClassChange?: (state: SizeState) => void;
  /**
   * El orden visual y el del DOM se separan (en modo `visual`). Sin esta función se avisa por consola en desarrollo
   * cuando el navegador no tiene `reading-flow`.
   */
  onOrderMismatch?: (report: OrderReport) => void;
  /** Problemas de las plantillas o de las piezas (área que no existe, área no rectangular). Sin ella, consola en desarrollo. */
  onIssues?: (issues: AdaptiveIssue[]) => void;
  as?: ElementType;
}

const warn = (issues: AdaptiveIssue[]) => {
  if (isDev) for (const issue of issues) console.warn(`[zout] AdaptiveLayout: ${issue.message}`);
};

/**
 * Layout adaptativo: una plantilla de áreas distinta para cada clase de tamaño y piezas que declaran su área, su orden
 * y si se ocultan en cada clase. La colocación la hace la hoja con consultas de contenedor, así que el HTML del
 * servidor ya sale colocado; JavaScript solo mide (para `useSizeClass`) y, en modo `dom`, reordena los nodos.
 */
export function AdaptiveLayout({
  templates,
  children,
  reorder = "dom",
  measure = "container",
  gap,
  transition = false,
  onSizeClassChange,
  onOrderMismatch,
  onIssues,
  as: Tag = "div",
  className,
  ...rest
}: AdaptiveLayoutProps) {
  const ref = useRef<HTMLElement>(null);
  const callbacks = useRef({ onSizeClassChange, onOrderMismatch, onIssues });
  callbacks.current = { onSizeClassChange, onOrderMismatch, onIssues };
  const state = useMeasuredSizeClass(ref, measure, (next) => callbacks.current.onSizeClassChange?.(next));
  const vars = useMemo(() => templateVars(templates) as CSSProperties, [templates]);
  const report = useMemo(() => (issues: AdaptiveIssue[]) => (callbacks.current.onIssues ?? warn)(issues), []);
  const context = useMemo(() => ({ templates, report }), [templates, report]);

  // Plantillas mal formadas: una vez por cambio de plantillas.
  useEffect(() => {
    const issues = SIZE_CLASS_NAMES.flatMap((cls) => (templates[cls] ? validateTemplate(templates[cls]!, cls) : []));
    if (issues.length) report(issues);
  }, [templates, report]);

  // Orden de lectura: tras cada render (las piezas pueden haber cambiado de área u orden) y con cada clase nueva.
  const cls = state?.sizeClass ?? null;
  const lastMismatch = useRef("");
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || !cls) return;
    // Al cambiar de clase la hoja ya colocó las piezas: mover los nodos no cambia nada a la vista y no se anima.
    const result = syncLayoutOrder(el, cls, reorder);
    // Se avisa una vez por desorden distinto, no en cada render (el aviso suele cambiar estado de la aplicación).
    const signature = reorder === "visual" && result.mismatch ? `${cls}|${result.dom.join()}|${result.visual.join()}` : "";
    if (signature === lastMismatch.current) return;
    lastMismatch.current = signature;
    if (signature) {
      if (callbacks.current.onOrderMismatch) callbacks.current.onOrderMismatch(result);
      else if (isDev && !result.readingFlow)
        console.warn(
          `[zout] AdaptiveLayout: en ${cls} el orden visual (${result.visual.join(", ")}) no es el del DOM (${result.dom.join(", ")}). ` +
            'El teclado y el lector de pantalla seguirán el del DOM: usa reorder="dom".',
        );
    }
  });

  return (
    <Tag
      {...rest}
      ref={ref}
      className={cx("z-adaptive", className)}
      data-measure={measure === "window" ? "window" : undefined}
      data-reorder={reorder}
      data-transition={transition ? "" : undefined}
      data-size-class={cls ?? undefined}
    >
      <div className="z-adaptive__grid" data-gap={gap} style={vars}>
        <LayoutContext.Provider value={context}>
          <SizeClassContext.Provider value={state}>{children}</SizeClassContext.Provider>
        </LayoutContext.Provider>
      </div>
    </Tag>
  );
}

export interface AdaptiveItemProps extends Omit<HTMLAttributes<HTMLElement>, "id" | "hidden"> {
  /** Identificador de la pieza (`data-item`). Lo usan el orden de lectura, el editor y los avisos. */
  id: string;
  /** Área de la plantilla en todas las clases, salvo lo que diga `adaptive`. */
  area?: string;
  order?: number;
  /** Columnas que ocupa sin área. */
  span?: number;
  hidden?: boolean;
  /** Ajustes por clase: `{ [clase]: { order?, hidden?, area?, span? } }`, heredados hacia arriba. */
  adaptive?: AdaptiveMap;
  /** Atributo `id` del elemento, si hace falta (el `id` de la prop es el de la pieza). */
  elementId?: string;
  as?: ElementType;
  children?: ReactNode;
}

/** Pieza de un `AdaptiveLayout`. Escribe su colocación para las cinco clases en variables; la hoja elige la activa. */
export function AdaptiveItem({
  id,
  area,
  order,
  span,
  hidden,
  adaptive,
  elementId,
  as: Tag = "div",
  className,
  style,
  children,
  ...rest
}: AdaptiveItemProps) {
  const layout = useContext(LayoutContext);
  const templates = layout?.templates ?? {};
  const node = useMemo(() => ({ id, area, order, span, hidden, adaptive }), [id, area, order, span, hidden, adaptive]);
  const { vars, hiddenIn } = useMemo(() => nodeStyle(templates, node), [templates, node]);

  // Un área que no existe en la plantilla de una clase deja la pieza en flujo: se avisa.
  useEffect(() => {
    if (!layout) return;
    const issues: AdaptiveIssue[] = [];
    for (const cls of SIZE_CLASS_NAMES) {
      const s = resolveAdaptive(node.adaptive, cls, { area: node.area, hidden: node.hidden });
      if (s.hidden || !s.area) continue;
      const t = resolveTemplate(layout.templates, cls);
      if (!t || !areaRects(t.areas).has(s.area))
        issues.push({
          code: "unknown-area",
          sizeClass: cls,
          area: s.area,
          item: id,
          message: `«${id}» va en el área «${s.area}», que no existe en la plantilla de ${cls}.`,
        });
    }
    if (issues.length) layout.report(issues);
  }, [layout, node, id]);

  return (
    <Tag
      {...rest}
      id={elementId}
      className={cx("z-adaptive__item", className)}
      data-item={id}
      data-hidden-in={hiddenIn}
      style={{ ...vars, ...style }}
    >
      {children}
    </Tag>
  );
}
