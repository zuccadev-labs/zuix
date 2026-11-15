"use client";
import { Children, Fragment, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cx } from "../cx";
import { SPLIT_MIN_FRACTION, dividerKeyDelta, evenFractions as even, moveDivider } from "../logic";

export interface SplitPaneProps {
  /** `row`: paneles lado a lado. `column`: apilados. */
  direction?: "row" | "column";
  /** Un hijo por panel. */
  children: ReactNode;
  /** Reparto controlado, una fracción por panel (suman 1). Sin valor, el componente lo gestiona. */
  sizes?: number[];
  defaultSizes?: number[];
  onSizesChange?: (sizes: number[]) => void;
  /** Fracción mínima de cada panel. */
  minFraction?: number;
  dividerLabel?: string;
  className?: string;
}

/** Paneles divididos con divisores arrastrables y manejables con teclado. Origen: `split` de zutool. */
export function SplitPane({ direction = "row", children, sizes, defaultSizes, onSizesChange, minFraction = SPLIT_MIN_FRACTION, dividerLabel = "Resize panes", className }: SplitPaneProps) {
  const panes = Children.toArray(children);
  const [inner, setInner] = useState<number[]>(() => defaultSizes ?? even(panes.length));
  const current = sizes ?? inner;
  const fractions = current.length === panes.length ? current : even(panes.length);
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; pos: number; a: number; b: number; total: number } | null>(null);

  const commit = (next: number[]) => { if (sizes === undefined) setInner(next); onSizesChange?.(next); };
  // Mueve el divisor `index` (entre los paneles index e index+1) una fracción `delta`.
  const move = (index: number, a: number, b: number, delta: number) => commit(moveDivider(fractions, index, a, b, delta, minFraction));

  const onPointerDown = (index: number) => (e: PointerEvent<HTMLDivElement>) => {
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { index, pos: direction === "row" ? e.clientX : e.clientY, a: fractions[index] ?? 0, b: fractions[index + 1] ?? 0, total: direction === "row" ? rect.width : rect.height };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.dataset.dragging = "";
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.total <= 0) return;
    move(d.index, d.a, d.b, ((direction === "row" ? e.clientX : e.clientY) - d.pos) / d.total);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => { drag.current = null; delete e.currentTarget.dataset.dragging; };
  const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = dividerKeyDelta(e.key, direction);
    if (!delta) return;
    e.preventDefault();
    move(index, fractions[index] ?? 0, fractions[index + 1] ?? 0, delta);
  };

  return (
    <div ref={root} className={cx("z-split", className)} data-direction={direction}>
      {panes.map((pane, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <div
              role="separator"
              tabIndex={0}
              aria-orientation={direction === "row" ? "vertical" : "horizontal"}
              aria-label={dividerLabel}
              aria-valuenow={Math.round((fractions[i - 1] ?? 0) * 100)}
              aria-valuemin={Math.round(minFraction * 100)}
              aria-valuemax={Math.round((1 - minFraction) * 100)}
              className="z-split__divider"
              onPointerDown={onPointerDown(i - 1)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              // WebKit puede iniciar un arrastrar y soltar nativo desde el divisor, que cancela los eventos de puntero.
              onDragStart={(e) => e.preventDefault()}
              onKeyDown={onKeyDown(i - 1)}
            />
          ) : null}
          <div className="z-split__pane" style={{ flexGrow: fractions[i] ?? 0 }}>{pane}</div>
        </Fragment>
      ))}
    </div>
  );
}

export interface PaneProps {
  /** Cabecera del panel (título, miga, acciones). */
  header?: ReactNode;
  children: ReactNode;
  /** El panel con foco se marca con borde; los demás se atenúan. */
  focused?: boolean;
  className?: string;
}

/** Panel de trabajo con cabecera de cristal y cuerpo opaco. Origen: `pane` de zutool. */
export function Pane({ header, children, focused, className }: PaneProps) {
  return (
    <div className={cx("z-pane", className)} data-focused={focused === undefined ? undefined : String(focused)}>
      {header ? <div className="z-pane__header">{header}</div> : null}
      <div className="z-pane__body">{children}</div>
    </div>
  );
}
