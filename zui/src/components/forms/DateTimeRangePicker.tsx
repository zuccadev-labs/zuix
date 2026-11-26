"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import {
  DATE_TIME_RANGE_LABELS,
  DATE_TIME_RANGE_MESSAGES,
  dateTimeRangeError,
  dateTimeRangeText,
  formatDateTimeRange,
  joinDateTime,
  nowIn,
  resolveDateTimePreset,
  splitDateTime,
  type DateTimePreset,
  type DateTimePresetKey,
  type DateTimeRange,
  type DateTimeRangeError,
  type DateTimeRangeMessages,
  type DateTimeRangePickerLabels,
} from "../../core/datetime-range";
import { todayISO } from "../../core/date";
import { focusQuiet, trapTab } from "../../core/focus";
import { groupZones, zoneOptions } from "../../core/timezones";
import { deviceTimeZone, zoneCity } from "../../core/zone";
import { cx } from "../../cx";
import { useControllable, useLatest, useLayer, usePresence } from "../../primitives/hooks";
import { Popup, Portal, rectOf } from "../../primitives/popup";
import { useMergedRef } from "../../refs";
import { Button } from "../actions/Button";
import { ICON_SIZE, type ControlSize } from "../actions/types";
import { Calendar, type DateRange } from "./Calendar";
import { useFieldControl } from "./Field";
import { NativeSelect } from "./NativeSelect";
import { TimeField } from "./TimeField";
import { withRef } from "../../react-compat";

export type { DateTimePreset, DateTimePresetKey, DateTimeRange, DateTimeRangeError, DateTimeRangeMessages, DateTimeRangePickerLabels };

export interface DateTimeRangePickerProps {
  /** `{ start, end, timeZone? }` con relojes de pared `YYYY-MM-DDTHH:mm`. Controlado. */
  value?: DateTimeRange | null;
  defaultValue?: DateTimeRange | null;
  onValueChange?: (value: DateTimeRange) => void;
  /** Selector de zona horaria en el panel. Sin él, el valor es un reloj civil (como `datetime-local`). */
  showTimeZone?: boolean;
  /** Zonas que se ofrecen (IANA). Por defecto, todas las del navegador. */
  timeZones?: readonly string[];
  /** Zona de partida si el valor no trae una. Por defecto, la del dispositivo. */
  defaultTimeZone?: string;
  /** Preajustes: claves conocidas (`last-24-hours`, `today`…) o funciones de «ahora» a `{ start, end }`. */
  presets?: DateTimePreset[];
  /** Primer y último día elegibles (`YYYY-MM-DD`). */
  min?: string;
  max?: string;
  isDateDisabled?: (date: string) => boolean;
  /** Meses a la vista (2 por defecto). */
  numberOfMonths?: number;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  locale?: string;
  hourCycle?: 12 | 24;
  minuteStep?: number;
  /** Hora de un inicio y de un fin recién elegidos. */
  defaultStartTime?: string;
  defaultEndTime?: string;
  /** Hoy (`YYYY-MM-DD`) para el calendario. */
  today?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Nombre del campo: `inicio/fin`, con desfase y zona en cada extremo si hay zona (RFC 9557). */
  name?: string;
  block?: boolean;
  align?: "start" | "center" | "end";
  labels?: Partial<DateTimeRangePickerLabels>;
  messages?: Partial<DateTimeRangeMessages>;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  popupClassName?: string;
  ref?: Ref<HTMLButtonElement>;
}

const EMPTY: DateTimeRange = { start: null, end: null };

/**
 * Rango de fecha y hora en un panel: el calendario de rango (Calendar), una hora de inicio y otra de fin (TimeField),
 * zona horaria opcional y preajustes. El valor cambia con «Apply»; Escape y «Cancel» descartan.
 */
