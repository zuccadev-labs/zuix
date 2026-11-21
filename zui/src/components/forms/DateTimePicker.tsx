"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { todayISO, valid } from "../../core/date";
import { FIELD_TEXTS } from "../../core/segments";
import { clampDateTime, dayTimeBounds } from "../../core/time";
import { focusQuiet, trapTab } from "../../core/focus";
import { cx } from "../../cx";
import { useControllable, useLayer, usePresence } from "../../primitives/hooks";
import { Popup, Portal, rectOf } from "../../primitives/popup";
import { useMergedRef } from "../../refs";
import { Button } from "../actions/Button";
import { ICON_SIZE } from "../actions/types";
import { Calendar, type CalendarPreset } from "./Calendar";
import type { DateFieldProps } from "./DateField";
import { SegmentedField } from "./segmented.internal";
import { TimeField } from "./TimeField";

export interface DateTimePickerProps extends Omit<DateFieldProps, "children"> {
  /** `day`: DatePicker con campo tecleable. `minute` (por defecto) o `second`: fecha y hora. */
  granularity?: "day" | "minute" | "second";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Del calendario. */
  isDateDisabled?: (date: string) => boolean;
  isDateUnavailable?: (date: string) => boolean;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  numberOfMonths?: number;
  presets?: CalendarPreset[];
  today?: string;
  /** Hora que toma un día recién elegido si aún no hay hora. Por defecto `00:00`. */
  defaultTime?: string;
  align?: "start" | "center" | "end";
  /** Nombre del botón del calendario y del panel. */
  calendarLabel?: string;
  timeLabel?: string;
  applyLabel?: string;
  popupClassName?: string;
  triggerRef?: Ref<HTMLButtonElement>;
}

/** Campo tecleable (DateField) con un calendario y, con hora, un TimeField en el mismo panel. Valor ISO civil:
 *  `YYYY-MM-DD` o `YYYY-MM-DDTHH:mm[:ss]`, sin zona, como `datetime-local`. */
export function DateTimePicker({
  granularity = "minute",
  open,
  defaultOpen = false,
  onOpenChange,
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  locale,
  hourCycle,
  minuteStep,
  secondStep,
  isDateDisabled,
  isDateUnavailable,
  weekStartsOn,
  numberOfMonths,
  presets,
  today,
  defaultTime = "00:00",
  align = "start",
  calendarLabel = "Choose date",
  timeLabel = "Time",
  applyLabel = "Apply",
  size = "md",
  disabled,
  readOnly,
  className,
  popupClassName,
  triggerRef,
  onKeyDown,
  ...field
}: DateTimePickerProps) {
  const auto = useId();
  const panelId = `${auto}-panel`;
  const anchor = useRef<HTMLDivElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const setButton = useMergedRef(button, triggerRef);
  const [current, setCurrent] = useControllable<string | null>(value, defaultValue ?? null, onValueChange);
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  const present = usePresence(isOpen, panel);
  const inactive = Boolean(disabled || readOnly);
  const withTime = granularity !== "day";
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

  const datePart = current && valid(current.slice(0, 10)) ? current.slice(0, 10) : null;
  const timePart = current && current.length > 10 ? current.slice(11) : null;
  // Borrador del panel: el día y la hora se eligen y «Aplicar» los junta.
  const [draftDate, setDraftDate] = useState<string | null>(datePart);
  const [draftTime, setDraftTime] = useState<string | null>(timePart);
  // biome-ignore lint/correctness/useExhaustiveDependencies: el borrador se reinicia solo al abrir.
  useEffect(() => {
    if (!isOpen) return;
    setDraftDate(datePart);
    setDraftTime(timePart);
  }, [isOpen]);

  const focusDay = () => {
    const start = draftDate ?? today ?? todayISO();
    (
      panel.current?.querySelector<HTMLElement>(`.z-calendar__day[data-date="${start}"]:not([data-outside])`) ??
      panel.current?.querySelector<HTMLElement>('.z-calendar__grid [tabindex="0"]')
    )?.focus();
  };
  const apply = () => {
    if (!draftDate) return;
    const seconds = granularity === "second";
    // El día de `min` o de `max` limita también la hora: lo que quede fuera se encaja en el límite.
    setCurrent(clampDateTime(draftDate, draftTime ?? defaultTime, min, max, seconds));
    close(true);
  };
  const timeBounds = dayTimeBounds(draftDate, min, max);

  return (
    <>
      <SegmentedField
        {...field}
        ref={anchor}
        granularity={granularity}
        rootClassName="z-datetimepicker"
        className={className}
        size={size}
        disabled={disabled}
        readOnly={readOnly}
        value={current}
        onValueChange={setCurrent}
        min={min}
        max={max}
        locale={locale}
        hourCycle={hourCycle}
        minuteStep={minuteStep}
        secondStep={secondStep}
        texts={FIELD_TEXTS.date}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          // Alt+Flecha abajo abre el calendario, como en un combobox.
          if (!event.defaultPrevented && event.altKey && event.key === "ArrowDown" && !inactive) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <button
          ref={setButton}
          type="button"
          className="z-input__action z-datetimepicker__trigger"
          aria-label={calendarLabel}
          title={calendarLabel}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          disabled={inactive}
          onClick={() => (isOpen ? close(true) : setOpen(true))}
        >
          <Icon name="calendar" size={ICON_SIZE[size]} />
        </button>
      </SegmentedField>
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
            className={cx("z-liquid z-popover z-datepicker__panel z-datetimepicker__panel", popupClassName)}
            onShown={focusDay}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (panel.current && trapTab(panel.current, event)) event.preventDefault();
            }}
          >
            <Calendar
              value={draftDate}
              onValueChange={(date) => {
                if (!withTime) {
                  setCurrent(date);
                  close(true);
                  return;
                }
                setDraftDate(date);
              }}
              min={min?.slice(0, 10)}
              max={max?.slice(0, 10)}
              locale={locale}
              isDateDisabled={isDateDisabled}
              isDateUnavailable={isDateUnavailable}
              weekStartsOn={weekStartsOn}
              numberOfMonths={numberOfMonths}
              presets={presets}
              today={today}
            />
            {withTime ? (
              <div className="z-calendar__footer z-datetimepicker__footer">
                <span className="z-datetimepicker__time">
                  <span className="z-datetimepicker__time-label">{timeLabel}</span>
                  <TimeField
                    aria-label={timeLabel}
                    size="sm"
                    value={draftTime}
                    onValueChange={setDraftTime}
                    min={timeBounds.min ?? undefined}
                    max={timeBounds.max ?? undefined}
                    showSeconds={granularity === "second"}
                    locale={locale}
                    hourCycle={hourCycle}
                    minuteStep={minuteStep}
                    secondStep={secondStep}
                  />
                </span>
                <Button variant="primary" size="sm" className="z-calendar__apply" disabled={!draftDate} onClick={apply}>
                  {applyLabel}
                </Button>
              </div>
            ) : null}
          </Popup>
        </Portal>
      ) : null}
    </>
  );
}
