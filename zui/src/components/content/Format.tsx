import type { HTMLAttributes, Ref } from "react";
import { formatDuration, toISODuration, toMs, type DurationInput, type DurationStyle, type DurationUnit } from "../../core/duration";
import { formatByte, formatDate, formatNumber, type ByteSystem } from "../../core/format";
import { cx } from "../../cx";
import { RelativeTime, type RelativeTimeProps } from "./RelativeTime";
import { withRef } from "../../react-compat";

export interface FormatNumberProps extends Omit<HTMLAttributes<HTMLDataElement>, "children"> {
  value: number;
  locale?: string;
  /** Opciones de `Intl.NumberFormat`: `notation: "compact"`, `style: "currency" | "percent" | "unit"`… */
  options?: Intl.NumberFormatOptions;
  ref?: Ref<HTMLDataElement>;
}

/** Número con `Intl.NumberFormat` en un `<data value>` (el valor exacto queda en el marcado). Sin estado. */
export const FormatNumber = withRef(function FormatNumber({ value, locale, options, className, ref, ...rest }: FormatNumberProps) {
  return (
    <data
      {...rest}
      ref={ref}
      className={cx("z-format", className)}
      value={String(value)}
      data-format="number"
      data-locale={locale}
      data-options={options ? JSON.stringify(options) : undefined}
    >
      {formatNumber(value, locale, options)}
    </data>
  );
});

export interface FormatByteProps extends Omit<HTMLAttributes<HTMLDataElement>, "children"> {
  /** Tamaño en bytes. */
  value: number;
  locale?: string;
  /** `decimal` (kB, MB; base 1000) o `binary` (KiB, MiB; base 1024). */
  system?: ByteSystem;
  unitDisplay?: "short" | "long" | "narrow";
  maximumFractionDigits?: number;
  ref?: Ref<HTMLDataElement>;
}

/** Tamaño en bytes legible («1.5 MB», «1.4 MiB») en un `<data value>` con los bytes exactos. Sin estado. */
export const FormatByte = withRef(function FormatByte({
  value,
  locale,
  system = "decimal",
  unitDisplay = "short",
  maximumFractionDigits = 1,
  className,
  ref,
  ...rest
}: FormatByteProps) {
  return (
    <data
      {...rest}
      ref={ref}
      className={cx("z-format", className)}
      value={String(value)}
      data-format="byte"
      data-locale={locale}
      data-system={system}
      data-unit-display={unitDisplay}
      data-fraction={maximumFractionDigits}
    >
      {formatByte(value, locale, { system, unitDisplay, maximumFractionDigits })}
    </data>
  );
});

export interface FormatDateProps extends Omit<HTMLAttributes<HTMLTimeElement>, "children"> {
  /** Fecha civil ISO (`2026-11-20`), instante ISO, milisegundos o `Date`. */
  value: Date | number | string;
  locale?: string;
  /** Opciones de `Intl.DateTimeFormat` (por defecto, `dateStyle: "medium"`). */
  options?: Intl.DateTimeFormatOptions;
  /** Tiempo relativo («hace 3 min») con RelativeTime, que se actualiza solo. */
  relative?: boolean;
  /** Opciones del modo relativo (formato, `numeric`, unidad mínima, `now`). */
  relativeOptions?: Omit<RelativeTimeProps, "value" | "locale">;
  ref?: Ref<HTMLTimeElement>;
}

/** Fecha en un `<time datetime>` con `Intl.DateTimeFormat`, o relativa con `relative` (RelativeTime). */
export const FormatDate = withRef(function FormatDate({
  value,
  locale,
  options,
  relative,
  relativeOptions,
  className,
  ref,
  ...rest
}: FormatDateProps) {
  if (relative) return <RelativeTime {...rest} {...relativeOptions} ref={ref} value={value} locale={locale} className={className} />;
  const { text, datetime } = formatDate(value, locale, options);
  return (
    <time
      {...rest}
      ref={ref}
      className={cx("z-format", className)}
      dateTime={datetime}
      data-format="date"
      data-locale={locale}
      data-options={options ? JSON.stringify(options) : undefined}
    >
      {text}
    </time>
  );
});

export interface FormatDurationProps extends Omit<HTMLAttributes<HTMLTimeElement>, "children"> {
  /** ISO 8601 (`PT1H30M`), milisegundos o partes (`{ hours: 1, minutes: 30 }`). */
  value: DurationInput;
  /** `long` «1 hour, 30 minutes» · `short` «1 hr, 30 min» · `narrow` «1h 30m» · `digital` «1:30:00». */
  format?: DurationStyle;
  /** Unidad mayor del reparto (`hours` para «26 h» en vez de «1 day, 2 h»). */
  largestUnit?: DurationUnit;
  /** Unidad menor que se muestra. */
  smallestUnit?: DurationUnit;
  locale?: string;
  ref?: Ref<HTMLTimeElement>;
}

/** Duración legible en un `<time datetime="PT…">` con `Intl.DurationFormat`. Sin estado. */
export const FormatDuration = withRef(function FormatDuration({
  value,
  format = "short",
  largestUnit,
  smallestUnit,
  locale,
  className,
  ref,
  ...rest
}: FormatDurationProps) {
  const ms = toMs(value);
  return (
    <time
      {...rest}
      ref={ref}
      className={cx("z-format", className)}
      dateTime={toISODuration(ms)}
      data-format="duration"
      data-style={format}
      data-locale={locale}
      data-largest-unit={largestUnit}
      data-smallest-unit={smallestUnit}
    >
      {formatDuration(ms, { style: format, largestUnit, smallestUnit, locale })}
    </time>
  );
});
