"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { logicalKey } from "../../core/dir";
import { focusQuiet, trapTab } from "../../core/focus";
import { step as stepTo } from "../../core/roving";
import { FIELD_TEXTS, fieldConfig } from "../../core/segments";
import {
  nowTime,
  pickColumn,
  revealOption,
  slotMatches,
  timeColumns,
  timeLabel,
  timeSlots,
  type ColumnType,
  type TimeColumn,
} from "../../core/time";
import { cx } from "../../cx";
import { useControllable, useLayer, usePresence } from "../../primitives/hooks";
import { Popup, Portal, rectOf } from "../../primitives/popup";
import { useMergedRef } from "../../refs";
import { ICON_SIZE } from "../actions/types";
import { SegmentedField } from "./segmented.internal";
import type { TimeFieldProps } from "./TimeField";

export interface TimePickerProps extends TimeFieldProps {
  /** `columns`: horas, minutos, (segundos) y AM/PM en columnas. `list`: franjas de `step` minutos, filtrables al teclear. */
  variant?: "columns" | "list";
  /** Minutos entre franjas de la lista. */
  step?: number;
  /** true para las horas (`HH:mm`, o `HH:mm:ss` con segundos) que no se pueden elegir. */
  isTimeDisabled?: (time: string) => boolean;
  /** Botón que elige la hora actual. */
  showNow?: boolean;
  nowLabel?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Nombre accesible del botón y del panel. */
  pickerLabel?: string;
  hoursLabel?: string;
  minutesLabel?: string;
  secondsLabel?: string;
  periodLabel?: string;
  /** Nombre accesible de la lista de franjas. */
  timesLabel?: string;
  /** Alineación del panel respecto al campo. */
  align?: "start" | "center" | "end";
  popupClassName?: string;
  /** Ref del botón que abre el panel. */
  triggerRef?: Ref<HTMLButtonElement>;
}

