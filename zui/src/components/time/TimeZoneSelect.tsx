"use client";
import { useMemo, useState } from "react";
import { groupZones, zoneMatches, zoneOptions, type ZoneOption } from "../../core/timezones";
import { Combobox, type ComboboxOption, type ComboboxOptionGroup, type ComboboxProps } from "../forms/Combobox";

export interface TimeZoneSelectProps
  extends Omit<ComboboxProps, "options" | "filter" | "multiple" | "allowCustomValue" | "onValueChange" | "icon"> {
  /** Zonas que se ofrecen (IANA). Por defecto, todas las del navegador. */
  zones?: readonly string[];
  /** Nombre visible de cada zona («Office», «Home»); por defecto, la ciudad. */
  names?: Readonly<Record<string, string>>;
  /** Desfase en cada opción («GMT+1»). */
  showOffset?: boolean;
  /** Hora actual en cada opción. */
  showTime?: boolean;
  /** Grupos por región («Europe») o por desfase; `none`, lista plana ordenada por desfase. */
  groupBy?: "region" | "offset" | "none";
  locale?: string;
  onValueChange?: (timeZone: string | null, option: ZoneOption | null) => void;
}

/**
 * Selector de zona horaria buscable sobre Combobox: opciones «Madrid · GMT+1 · 10:42» agrupadas por región. Se
 * busca por ciudad, por identificador IANA o por desfase («+5:30»). Desfases y horas se calculan al abrir.
 */
export function TimeZoneSelect({
  zones,
  names,
  showOffset = true,
  showTime = true,
  groupBy = "region",
  locale,
  onValueChange,
  placeholder = "Search a time zone",
  "aria-label": ariaLabel = "Time zone",
  ...rest
}: TimeZoneSelectProps) {
  // La hora de las opciones se renueva al abrir la lista (cada vez que cambia el texto o se despliega).
  const [stamp, setStamp] = useState(() => Date.now());
  const options = useMemo(
    () => zoneOptions({ zones, at: stamp, locale, showOffset, showTime, names }),
    [zones, stamp, locale, showOffset, showTime, names],
  );
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const entries: (ComboboxOption | ComboboxOptionGroup)[] =
    groupBy === "none"
      ? options.map((o) => ({ value: o.value, label: o.label }))
      : groupZones(options, groupBy).map((g) => ({ label: g.label, options: g.options.map((o) => ({ value: o.value, label: o.label })) }));
  return (
    <Combobox
      {...rest}
      aria-label={ariaLabel}
      placeholder={placeholder}
      icon="globe-alt"
      options={entries}
      filter={(option, text) =>
        zoneMatches({ value: option.value, label: option.label, offsetLabel: byValue.get(option.value)?.offsetLabel ?? "" }, text)
      }
      onInputChange={(text) => {
        if (Date.now() - stamp > 30_000) setStamp(Date.now());
        rest.onInputChange?.(text);
      }}
      onValueChange={(value) => onValueChange?.(value, value ? (byValue.get(value) ?? null) : null)}
    />
  );
}