export const DateTimeRangePicker = withRef(function DateTimeRangePicker({
  value,
  defaultValue,
  onValueChange,
  showTimeZone = false,
  timeZones,
  defaultTimeZone,
  presets,
  min,
  max,
  isDateDisabled,
  numberOfMonths = 2,
  weekStartsOn,
  locale,
  hourCycle,
  minuteStep,
  defaultStartTime = "00:00",
  defaultEndTime = "23:59",
  today,
  open,
  defaultOpen = false,
  onOpenChange,
  size = "md",
  invalid,
  disabled,
  required,
  name,
  block = true,
  align = "start",
  labels: ownLabels,
  messages: ownMessages,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": describedBy,
  className,
  popupClassName,
  ref,
}: DateTimeRangePickerProps) {
  const labels = { ...DATE_TIME_RANGE_LABELS, ...ownLabels };
  const messages = { ...DATE_TIME_RANGE_MESSAGES, ...ownMessages };
  const {
    invalid: isInvalid,
    required: isRequired,
    ...control
  } = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const auto = useId();
  const valueId = `${auto}-value`;
  const panelId = `${auto}-panel`;
  const errorId = `${auto}-error`;
  const anchor = useRef<HTMLSpanElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const setButton = useMergedRef(button, ref);
  const native = useRef<HTMLInputElement | null>(null);
  const [current, setCurrent] = useControllable<DateTimeRange>(value ?? undefined, defaultValue ?? EMPTY, onValueChange);
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  const present = usePresence(isOpen, panel);
  const zoneFallback = defaultTimeZone ?? (showTimeZone ? deviceTimeZone() : null);

  // Borrador del panel: días, horas y zona; «Apply» los junta.
  const [draft, setDraft] = useState(() => draftOf(current, zoneFallback));
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setDraft(draftOf(current, zoneFallback));
  }
  const candidate: DateTimeRange = {
    start: joinDateTime(draft.from, draft.startTime, defaultStartTime),
    end: joinDateTime(draft.to ?? draft.from, draft.endTime, defaultEndTime),
    timeZone: showTimeZone ? draft.zone : null,
  };
  const draftError = draft.from ? dateTimeRangeError(candidate) : "incomplete";
  const valueError = dateTimeRangeError(current);

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

  // Formulario: el rango que no vale lleva su mensaje; `reset` vuelve al inicial; `invalid` enfoca el botón.
  // Valor con el que se montó: el que devuelve `form.reset()`.
  const mounted = useRef(value ?? defaultValue);
  const latest = useLatest({ defaultValue: mounted.current });
  useEffect(() => {
    native.current?.setCustomValidity(valueError ? messages[valueError] : "");
  });
  useEffect(() => {
    const field = native.current;
    const form = field?.form;
    if (!field) return;
    const onReset = () => setTimeout(() => setCurrent(latest.current.defaultValue ?? EMPTY), 0);
    const onInvalid = () => focusQuiet(button.current);
    form?.addEventListener("reset", onReset);
    field.addEventListener("invalid", onInvalid);
    return () => {
      form?.removeEventListener("reset", onReset);
      field.removeEventListener("invalid", onInvalid);
    };
  }, [latest, setCurrent]);

  const zones = useMemo(
    () => (showTimeZone ? groupZones(zoneOptions({ zones: timeZones, showTime: false, locale }), "region") : []),
    [showTimeZone, timeZones, locale],
  );
  const text = formatDateTimeRange(
    current,
    locale,
    hourCycle === undefined ? undefined : hourCycle === 12,
    Number((today ?? todayISO()).slice(0, 4)),
  );
  const shown = text && current.timeZone ? `${text} (${zoneCity(current.timeZone)})` : text;

  const focusDay = () => {
    const start = draft.from ?? today;
    (
      (start ? panel.current?.querySelector<HTMLElement>(`.z-calendar__day[data-date="${start}"]:not([data-outside])`) : null) ??
      panel.current?.querySelector<HTMLElement>('.z-calendar__grid [tabindex="0"]')
    )?.focus();
  };
  const applyPreset = (preset: DateTimePreset) => {
    const range = resolveDateTimePreset(preset.value, nowIn(draft.zone), weekStartsOn ?? 1);
    if (!range) return;
    const a = splitDateTime(range.start);
    const b = splitDateTime(range.end);
    setDraft({ ...draft, from: a.date, to: b.date, startTime: a.time, endTime: b.time });
  };
  const apply = () => {
    if (draftError) return;
    setCurrent(candidate);
    close(true);
  };

  return (
    <>
      <span
        ref={anchor}
        className={cx("z-select", "z-dtrange", className)}
        data-picker=""
        data-size={size}
        data-block={block || undefined}
        data-invalid={isInvalid || Boolean(valueError) || undefined}
        data-disabled={disabled || undefined}
        data-name={name}
        data-time-zone={showTimeZone ? "" : undefined}
      >
        <button
          {...control}
          ref={setButton}
          type="button"
          className="z-select__control"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          aria-labelledby={ariaLabelledBy ? `${ariaLabelledBy} ${valueId}` : undefined}
          aria-describedby={
            [control["aria-describedby"], ariaLabel || ariaLabelledBy ? undefined : valueId].filter(Boolean).join(" ") || undefined
          }
          data-state={isOpen ? "open" : "closed"}
          data-placeholder={shown ? undefined : ""}
          disabled={disabled}
          onClick={() => (isOpen ? close(true) : setOpen(true))}
        >
          {ariaLabel && !ariaLabelledBy ? <span className="z-sr-only">{ariaLabel}</span> : null}
          <span className="z-select__value" id={valueId}>
            {shown || labels.placeholder}
          </span>
        </button>
        <span className="z-select__chevron">
          <Icon name="calendar-date-range" size={ICON_SIZE[size]} />
        </span>
        <input
          ref={native}
          type="text"
          className="z-native-input"
          aria-hidden="true"
          tabIndex={-1}
          name={name}
          value={dateTimeRangeText(current)}
          required={isRequired}
          disabled={disabled}
          onChange={noop}
          // El navegador enfoca este campo al informar de un error: el foco pasa al botón.
          onFocus={() => focusQuiet(button.current)}
        />
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
            aria-label={labels.dialog}
            className={cx("z-liquid z-popover z-datepicker__panel z-dtrange__panel", popupClassName)}
            onShown={focusDay}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (panel.current && trapTab(panel.current, event)) event.preventDefault();
            }}
          >
            <div className="z-dtrange__body" data-presets={presets?.length ? "" : undefined}>
              {presets?.length ? (
                <div className="z-calendar__presets z-dtrange__presets" role="group" aria-labelledby={`${auto}-presets`}>
                  <p className="z-calendar__presets-label" id={`${auto}-presets`}>
                    {labels.presets}
                  </p>
                  {presets.map((preset) => (
                    <button key={preset.label} type="button" className="z-calendar__preset" onClick={() => applyPreset(preset)}>
                      {preset.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <Calendar
                mode="range"
                value={{ from: draft.from, to: draft.to }}
                onValueChange={(range: DateRange) => setDraft({ ...draft, from: range.from, to: range.to })}
                numberOfMonths={narrowScreen() ? 1 : numberOfMonths}
                min={min}
                max={max}
                isDateDisabled={isDateDisabled}
                weekStartsOn={weekStartsOn}
                locale={locale}
                today={today}
                allowSingleDayRange
              />
            </div>
            <div className="z-calendar__footer z-dtrange__footer">
              <span className="z-dtrange__time">
                <span className="z-datetimepicker__time-label" id={`${auto}-start`}>
                  {labels.start}
                </span>
                <TimeField
                  aria-labelledby={`${auto}-start`}
                  size="sm"
                  value={draft.startTime}
                  onValueChange={(startTime) => setDraft({ ...draft, startTime })}
                  locale={locale}
                  hourCycle={hourCycle}
                  minuteStep={minuteStep}
                />
              </span>
              <span className="z-dtrange__time">
                <span className="z-datetimepicker__time-label" id={`${auto}-end`}>
                  {labels.end}
                </span>
                <TimeField
                  aria-labelledby={`${auto}-end`}
                  size="sm"
                  value={draft.endTime}
                  onValueChange={(endTime) => setDraft({ ...draft, endTime })}
                  locale={locale}
                  hourCycle={hourCycle}
                  minuteStep={minuteStep}
                />
              </span>
              {showTimeZone ? (
                <span className="z-dtrange__time z-dtrange__zone">
                  <span className="z-datetimepicker__time-label" id={`${auto}-zone`}>
                    {labels.timeZone}
                  </span>
                  <NativeSelect
                    aria-labelledby={`${auto}-zone`}
                    size="sm"
                    block={false}
                    value={draft.zone ?? ""}
                    onChange={(event) => setDraft({ ...draft, zone: event.target.value || null })}
                    options={zones.map((group) => ({
                      label: group.label,
                      options: group.options.map((o) => ({ value: o.value, label: o.label })),
                    }))}
                  />
                </span>
              ) : null}
              <span className="z-dtrange__error" id={errorId} role="status">
                {draft.from && draftError && draftError !== "incomplete" ? messages[draftError] : ""}
              </span>
              <span className="z-calendar__actions">
                <Button variant="ghost" size="sm" className="z-calendar__cancel" onClick={() => close(true)}>
                  {labels.cancel}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="z-calendar__apply"
                  aria-disabled={draftError ? true : undefined}
                  aria-describedby={errorId}
                  onClick={apply}
                >
                  {labels.apply}
                </Button>
              </span>
            </div>
          </Popup>
        </Portal>
      ) : null}
    </>
  );
});

interface Draft {
  from: string | null;
  to: string | null;
  startTime: string | null;
  endTime: string | null;
  zone: string | null;
}

function draftOf(range: DateTimeRange, zone: string | null): Draft {
  const a = splitDateTime(range.start);
  const b = splitDateTime(range.end);
  return { from: a.date, to: b.date, startTime: a.time, endTime: b.time, zone: range.timeZone ?? zone };
}

const noop = () => {};

/** Ventana estrecha (teléfono): el panel enseña un solo mes. Se mira al pintar el panel abierto, nunca en el servidor. */
const narrowScreen = () => typeof matchMedia === "function" && matchMedia("(max-width: 640px)").matches;