/** Campo de hora (TimeField) con un panel de columnas o de franjas. Valor `HH:mm` o `HH:mm:ss` en 24 h. */
export function TimePicker({
  variant = "columns",
  step = 30,
  isTimeDisabled,
  showNow,
  nowLabel = "Now",
  open,
  defaultOpen = false,
  onOpenChange,
  pickerLabel = "Choose time",
  hoursLabel = "Hours",
  minutesLabel = "Minutes",
  secondsLabel = "Seconds",
  periodLabel = "AM/PM",
  timesLabel = "Times",
  align = "start",
  popupClassName,
  triggerRef,
  showSeconds,
  value,
  defaultValue,
  onValueChange,
  ref,
  onKeyDown,
  disabled,
  readOnly,
  size = "md",
  className,
  ...field
}: TimePickerProps) {
  const { locale, hourCycle, minuteStep, secondStep, min, max, placeholderValue } = field;
  const config = useMemo(
    () => fieldConfig({ locale, time: true, granularity: showSeconds ? "second" : "minute", hourCycle, minuteStep, secondStep, min, max }),
    [locale, showSeconds, hourCycle, minuteStep, secondStep, min, max],
  );
  const [current, setCurrent] = useControllable<string | null>(value, defaultValue ?? null, onValueChange);
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  const anchor = useRef<HTMLDivElement | null>(null);
  const setAnchor = useMergedRef(anchor, ref);
  const button = useRef<HTMLButtonElement | null>(null);
  const setButton = useMergedRef(button, triggerRef);
  const panel = useRef<HTMLDivElement | null>(null);
  const panelId = `${useId()}-panel`;
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
  const inactive = disabled || readOnly;

  /** Foco inicial: la opción elegida de la primera columna (o de la lista) o la primera que se pueda elegir. */
  const focusInitial = (el: HTMLElement) => {
    for (const list of el.querySelectorAll<HTMLElement>('[role="listbox"]')) {
      const chosen = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (chosen) revealOption(list, chosen, true);
    }
    el.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus({ preventScroll: true });
  };

  return (
    <>
      <SegmentedField
        {...field}
        ref={setAnchor}
        time
        granularity={showSeconds ? "second" : "minute"}
        rootClassName="z-timefield z-timepicker"
        className={className}
        size={size}
        disabled={disabled}
        readOnly={readOnly}
        value={current}
        defaultValue={defaultValue}
        onValueChange={setCurrent}
        texts={FIELD_TEXTS.time}
        data={{
          "data-variant": variant,
          "data-step": variant === "list" ? step : undefined,
          "data-show-now": showNow ? "" : undefined,
          "data-now-label": showNow && nowLabel !== "Now" ? nowLabel : undefined,
          "data-hours-label": hoursLabel !== "Hours" ? hoursLabel : undefined,
          "data-minutes-label": minutesLabel !== "Minutes" ? minutesLabel : undefined,
          "data-seconds-label": secondsLabel !== "Seconds" ? secondsLabel : undefined,
          "data-period-label": periodLabel !== "AM/PM" ? periodLabel : undefined,
          "data-times-label": timesLabel !== "Times" ? timesLabel : undefined,
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          // Alt+Flecha abajo abre el panel, como en un combobox.
          if (!event.defaultPrevented && event.altKey && event.key === "ArrowDown" && !inactive) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <button
          ref={setButton}
          type="button"
          className="z-input__action z-timepicker__trigger"
          aria-label={pickerLabel}
          title={pickerLabel}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          disabled={inactive}
          onClick={() => (isOpen ? close(true) : setOpen(true))}
        >
          <Icon name="clock" size={ICON_SIZE[size]} />
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
            aria-label={pickerLabel}
            className={cx("z-liquid z-popover z-timepicker__panel", popupClassName)}
            data-variant={variant}
            onShown={focusInitial}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (panel.current && trapTab(panel.current, event)) event.preventDefault();
            }}
          >
            {variant === "list" ? (
              <SlotList
                value={current}
                step={step}
                min={min}
                max={max}
                locale={config.locale}
                cycle={config.cycle}
                seconds={Boolean(showSeconds)}
                isTimeDisabled={isTimeDisabled}
                label={timesLabel}
                onPick={(time) => {
                  setCurrent(time);
                  close(true);
                }}
              />
            ) : (
              <Columns
                columns={timeColumns({
                  value: current,
                  cycle: config.cycle,
                  seconds: showSeconds,
                  minuteStep: config.minuteStep,
                  secondStep: config.secondStep,
                  min,
                  max,
                  isTimeDisabled,
                  digits: config.digits,
                  periods: config.periods,
                })}
                labels={{ hour: hoursLabel, minute: minutesLabel, second: secondsLabel, dayPeriod: periodLabel }}
                onPick={(type, option, done) => {
                  setCurrent(pickColumn(current, type, option, config.cycle, Boolean(showSeconds), placeholderValue ?? null));
                  if (done) close(true);
                }}
              />
            )}
            {showNow ? (
              <div className="z-timepicker__footer">
                <button
                  type="button"
                  className="z-btn z-btn--ghost z-timepicker__now"
                  data-size="sm"
                  onClick={() => {
                    setCurrent(nowTime(Boolean(showSeconds)));
                    close(true);
                  }}
                >
                  {nowLabel}
                </button>
              </div>
            ) : null}
          </Popup>
        </Portal>
      ) : null}
    </>
  );
}

interface ColumnsProps {
  columns: TimeColumn[];
  labels: Record<ColumnType, string>;
  /** `done`: Intro elige y cierra. */
  onPick: (type: ColumnType, option: number, done: boolean) => void;
}

