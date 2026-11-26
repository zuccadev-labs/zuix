import type { CSSProperties, HTMLAttributes } from "react";
import { cx } from "../../cx";

export interface RangeHistogramProps extends HTMLAttributes<HTMLDivElement> {
  /** Recuento por tramo, de menor a mayor. */
  values: readonly number[];
  /** Tramo elegido: índices del primer y el último tramo dentro (se resaltan). Sin él, todos. */
  selected?: readonly [number, number];
}

/**
 * Histograma decorativo bajo un Slider de rango: cuántos resultados hay en cada tramo, con el tramo elegido resaltado.
 * Es `aria-hidden`: el valor lo anuncia el Slider.
 */
export function RangeHistogram({ values, selected, className, ...rest }: RangeHistogramProps) {
  const max = Math.max(1, ...values);
  const [from, to] = selected ?? [0, values.length - 1];
  return (
    <div {...rest} className={cx("z-range-histogram", className)} aria-hidden="true">
      {values.map((v, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: un tramo es su posición.
          key={i}
          className="z-range-histogram__bar"
          data-in={i >= Math.min(from, to) && i <= Math.max(from, to) ? "" : undefined}
          style={{ "--z-bar": Math.max(0.04, v / max) } as CSSProperties}
        />
      ))}
    </div>
  );
}
