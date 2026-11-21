"use client";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type PointerEvent, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { clampNumber, formatNumber, parseNumber, stepNumber } from "../../core/number";
import { cx } from "../../cx";
import { useLatest } from "../../primitives/hooks";
import { useMergedRef } from "../../refs";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl } from "./Field";

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step" | "inputMode"
>;

export interface NumberInputProps extends NativeProps {
  /** Valor; `null` es vacío. */
  value?: number | null;
  defaultValue?: number | null;
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Paso de Re Pág y Av Pág (por defecto, 10 pasos). */
  largeStep?: number;
  /** Formato con `Intl.NumberFormat` (moneda, porcentaje, unidad, decimales). Se aplica al salir del campo. */
  formatOptions?: Intl.NumberFormatOptions;
  /** Locale del formato y de la lectura; por defecto, el del navegador. */
  locale?: string;
  /** Rueda del ratón sobre el campo enfocado (desactivada por defecto). */
  wheel?: boolean;
  /**
   * Botones de paso: juntos al final (− +, por defecto), a los lados (− valor +), apilados al final (más compactos,
   * pero de menos de 24 px de alto en los tamaños sm y md) o ninguno.
   */
  controls?: "end" | "split" | "stacked" | "none";
  incrementLabel?: string;
  decrementLabel?: string;
  size?: ControlSize;
  invalid?: boolean;
  /** Clase de la envoltura. */
  className?: string;
  inputClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Retardo antes de repetir al mantener pulsado un botón de paso, y cadencia de la repetición. */
const HOLD_DELAY = 400;
const HOLD_EVERY = 60;

/**
 * Campo numérico (patrón APG «spinbutton»): texto libre en el formato del locale, flechas para el paso, Re Pág y
 * Av Pág para el paso largo, Inicio y Fin para los topes, y botones que repiten al mantenerlos. No usa
 * `type="number"`: conserva el formato y no cambia con la rueda por accidente.
 */
export function NumberInput({
  value,
  defaultValue = null,
  onValueChange,
  min,
  max,
  step = 1,
  largeStep,
  formatOptions,
  locale,
  wheel = false,
  controls = "end",
  incrementLabel = "Increase",
  decrementLabel = "Decrease",
  size = "md",
  invalid,
  disabled,
  readOnly,
  required,
  name,
  form,
  id,
  className,
  inputClassName,
  onBlur,
  onKeyDown,
  "aria-describedby": describedBy,
  ref,
  ...rest
}: NumberInputProps) {
  const auto = useId();
  const {
    invalid: isInvalid,
    id: fieldId,
    ...field
  } = useFieldControl({
    id,
    invalid,
    required,
    "aria-describedby": describedBy,
  });
  // El id del Field (enlaza su <label>) o, sin Field, uno propio para aria-controls.
  const control = { ...field, id: fieldId ?? `${auto}-input` };
  const [inner, setInner] = useState<number | null>(defaultValue);
  const current = value === undefined ? inner : value;
  const percent = formatOptions?.style === "percent";
  const show = (n: number | null) => formatNumber(n, locale, formatOptions);
  // Texto mientras se edita; `null` muestra el valor formateado.
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const setRef = useMergedRef(input, ref);
  const range = { min, max, step };
  const big = largeStep ?? step * 10;

  const commit = (next: number | null) => {
    if (value === undefined) setInner(next);
    if (next !== current) onValueChange?.(next);
  };
  const nudge = (delta: number, by = step) => {
    if (disabled || readOnly) return;
    const typed = draft === null ? current : parseNumber(draft, locale, percent);
    // El paso largo es un múltiplo del paso: el valor sigue en la rejilla de `step`.
    const next = stepNumber(typed, delta * Math.max(1, Math.round(by / step)), range);
    setDraft(null);
    commit(next);
  };
  const latest = useLatest({ nudge });

  // Rueda: solo con el campo enfocado y la opción activa; el listener no es pasivo para poder cancelar el desplazamiento.
  useEffect(() => {
    const el = input.current;
    if (!el || !wheel) return;
    const onWheel = (event: WheelEvent) => {
      if (document.activeElement !== el || event.deltaY === 0) return;
      event.preventDefault();
      latest.current.nudge(event.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wheel, latest]);

  // Mantener pulsado un botón repite el paso.
  const hold = useRef<{ timer?: ReturnType<typeof setTimeout>; listening?: AbortController }>({});
  const release = () => {
    clearTimeout(hold.current.timer);
    hold.current.listening?.abort();
    hold.current.listening = undefined;
  };
  useEffect(
    () => () => {
      clearTimeout(hold.current.timer);
      hold.current.listening?.abort();
    },
    [],
  );
  const press = (delta: number) => (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    input.current?.focus({ preventScroll: true });
    latest.current.nudge(delta);
    const repeat = (wait: number) => {
      hold.current.timer = setTimeout(() => {
        latest.current.nudge(delta);
        repeat(HOLD_EVERY);
      }, wait);
    };
    release();
    repeat(HOLD_DELAY);
    // El botón puede deshabilitarse al llegar al tope: se suelta escuchando a la ventana, no a él. Los dos
    // listeners se retiran juntos al soltar (con `once`, el que no se disparaba se quedaba en la ventana).
    const listening = new AbortController();
    hold.current.listening = listening;
    window.addEventListener("pointerup", release, { signal: listening.signal });
    window.addEventListener("pointercancel", release, { signal: listening.signal });
  };

  const jump = (to: number) => {
    setDraft(null);
    commit(to);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        nudge(event.key === "ArrowUp" ? 1 : -1);
        break;
      case "PageUp":
      case "PageDown":
        event.preventDefault();
        nudge(event.key === "PageUp" ? 1 : -1, big);
        break;
      case "Home":
      case "End": {
        const to = event.key === "Home" ? min : max;
        if (to === undefined) return;
        event.preventDefault();
        jump(to);
        break;
      }
      case "Enter":
        if (draft !== null) {
          const parsed = parseNumber(draft, locale, percent);
          setDraft(null);
          commit(parsed === null ? null : clampNumber(parsed, range));
        }
        break;
      default:
    }
  };

  const atMin = current !== null && min !== undefined && current <= min;
  const atMax = current !== null && max !== undefined && current >= max;
  const stepButton = (direction: 1 | -1) => (
    <button
      type="button"
      className="z-input__action z-number__step"
      data-step={direction > 0 ? "up" : "down"}
      tabIndex={-1}
      aria-label={direction > 0 ? incrementLabel : decrementLabel}
      aria-controls={control.id}
      disabled={disabled || readOnly || (direction > 0 ? atMax : atMin)}
      onPointerDown={press(direction)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onClick={(event) => {
        // Activación sin puntero (lector de pantalla): un paso.
        if (event.detail === 0) nudge(direction);
      }}
    >
      <Icon
        name={controls === "stacked" ? (direction > 0 ? "chevron-up" : "chevron-down") : direction > 0 ? "plus" : "minus"}
        size={controls === "stacked" ? ICON_SIZE[size] - 2 : ICON_SIZE[size]}
      />
    </button>
  );

  return (
    <span
      className={cx("z-input", "z-number", className)}
      data-size={size}
      data-controls={controls}
      data-invalid={isInvalid || undefined}
      data-disabled={disabled || undefined}
      // Configuración legible por el modo DOM (zui/dom): el mismo marcado sirve sin React.
      data-value={current ?? undefined}
      data-min={min}
      data-max={max}
      data-step={step === 1 ? undefined : step}
      data-large-step={largeStep}
      data-locale={locale}
      data-format={formatOptions ? JSON.stringify(formatOptions) : undefined}
      data-wheel={wheel || undefined}
    >
      {controls === "split" ? stepButton(-1) : null}
      <input
        {...rest}
        {...control}
        ref={setRef}
        type="text"
        role="spinbutton"
        inputMode={step % 1 === 0 && (min ?? 0) >= 0 && !percent ? "numeric" : "decimal"}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        readOnly={readOnly}
        form={form}
        aria-valuenow={current ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={current === null ? undefined : show(current)}
        className={cx("z-input__control", "z-number__input", inputClassName)}
        value={draft ?? show(current)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (draft !== null) {
            const parsed = parseNumber(draft, locale, percent);
            setDraft(null);
            commit(parsed === null ? null : clampNumber(parsed, range));
          }
          onBlur?.(event);
        }}
      />
      {controls === "split" ? stepButton(1) : null}
      {controls === "stacked" ? (
        <span className="z-number__steps">
          {stepButton(1)}
          {stepButton(-1)}
        </span>
      ) : controls === "end" ? (
        <span className="z-number__steps" data-layout="row">
          {stepButton(-1)}
          {stepButton(1)}
        </span>
      ) : null}
      {name ? <input type="hidden" name={name} form={form} value={current ?? ""} /> : null}
    </span>
  );
}