/** Columnas de horas, minutos, segundos y AM/PM: un listbox por columna, flechas dentro y Tab entre columnas. */
function Columns({ columns, labels, onPick }: ColumnsProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const focusOption = (column: number, value: number | undefined) => {
    const list = root.current?.querySelectorAll<HTMLElement>('[role="listbox"]')[column];
    const option =
      value === undefined
        ? list?.querySelector<HTMLElement>('[tabindex="0"]')
        : list?.querySelector<HTMLElement>(`[data-value="${value}"]`);
    if (!list || !option) return;
    option.focus({ preventScroll: true });
    revealOption(list, option);
  };
  const onKey = (event: KeyboardEvent<HTMLElement>, index: number, column: TimeColumn, value: number) => {
    const option = column.options.find((o) => o.value === value)!;
    const key = logicalKey(event.key, event.currentTarget);
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      focusOption(index + (key === "ArrowLeft" ? -1 : 1), undefined);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (!option.disabled) onPick(column.type, value, key === "Enter");
    } else {
      const target = stepTo(column.options, option, key, false);
      if (!target) return;
      event.preventDefault();
      // La selección sigue al foco (como una rueda de hora): cada flecha cambia el valor si la opción se puede elegir.
      if (!target.disabled) onPick(column.type, target.value, false);
      focusOption(index, target.value);
    }
  };
  return (
    <div ref={root} className="z-timepicker__columns">
      {columns.map((column, index) => {
        const tabbable =
          column.options.find((o) => o.value === column.selected && !o.disabled) ??
          column.options.find((o) => !o.disabled) ??
          column.options[0];
        return (
          <div key={column.type} role="listbox" aria-label={labels[column.type]} className="z-timepicker__column" data-column={column.type}>
            {column.options.map((option) => (
              <div
                key={option.value}
                role="option"
                className="z-timepicker__option"
                data-value={option.value}
                aria-selected={option.value === column.selected}
                aria-disabled={option.disabled || undefined}
                tabIndex={option === tabbable ? 0 : -1}
                onClick={() => {
                  if (!option.disabled) onPick(column.type, option.value, false);
                }}
                onKeyDown={(event) => onKey(event, index, column, option.value)}
              >
                {option.label}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

interface SlotListProps {
  value: string | null;
  step: number;
  min?: string;
  max?: string;
  locale: string | undefined;
  cycle: ReturnType<typeof fieldConfig>["cycle"];
  seconds: boolean;
  isTimeDisabled?: (time: string) => boolean;
  label: string;
  onPick: (time: string) => void;
}

/** Lista de franjas: flechas, Intro elige; lo que se teclea filtra la lista (Retroceso borra, Escape limpia). */
function SlotList({ value, step, min, max, locale, cycle, seconds, isTimeDisabled, label, onPick }: SlotListProps) {
  const list = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const slots = useMemo(
    () =>
      timeSlots(step, min, max).map((time) => {
        const full = seconds ? `${time}:00` : time;
        return { time: full, label: timeLabel(time, locale, cycle), disabled: Boolean(isTimeDisabled?.(full)) };
      }),
    [step, min, max, locale, cycle, seconds, isTimeDisabled],
  );
  const shown = slots.filter((slot) => slotMatches(slot.time, slot.label, query));
  const chosen = shown.find((slot) => slot.time === value && !slot.disabled);
  const tabbable = chosen ?? shown.find((slot) => !slot.disabled) ?? shown[0];
  const focusSlot = (time: string | undefined) => {
    const option = time ? list.current?.querySelector<HTMLElement>(`[data-value="${time}"]`) : null;
    if (!list.current || !option) return;
    option.focus({ preventScroll: true });
    revealOption(list.current, option);
  };
  // Al filtrar, el foco va a la primera franja que coincide.
  const filtered = useRef(false);
  useEffect(() => {
    if (!filtered.current) return;
    filtered.current = false;
    focusSlot((shown.find((slot) => !slot.disabled) ?? shown[0])?.time);
  });
  const onKey = (event: KeyboardEvent<HTMLElement>, time: string) => {
    const slot = shown.find((s) => s.time === time)!;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!slot.disabled) onPick(slot.time);
    } else if (event.key === "Backspace" && query) {
      event.preventDefault();
      filtered.current = true;
      setQuery(query.slice(0, -1));
    } else if (event.key === "Escape" && query) {
      // Escape limpia el filtro; con la lista completa, la siguiente cierra el panel.
      event.preventDefault();
      filtered.current = true;
      setQuery("");
    } else if (event.key.length === 1 && /[\p{L}\p{N}]/u.test(event.key)) {
      event.preventDefault();
      // Un carácter que dejaría la lista vacía no se añade al filtro.
      const next = query + event.key;
      if (!slots.some((s) => slotMatches(s.time, s.label, next))) return;
      filtered.current = true;
      setQuery(next);
    } else {
      const target = stepTo(shown, slot, event.key, false);
      if (!target) return;
      event.preventDefault();
      focusSlot(target.time);
    }
  };
  return (
    <>
      {query ? (
        <div className="z-timepicker__query" aria-hidden="true">
          {query}
        </div>
      ) : null}
      <div ref={list} role="listbox" aria-label={label} className="z-timepicker__list">
        {shown.map((slot) => (
          <div
            key={slot.time}
            role="option"
            className="z-timepicker__option"
            data-value={slot.time}
            aria-selected={slot.time === value}
            aria-disabled={slot.disabled || undefined}
            tabIndex={slot === tabbable ? 0 : -1}
            onClick={() => {
              if (!slot.disabled) onPick(slot.time);
            }}
            onKeyDown={(event) => onKey(event, slot.time)}
          >
            {slot.label}
          </div>
        ))}
      </div>
    </>
  );
}
