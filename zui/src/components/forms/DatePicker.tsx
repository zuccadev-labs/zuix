"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { formatDateRange, toISODate } from "../../core/date";
import { readSelection, selectionText, valueText, type CalendarMode, type CalendarValue, type CalendarView } from "../../core/calendar";
import { focusQuiet, trapTab } from "../../core/focus";
import { cx } from "../../cx";
import { useControllable, useLayer, usePresence } from "../../primitives/hooks";
import { Popup, Portal, rectOf } from "../../primitives/popup";
import { useMergedRef } from "../../refs";
import { Button } from "../actions/Button";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { Calendar, todayISO, type CalendarLegend, type CalendarPreset, type CalendarProps, type DateRange } from "./Calendar";
import { useFieldControl } from "./Field";

/** Props del calendario que el selector reenvía tal cual. */
type ForwardedCalendarProps = Pick<
  CalendarProps,
  | "numberOfMonths"
  | "pagedNavigation"
  | "captionLayout"
  | "isDateUnavailable"
  | "modifiers"
  | "showOutsideDays"
  | "outsideDaySelectable"
  | "fixedWeeks"
  | "showWeekNumber"
  | "weekNumbering"
  | "weekdayFormat"
  | "today"
  | "showTodayButton"
  | "todayLabel"
  | "renderDay"
  | "getDayDescription"
  | "cellSize"
  | "minRange"
  | "maxRange"
  | "rangeCrossesUnavailable"
  | "allowSingleDayRange"
  | "weekLabel"
  | "unavailableLabel"
  | "monthLabel"
  | "yearLabel"
  | "chooseMonthLabel"
  | "chooseYearLabel"
  | "maxView"
>;

interface DatePickerBaseProps extends ForwardedCalendarProps {
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
  /** Texto propio del campo para un valor (sustituye a `formatOptions`). */
  formatValue?: (value: CalendarValue) => string;
  /** Valor que envía el formulario. Por defecto, el texto ISO (`desde/hasta` en rango). */
  serialize?: (value: CalendarValue) => string;
  /** Texto del campo con más de dos fechas en modo `multiple`. Por defecto «N dates». */
  formatCount?: (count: number) => string;
  placeholder?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Nombre del campo al enviar un formulario. En rango envía `desde/hasta`; en múltiple, un campo por fecha. */
  name?: string;
  /** Ancho completo (por defecto) o intrínseco. */
  block?: boolean;
  /** Alineación del popup respecto al campo. */
  align?: "start" | "center" | "end";
  /** Atajos al lado del mes. */
  presets?: CalendarPreset[];
  presetsLabel?: string;
  /** Leyenda al pie del calendario. */
  legend?: CalendarLegend;
  /** Cierra al elegir. Por defecto: fecha única sí; rango al elegir el fin; múltiple no. */
  closeOnSelect?: boolean;
  /** El valor solo cambia con «Aplicar»; «Cancelar» y Escape lo descartan. */
  confirm?: boolean;
  applyLabel?: string;
  cancelLabel?: string;
  /** Resumen del pie con `confirm`. Por defecto, el rango o la fecha con `Intl`. */
  summary?: (value: CalendarValue) => ReactNode;
  /** Nombre accesible del panel del calendario. */
  calendarLabel?: string;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  /** Vista y unidad del valor: `month` (MonthPicker) o `year` (YearPicker). */
  minView?: CalendarView;
  /** `week`: se elige una semana entera (WeekPicker). */
  selectionUnit?: "day" | "week";
  /** Icono del campo. */
  icon?: "calendar" | "calendar-date-range" | "calendar-days";
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
  value?: string | null | { year: number; month: number; day: number };
  defaultValue?: string | null | { year: number; month: number; day: number };
  onValueChange?: (value: string | null) => void;
}

export interface DatePickerRangeProps extends DatePickerBaseProps {
  mode: "range";
  value?: DateRange | null;
  defaultValue?: DateRange | null;
  onValueChange?: (value: DateRange) => void;
}

export interface DatePickerMultipleProps extends DatePickerBaseProps {
  mode: "multiple";
  value?: string[] | null;
  defaultValue?: string[] | null;
  onValueChange?: (value: string[]) => void;
  maxSelected?: number;
}

export type DatePickerProps = DatePickerSingleProps | DatePickerRangeProps | DatePickerMultipleProps;

const normalize = (raw: unknown) => (raw && typeof raw === "object" && !Array.isArray(raw) && "day" in raw ? toISODate(raw) : raw);

