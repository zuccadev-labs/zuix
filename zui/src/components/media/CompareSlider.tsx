"use client";
import { useRef, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { compareKey, comparePosition } from "../../core/compare-slider";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";

export interface CompareSliderLabels {
  /** Nombre accesible del divisor. */
  slider: string;
  before: string;
  after: string;
  /** «{value}% {before}». */
  valueText: string;
}

const LABELS: CompareSliderLabels = { slider: "Image comparison", before: "Before", after: "After", valueText: "{value}% {before}" };

export interface CompareSliderProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "defaultValue" | "onChange"> {
  /** Lo de antes (a la izquierda o arriba). */
  before: ReactNode;
  /** Lo de después (a la derecha o abajo). */
  after: ReactNode;
  /** Posición del divisor, de 0 a 100 (controlada). */
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Al soltar el puntero o tras una tecla. */
  onValueChangeEnd?: (value: number) => void;
  orientation?: "horizontal" | "vertical";
  /** Rótulos «Before» y «After» sobre cada lado. */
  showLabels?: boolean;
  labels?: Partial<CompareSliderLabels>;
  ref?: Ref<HTMLDivElement>;
}

/** Comparador antes/después: un divisor que se arrastra o se mueve con el teclado (patrón APG «slider»). */
export function CompareSlider({
  before,
  after,
  value: valueProp,
  defaultValue = 50,
  onValueChange,
  onValueChangeEnd,
  orientation = "horizontal",
  showLabels = true,
  labels,
  className,
  style,
  ref,
  onPointerDown,
  ...rest
}: CompareSliderProps) {
  const text = { ...LABELS, ...labels };
  const vertical = orientation === "vertical";
  const [value, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  const drag = useRef<number | null>(null);
  const current = useRef(value);
  current.current = value;
  const handleRef = useRef<HTMLSpanElement>(null);

  const at = (event: PointerEvent<HTMLDivElement>) =>
    comparePosition({ x: event.clientX, y: event.clientY }, event.currentTarget.getBoundingClientRect(), vertical);
  const update = (next: number) => {
    current.current = next;
    setValue(next);
  };

  return (
    <div
      {...rest}
      ref={ref}
      className={cx("z-compare", className)}
      data-orientation={orientation}
      data-value={value}
      style={{ ...style, "--z-compare-pos": `${value}%` } as CSSProperties}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || event.button !== 0) return;
        event.preventDefault();
        drag.current = event.pointerId;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Puntero sintético.
        }
        handleRef.current?.focus({ preventScroll: true });
        update(at(event));
      }}
      onPointerMove={(event) => {
        if (drag.current === event.pointerId) update(at(event));
      }}
      onPointerUp={(event) => {
        if (drag.current !== event.pointerId) return;
        drag.current = null;
        onValueChangeEnd?.(current.current);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <div className="z-compare__item z-compare__after">
        {after}
        {showLabels ? (
          <span className="z-compare__label" data-side="after" aria-hidden="true">
            {text.after}
          </span>
        ) : null}
      </div>
      <div className="z-compare__item z-compare__before">
        {before}
        {showLabels ? (
          <span className="z-compare__label" data-side="before" aria-hidden="true">
            {text.before}
          </span>
        ) : null}
      </div>
      <span className="z-compare__divider" aria-hidden="true" />
      <span
        ref={handleRef}
        className="z-compare__handle"
        role="slider"
        tabIndex={0}
        aria-label={text.slider}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={text.valueText.replace("{value}", String(Math.round(value))).replace("{before}", text.before)}
        aria-orientation={orientation}
        onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
          const next = compareKey(event.key, event.shiftKey, current.current, vertical);
          if (next === undefined) return;
          event.preventDefault();
          update(next);
          onValueChangeEnd?.(next);
        }}
      >
        <Icon name={vertical ? "arrows-up-down" : "arrows-right-left"} size={16} />
      </span>
    </div>
  );
}
