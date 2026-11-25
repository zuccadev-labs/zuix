"use client";
import { useEffect, useState, type HTMLAttributes, type Ref } from "react";
import { formatRelative, nextUpdate, toInstant, type RelativeUnit } from "../../core/relative";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface RelativeTimeProps extends Omit<HTMLAttributes<HTMLTimeElement>, "children"> {
  /** Instante: ISO 8601 con zona (`2026-11-19T12:00:00Z`), milisegundos o `Date`. */
  value: number | string | Date;
  /** Etiqueta BCP 47. Por defecto, la del entorno. */
  locale?: string;
  /** Longitud del texto de `Intl.RelativeTimeFormat`. */
  format?: "long" | "short" | "narrow";
  /** `auto` dice «ayer» o «ahora»; `always`, «hace 1 día». */
  numeric?: "always" | "auto";
  /** Unidad más pequeña (p. ej. `minute` para no contar segundos). */
  minUnit?: RelativeUnit;
  /** Formato de la fecha completa del `title`. */
  titleFormat?: Intl.DateTimeFormatOptions;
  /** Ahora, en milisegundos (servidor y pruebas). Por defecto, el reloj, que avanza solo. */
  now?: number;
  ref?: Ref<HTMLTimeElement>;
}

/** «hace 3 min», «en 2 días»: un `<time>` con el instante en `datetime`, la fecha completa en `title` y el texto
 *  que se actualiza con una cadencia que se alarga con la distancia (sin región viva: no interrumpe al lector). */
export const RelativeTime = withRef(function RelativeTime({
  value,
  locale,
  format = "long",
  numeric = "auto",
  minUnit,
  titleFormat = { dateStyle: "full", timeStyle: "short" },
  now,
  className,
  ref,
  ...rest
}: RelativeTimeProps) {
  const then = toInstant(value);
  const [clock, setClock] = useState(() => now ?? Date.now());
  const current = now ?? clock;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `clock` es la dependencia que reprograma el siguiente repintado.
  useEffect(() => {
    if (now !== undefined || then === null) return;
    const id = setTimeout(() => setClock(Date.now()), nextUpdate(then, Date.now()));
    return () => clearTimeout(id);
  }, [now, then, clock]);
  if (then === null) return null;
  let title: string;
  try {
    title = new Intl.DateTimeFormat(locale, titleFormat).format(then);
  } catch {
    title = new Date(then).toISOString();
  }
  return (
    <time
      {...rest}
      ref={ref}
      className={cx("z-relative-time", className)}
      dateTime={new Date(then).toISOString()}
      title={title}
      // El texto depende del reloj: servidor y navegador pueden discrepar en un segundo.
      suppressHydrationWarning
    >
      {formatRelative(then, current, locale, { style: format, numeric, minUnit })}
    </time>
  );
});
