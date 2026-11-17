"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { parse as toDate, rangeText } from "../../core/date";
import { focusQuiet, trapTab } from "../../core/focus";
import { cx } from "../../cx";
import { useControllable, useLayer, usePresence } from "../../primitives/hooks";
import { Popup, Portal, rectOf } from "../../primitives/popup";
import { useMergedRef } from "../../refs";
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
  const auto = useId();
  const valueId = `${auto}-value`;
  const panelId = `${auto}-panel`;
  const panel = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const setButton = useMergedRef(button, ref);
  const native = useRef<HTMLInputElement | null>(null);

  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  const present = usePresence(isOpen, panel);
  const close = (refocus: boolean) => {
    const inside = panel.current?.contains(document.activeElement) ?? false;
    setOpen(false);
    if (refocus && inside) focusQuiet(button.current);
  };
  useLayer(isOpen, {
    contains: (target) => (panel.current?.contains(target) ?? false) || (anchor.current?.contains(target) ?? false),
    onEscape: () => close(true),
    onPointerOutside: () => close(false),
    onFocusOutside: () => close(false),
  });

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
  const formValue = mode === "range" ? rangeText(range) : (single ?? "");

  // Formulario: `form.reset()` devuelve el valor inicial, y un campo obligatorio vacío lleva el foco al botón.
  const initial = useRef(props.defaultValue ?? null);
  useEffect(() => {
    const field = native.current;
    const form = field?.form;
    if (!field) return;
    const onReset = () => setTimeout(() => setInner(initial.current), 0);
    const onInvalid = () => focusQuiet(button.current);
    form?.addEventListener("reset", onReset);
    field.addEventListener("invalid", onInvalid);
    return () => {
      form?.removeEventListener("reset", onReset);
      field.removeEventListener("invalid", onInvalid);
    };
  });

  const shared = { min, max, isDateDisabled, weekStartsOn, locale, previousMonthLabel, nextMonthLabel };
  // Foco inicial: el día elegido (o el inicio del rango) o, sin valor, hoy.
  const focusDay = () => {
    const start = (mode === "range" ? range?.from : single) ?? todayISO();
    (panel.current?.querySelector<HTMLElement>(`.z-calendar__day[data-date="${start}"]`) ?? panel.current?.querySelector<HTMLElement>('.z-calendar__day[tabindex="0"]'))?.focus();
  };

  return (
    <>
      <span ref={anchor} className={cx("z-select", "z-datepicker", className)} data-size={size} data-block={block || undefined} data-invalid={isInvalid || undefined} data-disabled={disabled || undefined}>
        <button
          {...control}
          ref={setButton}
          type="button"
          className="z-select__control"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          // El nombre accesible incluye la fecha elegida: con `aria-label` a secas el lector de pantalla no la diría.
          // Etiquetado por un `Field`, la fecha va como descripción.
          aria-labelledby={ariaLabelledBy ? `${ariaLabelledBy} ${valueId}` : undefined}
          aria-describedby={[control["aria-describedby"], ariaLabel || ariaLabelledBy ? undefined : valueId].filter(Boolean).join(" ") || undefined}
          data-state={isOpen ? "open" : "closed"}
          data-placeholder={text ? undefined : ""}
          disabled={disabled}
          onClick={() => (isOpen ? close(true) : setOpen(true))}
        >
          {ariaLabel && !ariaLabelledBy ? <span className="z-sr-only">{ariaLabel}</span> : null}
          <span className="z-select__value" id={valueId}>
            {text || placeholder}
          </span>
        </button>
        <span className="z-select__chevron">
          <Icon name={mode === "range" ? "calendar-date-range" : "calendar"} size={ICON_SIZE[size]} />
        </span>
        {name || isRequired ? (
          // Campo nativo oculto: envía el valor y da la validación `required` del navegador. Un `button` no admite
          // `aria-required`; que el campo es obligatorio lo dicen la etiqueta del Field y el mensaje del navegador.
          <input ref={native} type="text" className="z-native-input" aria-hidden="true" tabIndex={-1} name={name} value={formValue} required={isRequired} disabled={disabled} onChange={noop} />
        ) : null}
      </span>
      {present ? (
        <Portal anchor={anchor}>
          <Popup
            ref={panel}
            id={panelId}
            open={isOpen}
            anchorRect={() => rectOf(anchor.current)}
            watch={anchor}
            placement={align === "center" ? "bottom" : `bottom-${align}`}
            gap={4}
            role="dialog"
            aria-label={calendarLabel}
            className={cx("z-liquid z-popover z-datepicker__panel", popupClassName)}
            // El foco inicial va al día activo, no al primer botón.
            onShown={focusDay}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (panel.current && trapTab(panel.current, event)) event.preventDefault();
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
                  if (next.from && next.to) close(true);
                }}
              />
            ) : (
              <Calendar
                {...shared}
                value={single}
                onValueChange={(next) => {
                  setInner(next);
                  props.onValueChange?.(next);
                  close(true);
                }}
              />
            )}
          </Popup>
        </Portal>
      ) : null}
    </>
  );
}

const noop = () => {};
