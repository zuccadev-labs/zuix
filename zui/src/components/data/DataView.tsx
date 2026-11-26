"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { isLayout, readLayout, windowStore, writeLayout, type DataViewLayout } from "../../core/data-view";
import { cx } from "../../cx";
import { useIsoLayoutEffect } from "../../primitives/hooks";
import { SegmentedControl } from "../actions/SegmentedControl";

export type { DataViewLayout };

export interface DataViewLabels {
  /** Nombre del conmutador. */
  layout: string;
  list: string;
  grid: string;
}

const LABELS: DataViewLabels = { layout: "Layout", list: "List", grid: "Grid" };

export interface DataViewProps<T> {
  items: readonly T[];
  /** Cómo se pinta un elemento en cada disposición. */
  renderItem: (item: T, layout: DataViewLayout, index: number) => ReactNode;
  /** Clave de cada elemento (por defecto, su `id` o su índice). */
  getKey?: (item: T, index: number) => string | number;
  /** Nombre de la colección (lo lee el lector de pantalla en la lista). */
  label: string;
  /** Disposición (controlado). */
  layout?: DataViewLayout;
  defaultLayout?: DataViewLayout;
  onLayoutChange?: (layout: DataViewLayout) => void;
  /** Clave de `localStorage` donde se guarda la elección (sin ella no se guarda). */
  persistKey?: string;
  /** Ancho mínimo de una celda de la rejilla en px (220). */
  min?: number;
  /** Controles junto al conmutador (orden, filtro). */
  toolbar?: ReactNode;
  /** Lo que se ve sin elementos. */
  empty?: ReactNode;
  labels?: Partial<DataViewLabels>;
  className?: string;
  id?: string;
}

const keyOf = (item: unknown, index: number) => {
  const id = (item as { id?: unknown } | null)?.id;
  return typeof id === "string" || typeof id === "number" ? id : index;
};

/**
 * La misma colección como lista o como rejilla, con un conmutador (patrón APG «radiogroup») y la elección guardada
 * en `localStorage` si se da `persistKey`. La disposición es CSS: rejilla de celdas con ancho mínimo, sin cortes.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: el nombre del componente es el del patrón (DataView de PrimeReact); quien use el `DataView` del lenguaje en el mismo módulo lo importa con otro nombre.
export function DataView<T>({
  items,
  renderItem,
  getKey,
  label,
  layout: layoutProp,
  defaultLayout = "list",
  onLayoutChange,
  persistKey,
  min = 220,
  toolbar,
  empty,
  labels: labelsProp,
  className,
  id,
}: DataViewProps<T>) {
  const labels = { ...LABELS, ...labelsProp };
  const [own, setOwn] = useState<DataViewLayout>(defaultLayout);
  // Lo guardado se lee tras montar: en el servidor no hay almacenamiento y la primera pintura debe coincidir.
  useIsoLayoutEffect(() => {
    if (!persistKey || layoutProp) return;
    const saved = readLayout(windowStore(window), persistKey, defaultLayout);
    if (saved !== own) setOwn(saved);
  }, [persistKey]);
  const layout = layoutProp ?? own;
  const change = (next: string) => {
    if (!isLayout(next) || next === layout) return;
    if (!layoutProp) setOwn(next);
    if (persistKey) writeLayout(windowStore(window), persistKey, next);
    onLayoutChange?.(next);
  };
  return (
    <div
      id={id}
      className={cx("z-dataview", className)}
      data-layout={layout}
      data-persist={persistKey}
      style={{ "--z-dataview-min": `${Math.max(120, min)}px` } as CSSProperties}
    >
      <div className="z-dataview__bar">
        {toolbar ? <div className="z-dataview__tools">{toolbar}</div> : null}
        <SegmentedControl
          className="z-dataview__switch"
          size="sm"
          label={labels.layout}
          value={layout}
          onValueChange={change}
          items={[
            { value: "list", label: labels.list, icon: "list-bullet" },
            { value: "grid", label: labels.grid, icon: "squares-2x2" },
          ]}
        />
      </div>
      {items.length ? (
        <ul className="z-dataview__items" aria-label={label}>
          {items.map((item, index) => (
            <li key={getKey ? getKey(item, index) : keyOf(item, index)} className="z-dataview__item">
              {renderItem(item, layout, index)}
            </li>
          ))}
        </ul>
      ) : (
        <div className="z-dataview__empty">{empty}</div>
      )}
    </div>
  );
}