/** Campo de fecha con calendario propio en un popover. Valor ISO `YYYY-MM-DD`, `{ from, to }` en rango o una lista. */
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
    formatValue,
    formatCount,
    serialize,
    placeholder = mode === "single" ? "Select date" : "Select dates",
    size = "md",
    invalid,
    disabled,
    required,
    name,
    block = true,
    align = "start",
    presets,
    presetsLabel,
    legend,
    closeOnSelect,
    confirm = false,
    applyLabel = "Apply",
    cancelLabel = "Cancel",
    summary,
    calendarLabel = "Choose date",
    previousMonthLabel,
    nextMonthLabel,
    minView = "day",
    selectionUnit,
    icon,
    id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": describedBy,
    className,
    popupClassName,
    ref,
    // Lo que queda es del calendario.
    value: _value,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    ...calendarProps
  } = props as DatePickerProps & { maxSelected?: number };
  const {
    invalid: isInvalid,
    required: isRequired,
    ...control
  } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
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

  const [inner, setInner] = useState<unknown>(() => normalize(props.defaultValue ?? null));
  const raw = props.value === undefined ? inner : normalize(props.value);
  const selection = readSelection(mode, raw, minView);
  const value = (mode === "single" ? selection.single : mode === "range" ? selection.range : selection.multiple) as CalendarValue;

  // Borrador con `confirm`: el calendario trabaja sobre él y el valor solo cambia al aplicar.
  const [draft, setDraft] = useState<CalendarValue>(value);
  // biome-ignore lint/correctness/useExhaustiveDependencies: el borrador se reinicia solo al abrir; mientras está abierto es del usuario.
  useEffect(() => {
    if (isOpen) setDraft(value);
  }, [isOpen]);

  const empty = mode === "range" ? !selection.range.from : mode === "multiple" ? !selection.multiple.length : !selection.single;
  const text = empty
    ? ""
    : formatValue
      ? formatValue(value)
      : selectionText(mode, selection, { locale, format: formatOptions, unit: minView, count: formatCount });
  const formValue = serialize ? (empty ? "" : serialize(value)) : valueText(mode, selection);

  // Formulario: `form.reset()` devuelve el valor inicial, y un campo obligatorio vacío lleva el foco al botón.
  const initial = useRef(normalize(props.defaultValue ?? null));
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

  const emit = (next: CalendarValue) => {
    setInner(next);
    (props.onValueChange as ((v: CalendarValue) => void) | undefined)?.(next);
  };

  const onCalendarChange = (next: CalendarValue) => {
    if (confirm) {
      setDraft(next);
      return;
    }
    emit(next);
    const picked = readSelection(mode, next, minView);
    const done = mode === "single" || (mode === "range" && Boolean(picked.range.from && picked.range.to));
    const shouldClose = (closeOnSelect ?? mode !== "multiple") && done;
    if (shouldClose) close(true);
  };

  // Foco inicial: el valor elegido (o el inicio del rango) o, sin valor, hoy.
  const focusDay = () => {
    const start = (mode === "range" ? selection.range.from : mode === "multiple" ? selection.multiple[0] : selection.single) ?? todayISO();
    (
      panel.current?.querySelector<HTMLElement>(`.z-calendar__day[data-date="${start}"]:not([data-outside])`) ??
      panel.current?.querySelector<HTMLElement>(`.z-calendar__unit[data-value="${start}"]`) ??
      panel.current?.querySelector<HTMLElement>('.z-calendar__grid [tabindex="0"]')
    )?.focus();
  };

  const draftSelection = readSelection(mode, draft, minView);
  const summaryNode = summary
    ? summary(draft)
    : mode === "range"
      ? formatDateRange(draftSelection.range, locale, { month: "short", day: "numeric", year: "numeric" })
      : mode === "multiple"
        ? draftSelection.multiple.length
          ? String(draftSelection.multiple.length)
          : ""
        : selectionText(mode, draftSelection, { locale, unit: minView });
  const footer = confirm ? (
    <>
      <span className="z-calendar__summary">{summaryNode}</span>
      <span className="z-calendar__actions">
        <Button variant="ghost" size="sm" className="z-calendar__cancel" onClick={() => close(true)}>
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="z-calendar__apply"
          onClick={() => {
            emit(draft);
            close(true);
          }}
        >
          {applyLabel}
        </Button>
      </span>
    </>
  ) : undefined;

  const calendar = {
    ...calendarProps,
    min,
    max,
    isDateDisabled,
    weekStartsOn,
    locale,
    previousMonthLabel,
    nextMonthLabel,
    presets,
    presetsLabel,
    legend,
    minView,
    selectionUnit,
    footer,
    value: (confirm ? draft : value) as never,
    onValueChange: onCalendarChange as never,
  };
  const iconName = icon ?? (mode === "range" ? "calendar-date-range" : mode === "multiple" ? "calendar-days" : "calendar");
  const listed = mode === "multiple" && !serialize ? selection.multiple : [formValue];

  return (
    <>
      <span
        ref={anchor}
        className={cx("z-select", "z-datepicker", className)}
        data-size={size}
        data-block={block || undefined}
        data-invalid={isInvalid || undefined}
        data-disabled={disabled || undefined}
      >
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
          aria-describedby={
            [control["aria-describedby"], ariaLabel || ariaLabelledBy ? undefined : valueId].filter(Boolean).join(" ") || undefined
          }
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
          <Icon name={iconName} size={ICON_SIZE[size]} />
        </span>
        {name || isRequired
          ? // Campo nativo oculto: envía el valor y da la validación `required` del navegador. Un `button` no admite
            // `aria-required`; que el campo es obligatorio lo dicen la etiqueta del Field y el mensaje del navegador.
            // En modo múltiple, un campo por fecha con el mismo nombre.
            (listed.length ? listed : [""]).map((item, i) => (
              <input
                key={item || "empty"}
                ref={i === 0 ? native : undefined}
                type="text"
                className="z-native-input"
                aria-hidden="true"
                tabIndex={-1}
                name={name}
                value={item}
                required={i === 0 ? isRequired : undefined}
                disabled={disabled}
                onChange={noop}
              />
            ))
          : null}
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
            {mode === "range" ? (
              <Calendar {...calendar} mode="range" />
            ) : mode === "multiple" ? (
              <Calendar {...calendar} mode="multiple" maxSelected={(props as DatePickerMultipleProps).maxSelected} />
            ) : (
              <Calendar {...calendar} mode="single" />
            )}
          </Popup>
        </Portal>
      ) : null}
    </>
  );
}

/** Selector de rango: `DatePicker` en modo `range` con dos meses por defecto. */
export type DateRangePickerProps = Omit<DatePickerRangeProps, "mode">;
export function DateRangePicker({ numberOfMonths = 2, placeholder = "Select dates", ...props }: DateRangePickerProps) {
  return <DatePicker {...props} mode="range" numberOfMonths={numberOfMonths} placeholder={placeholder} />;
}

const noop = () => {};

export type { CalendarMode };
