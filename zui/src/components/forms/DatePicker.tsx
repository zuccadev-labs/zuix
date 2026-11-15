"use client";
import { useId, useMemo, useRef, useState, type Ref } from "react";
import { Popover as RadixPopover } from "radix-ui";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { Calendar, todayISO, type DateRange } from "./Calendar";
import { useFieldControl } from "./Field";

interface DatePickerBaseProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Primera fecha elegible, `YYYY-MM-DD`. */
  min?: string;
  /** Última fecha elegible, `YYYY-MM-DD`. */
  max?: string;
  isDateDisabled?: (date: string) => boolean;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Etiqueta BCP 47 para el texto del campo y el calendario. */
  locale?: string;
  /** Formato del texto del campo. Por defecto `{ dateStyle: "medium" }`. */
  formatOptions?: Intl.DateTimeFormatOptions;
  placeholder?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Nombre del campo al enviar un formulario. En rango envía `desde/hasta`. */
  name?: string;
  /** Ancho completo (por defecto) o intrínseco. */
  block?: boolean;
  /** Alineación del popup respecto al campo. */
  align?: "start" | "center" | "end";
  /** Nombre accesible del panel del calendario. */
  calendarLabel?: string;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Clase de la envoltura. */
  className?: string;
  /** Clase del popup. */
  popupClassName?: string;
  ref?: Ref<HTMLButtonElement>;
}

export interface DatePickerSingleProps extends DatePickerBaseProps {
  mode?: "single";
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
}

export interface DatePickerRangeProps extends DatePickerBaseProps {
  mode: "range";
  value?: DateRange | null;
  defaultValue?: DateRange | null;
  onValueChange?: (value: DateRange) => void;
}

export type DatePickerProps = DatePickerSingleProps | DatePickerRangeProps;

const toDate = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));

/** Campo de fecha con calendario propio en un popover. Valor ISO `YYYY-MM-DD`, o `{ from, to }` en modo rango. */
export function DatePicker(props: DatePickerProps) {
  const {
    mode = "single",
    open,
    defaultOpen = false,
    onOpenChange,
    min,
    max,
    isDateDisabled,
    weekStartsOn,
    locale,
    formatOptions,
    placeholder = mode === "range" ? "Select dates" : "Select date",
    size = "md",
    invalid,
    disabled,
    required,
    name,
    block = true,
    align = "start",
    calendarLabel = "Choose date",
    previousMonthLabel,
    nextMonthLabel,
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": describedBy,
    className,
    popupClassName,
    ref,
  } = props;
  const { invalid: isInvalid, required: isRequired, ...control } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const anchor = useRef<HTMLSpanElement | null>(null);
  const valueId = `${useId()}-value`;
  const panel = useRef<HTMLDivElement | null>(null);

  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };

  const [inner, setInner] = useState<string | DateRange | null>(props.defaultValue ?? null);
  const raw = props.value === undefined ? inner : props.value;
  const single = typeof raw === "string" && raw ? raw : null;
  const range = raw && typeof raw === "object" ? raw : null;

  const formatter = useMemo(() => new Intl.DateTimeFormat(locale, { ...(formatOptions ?? { dateStyle: "medium" }), timeZone: "UTC" }), [locale, formatOptions]);
  const show = (iso: string) => {
    const date = toDate(iso);
    return Number.isNaN(date.getTime()) ? iso : formatter.format(date);
  };
  const text = mode === "range" ? (range?.from ? `${show(range.from)} – ${range.to ? show(range.to) : "…"}` : "") : single ? show(single) : "";
  const formValue = mode === "range" ? (range?.from ? `${range.from}/${range.to ?? ""}` : "") : (single ?? "");

  const shared = { min, max, isDateDisabled, weekStartsOn, locale, previousMonthLabel, nextMonthLabel };
  // Foco inicial: el día elegido (o el inicio del rango) o, sin valor, hoy.
  const focusDay = () => {
    const start = (mode === "range" ? range?.from : single) ?? todayISO();
    (panel.current?.querySelector<HTMLElement>(`.z-calendar__day[data-date="${start}"]`) ?? panel.current?.querySelector<HTMLElement>('.z-calendar__day[tabindex="0"]'))?.focus();
  };

  return (
    <RadixPopover.Root open={isOpen} onOpenChange={setOpen}>
      <RadixPopover.Anchor asChild>
        <span ref={anchor} className={cx("z-select", "z-datepicker", className)} data-size={size} data-block={block || undefined} data-invalid={isInvalid || undefined} data-disabled={disabled || undefined}>
          <RadixPopover.Trigger asChild>
            <button
              {...control}
              ref={ref}
              type="button"
              className="z-select__control"
              // El nombre accesible incluye la fecha elegida: con `aria-label` a secas el lector de pantalla no la diría.
              // Etiquetado por un `Field`, la fecha va como descripción.
              aria-labelledby={ariaLabelledBy ? `${ariaLabelledBy} ${valueId}` : undefined}
              aria-describedby={[control["aria-describedby"], ariaLabel || ariaLabelledBy ? undefined : valueId].filter(Boolean).join(" ") || undefined}
              aria-required={isRequired}
              data-placeholder={text ? undefined : ""}
              disabled={disabled}
            >
              {ariaLabel && !ariaLabelledBy ? <span className="z-sr-only">{ariaLabel}</span> : null}
              <span className="z-select__value" id={valueId}>{text || placeholder}</span>
            </button>
          </RadixPopover.Trigger>
          <span className="z-select__chevron">
            <Icon name={mode === "range" ? "calendar-date-range" : "calendar"} size={ICON_SIZE[size]} />
          </span>
          {name ? <input type="hidden" name={name} value={formValue} /> : null}
        </span>
      </RadixPopover.Anchor>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className={cx("z-liquid z-popover z-datepicker__panel", popupClassName)}
          side="bottom"
          align={align}
          sideOffset={4}
          collisionPadding={8}
          ref={panel}
          aria-label={calendarLabel}
          // El foco inicial va al día activo, no al primer botón. Se mueve aquí y no al montar el calendario:
          // dentro de un Modal, la trampa de foco del diálogo sigue activa hasta este momento y lo devolvería al campo.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusDay();
          }}
        >
          {props.mode === "range" ? (
            <Calendar
              {...shared}
              mode="range"
              value={range}
              onValueChange={(next) => {
                setInner(next);
                props.onValueChange?.(next);
                if (next.from && next.to) setOpen(false);
              }}
            />
          ) : (
            <Calendar
              {...shared}
              value={single}
              onValueChange={(next) => {
                setInner(next);
                props.onValueChange?.(next);
                setOpen(false);
              }}
            />
          )}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
