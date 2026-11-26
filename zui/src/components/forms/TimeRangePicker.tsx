"use client";
import { useLocale } from "../../locale";
import { useEffect, useId, useRef, useState, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { formatDuration } from "../../core/duration";
import { focusQuiet } from "../../core/focus";
import {
  parseTimeRange,
  sameTimeRange,
  TIME_RANGE_LABELS,
  TIME_RANGE_MESSAGES,
  timeRangeInfo,
  timeRangeText,
  type TimeRange,
  type TimeRangeInfo,
  type TimeRangeMessages,
  type TimeRangePickerLabels,
} from "../../core/time-range";
import { fill } from "../../core/vnode";
import { cx } from "../../cx";
import { useLatest } from "../../primitives/hooks";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { useFieldControl, useFieldLabel } from "./Field";
import { TimePicker } from "./TimePicker";
import { withRef } from "../../react-compat";

export type { TimeRange, TimeRangeInfo, TimeRangeMessages, TimeRangePickerLabels };

export interface TimeRangePickerProps {
  value?: TimeRange | null;
  defaultValue?: TimeRange | null;
  /** Rango nuevo y su estado (duración, si cruza la medianoche y por qué no vale). */
  onValueChange?: (value: TimeRange, info: TimeRangeInfo) => void;
  /** El fin puede caer al día siguiente (un turno de noche): se marca con un indicador. */
  allowOvernight?: boolean;
  /** Duración mínima y máxima en minutos. */
  minDuration?: number;
  maxDuration?: number;
  /** Muestra la duración junto al rango. */
  showDuration?: boolean;
  /** Panel de cada hora: columnas o franjas. */
  variant?: "columns" | "list";
  /** Minutos entre franjas (`variant="list"`). */
  step?: number;
  minuteStep?: number;
  hourCycle?: 12 | 24;
  showSeconds?: boolean;
  locale?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Nombre del campo: el formulario recibe `inicio/fin` (`22:00/06:00`). */
  name?: string;
  labels?: Partial<TimeRangePickerLabels>;
  /** Mensajes de validez (en el campo nativo, los muestra un Field con `validate`). */
  messages?: Partial<TimeRangeMessages>;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Rango de horas: dos TimePicker (inicio y fin) en un grupo. Comprueba que el fin sea posterior al inicio o, con
 * `allowOvernight`, que cruce la medianoche, y lo marca con un indicador. Valor `{ start, end }` en `HH:mm`.
 */
export const TimeRangePicker = withRef(function TimeRangePicker({
  value,
  defaultValue,
  onValueChange,
  allowOvernight = false,
  minDuration,
  maxDuration,
  showDuration = true,
  variant,
  step,
  minuteStep,
  hourCycle,
  showSeconds,
  locale,
  size = "md",
  invalid,
  disabled,
  required,
  name,
  labels: own,
  messages: ownMessages,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  className,
  ref,
}: TimeRangePickerProps) {
  const labels = { ...useLocale().messages("timeRange", TIME_RANGE_LABELS), ...own };
  const messages = { ...TIME_RANGE_MESSAGES, ...ownMessages };
  const auto = useId();
  const {
    invalid: fieldInvalid,
    required: isRequired,
    ...control
  } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const fieldLabel = useFieldLabel();
  const base = control.id ?? auto;
  const metaId = `${auto}-meta`;
  const [inner, setInner] = useState<TimeRange>(() => ({ start: defaultValue?.start ?? null, end: defaultValue?.end ?? null }));
  const range = value === undefined ? inner : { start: value?.start ?? null, end: value?.end ?? null };
  const rules = { allowOvernight, minDuration, maxDuration };
  const info = timeRangeInfo(range, rules);
  const native = useRef<HTMLInputElement | null>(null);
  const message = info.error ? messages[info.error] : "";
  const bad = fieldInvalid || Boolean(info.error);
  // Valor con el que se montó: el que devuelve `form.reset()`.
  const mounted = useRef(value ?? defaultValue);
  const latest = useLatest({ defaultValue: mounted.current, onValueChange, rules: { allowOvernight, minDuration, maxDuration } });

  // Validez nativa: el mensaje del rango va en el campo oculto (lo muestra un Field con `validate`).
  useEffect(() => {
    native.current?.setCustomValidity(message);
  }, [message]);
  // `form.reset()` vuelve al valor inicial; un rango obligatorio vacío lleva el foco a la primera hora.
  useEffect(() => {
    const field = native.current;
    const form = field?.form;
    if (!field) return;
    const onReset = () =>
      setTimeout(() => {
        const next = { start: latest.current.defaultValue?.start ?? null, end: latest.current.defaultValue?.end ?? null };
        setInner(next);
        latest.current.onValueChange?.(next, timeRangeInfo(next, latest.current.rules));
      }, 0);
    const onInvalid = () => focusQuiet(field.parentElement?.querySelector<HTMLElement>('[role="spinbutton"]'));
    form?.addEventListener("reset", onReset);
    field.addEventListener("invalid", onInvalid);
    return () => {
      form?.removeEventListener("reset", onReset);
      field.removeEventListener("invalid", onInvalid);
    };
  }, [latest]);

  const change = (next: TimeRange) => {
    if (sameTimeRange(next, range)) return;
    if (value === undefined) setInner(next);
    onValueChange?.(next, timeRangeInfo(next, rules));
  };
  const shared = { variant, step, minuteStep, hourCycle, showSeconds, locale, size, disabled, invalid: bad };
  const duration =
    showDuration && info.duration !== null
      ? fill(labels.duration, { duration: formatDuration(info.duration * 60_000, { style: "short", smallestUnit: "minutes", locale }) })
      : "";
  return (
    <div
      ref={ref}
      role="group"
      className={cx("z-timerange", className)}
      data-size={size}
      data-overnight={info.overnight || undefined}
      data-invalid={bad || undefined}
      data-disabled={disabled || undefined}
      data-allow-overnight={allowOvernight || undefined}
      data-name={name}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : (labelledBy ?? fieldLabel)}
      aria-describedby={[control["aria-describedby"], metaId].filter(Boolean).join(" ")}
    >
      <TimePicker
        id={`${base}-start`}
        aria-label={labels.start}
        pickerLabel={labels.start}
        value={range.start}
        onValueChange={(start) => change({ start, end: range.end })}
        {...shared}
      />
      <span className="z-timerange__sep" aria-hidden="true">
        <Icon name="arrow-right" size={ICON_SIZE[size]} />
      </span>
      <TimePicker
        id={`${base}-end`}
        aria-label={labels.end}
        pickerLabel={labels.end}
        value={range.end}
        onValueChange={(end) => change({ start: range.start, end })}
        {...shared}
      />
      <span className="z-timerange__meta" id={metaId} aria-live="polite">
        {info.overnight ? (
          <span className="z-badge z-timerange__overnight" data-tone="info" title={labels.overnightDescription}>
            <Icon name="moon" size={12} />
            <span aria-hidden="true">{labels.overnight}</span>
            <span className="z-sr-only">{labels.overnightDescription}</span>
          </span>
        ) : null}
        {duration ? <span className="z-timerange__duration">{duration}</span> : null}
      </span>
      <input
        ref={native}
        type="text"
        className="z-native-input"
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        value={timeRangeText(range)}
        required={isRequired}
        disabled={disabled}
        onChange={(event) => change(parseTimeRange(event.target.value))}
        // El navegador enfoca este campo al informar de un error: el foco pasa a la primera hora.
        onFocus={(event) => focusQuiet(event.currentTarget.parentElement?.querySelector<HTMLElement>('[role="spinbutton"]'))}
      />
    </div>
  );
});
