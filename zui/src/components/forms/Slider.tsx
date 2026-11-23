"use client";
import { useRef, type ComponentProps, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { isRtl } from "../../core/dir";
import { closestThumb, keyValue, moveThumb, percent, snap, valueAt } from "../../core/slider";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { useFieldControl, useFieldLabel } from "./Field";
import { withRef } from "../../react-compat";

export interface SliderProps extends Omit<ComponentProps<"span">, "children" | "defaultValue" | "onChange"> {
  /** Un valor por tirador, de menor a mayor. */
  value?: number[];
  defaultValue?: number[];
  /** Cada cambio mientras se arrastra o se pulsa una tecla. */
  onValueChange?: (value: number[]) => void;
  /** Al soltar el tirador o tras un cambio con el teclado. */
  onValueCommit?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Pasos mínimos entre dos tiradores. */
  minStepsBetweenThumbs?: number;
  orientation?: "horizontal" | "vertical";
  /** La pista crece en sentido contrario: de derecha a izquierda (o de arriba abajo). */
  inverted?: boolean;
  disabled?: boolean;
  /** Nombre del campo al enviar un formulario; con varios tiradores envía un valor por tirador con el mismo nombre. */
  name?: string;
  form?: string;
  size?: "sm" | "md";
  /** Nombre accesible de cada tirador (uno por valor). */
  thumbLabels?: ReadonlyArray<string>;
  /**
   * Marcas sobre la pista: `true` una por paso (hasta 21), una lista de valores, o `{ value, label }` con texto bajo
   * la marca. Las marcas son decorativas: el valor lo anuncia el tirador.
   */
  marks?: boolean | ReadonlyArray<number | { value: number; label?: string }>;
}

/** Deslizador de uno o varios valores (patrón APG «slider»; rango con dos tiradores). */
export const Slider = withRef(function Slider({
  value: valueProp,
  defaultValue = [0],
  onValueChange,
  onValueCommit,
  min = 0,
  max: maxProp = 100,
  step: stepProp = 1,
  minStepsBetweenThumbs = 0,
  orientation = "horizontal",
  inverted,
  disabled,
  name,
  form,
  size = "md",
  thumbLabels,
  marks,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  onPointerDown,
  ...rest
}: SliderProps) {
  const max = Math.max(min, maxProp);
  const step = stepProp > 0 ? stepProp : 1;
  const [raw, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  const values = raw.map((v) => snap(v, min, max, step));
  const root = useRef<HTMLSpanElement | null>(null);
  const drag = useRef<{ index: number; pointer: number; moved: boolean } | null>(null);
  const current = useRef(values);
  current.current = values;
  // Dentro de un Field, cada tirador sin nombre propio se nombra con la etiqueta del campo.
  const fieldLabel = useFieldLabel();
  const { "aria-describedby": describedBy } = useFieldControl({ "aria-describedby": ariaDescribedBy });
  const vertical = orientation === "vertical";

  // El origen de la pista: abajo en vertical; en horizontal, el inicio de la línea (se lee del DOM: RTL lo invierte).
  const flipped = () => (vertical ? Boolean(inverted) : (root.current ? isRtl(root.current) : false) !== Boolean(inverted));
  const update = (index: number, wanted: number): number[] | null => {
    const next = moveThumb(current.current, index, wanted, min, max, step, minStepsBetweenThumbs);
    if (next) {
      current.current = next;
      setValue(next);
    }
    return next;
  };
  const valueAtPointer = (event: PointerEvent) => {
    const rect = root.current!.getBoundingClientRect();
    const ratio = vertical ? (rect.bottom - event.clientY) / (rect.height || 1) : (event.clientX - rect.left) / (rect.width || 1);
    return valueAt(flipped() ? 1 - ratio : ratio, min, max);
  };

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    onPointerDown?.(event);
    if (event.defaultPrevented || disabled || event.button !== 0 || !values.length) return;
    const wanted = valueAtPointer(event);
    const thumbs = [...event.currentTarget.querySelectorAll<HTMLElement>(":scope > .z-slider__thumb")];
    const grabbed = event.target instanceof Element ? event.target.closest<HTMLElement>(".z-slider__thumb") : null;
    // En la pista: se mueve el tirador más cercano. Sobre un tirador: solo empieza el arrastre.
    const index = grabbed ? thumbs.indexOf(grabbed) : closestThumb(values, wanted);
    event.preventDefault();
    drag.current = { index, pointer: event.pointerId, moved: false };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Puntero sintético o ya liberado: el arrastre sigue mientras lleguen eventos a la pista.
    }
    thumbs[index]?.focus({ preventScroll: true });
    if (!grabbed && update(index, wanted)) drag.current.moved = true;
  };
  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const state = drag.current;
    if (state && event.pointerId === state.pointer && update(state.index, valueAtPointer(event))) state.moved = true;
  };
  const handlePointerEnd = (event: PointerEvent<HTMLSpanElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointer) return;
    drag.current = null;
    if (state.moved) onValueCommit?.(current.current);
  };
  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return;
    const dirX = !vertical && flipped() ? -1 : 1;
    const wanted = keyValue(event.key, event.shiftKey, values[index]!, min, max, step, dirX, vertical && inverted ? -1 : 1);
    if (wanted === undefined) return;
    event.preventDefault();
    const next = update(index, wanted);
    if (next) onValueCommit?.(next);
  };

  // Maquetación calculada: la pista y los tiradores se sitúan por porcentaje. `inset-inline-start` sigue la dirección
  // del texto, así que en RTL la pista crece hacia la izquierda sin leer el DOM en el render.
  const start = vertical ? (inverted ? "top" : "bottom") : inverted ? "insetInlineEnd" : "insetInlineStart";
  const end = vertical ? (inverted ? "bottom" : "top") : inverted ? "insetInlineStart" : "insetInlineEnd";
  const low = values.length > 1 ? percent(Math.min(...values), min, max) : 0;
  const high = percent(Math.max(...values, min), min, max);
  const rangeStyle = { [start]: `${low}%`, [end]: `${100 - high}%` } as CSSProperties;
  const steps = Math.round((max - min) / step);
  const markList: Array<{ value: number; label?: string }> =
    marks === true
      ? steps <= 20
        ? Array.from({ length: steps + 1 }, (_, i) => ({ value: min + i * step }))
        : []
      : Array.isArray(marks)
        ? marks.map((mark) => (typeof mark === "number" ? { value: mark } : mark))
        : [];
  const labelled = markList.some((mark) => mark.label);
  const lowest = values.length > 1 ? Math.min(...values) : min;
  const highest = Math.max(...values, min);

  return (
    <span
      {...rest}
      ref={root}
      className={cx("z-slider", className)}
      data-size={size}
      data-orientation={orientation}
      // Los mismos atributos que lee `@zuccadev-labs/zuix-zui/dom`: el marcado renderizado sirve tal cual sin React.
      data-min={min}
      data-max={max}
      data-step={step}
      data-value={values.join(",")}
      data-disabled={disabled ? "" : undefined}
      data-inverted={inverted ? "" : undefined}
      data-marks={markList.length ? (labelled ? "labels" : "") : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <span className="z-slider__track">
        <span className="z-slider__range" style={rangeStyle} />
      </span>
      {markList.length ? (
        <span className="z-slider__marks" aria-hidden="true">
          {markList.map((mark) => (
            <span
              key={mark.value}
              className="z-slider__mark"
              data-value={mark.value}
              data-in-range={mark.value >= lowest && mark.value <= highest ? "" : undefined}
              // Centrada donde estaría el centro del tirador con ese valor.
              style={
                {
                  [start]: `calc(${percent(mark.value, min, max) / 100} * (100% - var(--z-slider-thumb)) + var(--z-slider-thumb) / 2)`,
                } as CSSProperties
              }
            >
              {mark.label ? <span className="z-slider__mark-label">{mark.label}</span> : null}
            </span>
          ))}
        </span>
      ) : null}
      {values.map((value, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: un tirador es su posición en la lista de valores.
          key={index}
          className="z-slider__thumb"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={thumbLabels?.[index] ?? ariaLabel}
          aria-labelledby={(thumbLabels?.[index] ?? ariaLabel) ? undefined : (ariaLabelledBy ?? fieldLabel)}
          aria-describedby={describedBy}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-orientation={orientation}
          aria-disabled={disabled || undefined}
          data-disabled={disabled ? "" : undefined}
          // El tirador no sobresale de la pista: recorre el ancho menos su propio tamaño.
          style={
            { position: "absolute", [start]: `calc(${percent(value, min, max) / 100} * (100% - var(--z-slider-thumb)))` } as CSSProperties
          }
          onKeyDown={handleKeyDown(index)}
        />
      ))}
      {name
        ? values.map((value, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: un campo por tirador, en el mismo orden.
            <input key={index} type="hidden" name={name} form={form} value={value} disabled={disabled} />
          ))
        : null}
    </span>
  );
});
