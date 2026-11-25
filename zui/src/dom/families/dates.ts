// @zuccadev-labs/zuix-zui/dom/dates — Calendar, DatePicker (y sus variantes de rango, mes, semana y año), DateField,
// TimeField, TimePicker, DateTimePicker, TimeRangePicker, DateTimeRangePicker y QuarterPicker sin framework. Registro: init(datesModule) o use(datesModule) junto a
// @zuccadev-labs/zuix-zui/dom/core.
import * as calendar from "../forms-calendar";
import * as datefield from "../forms-datefield";
import * as datetime from "../forms-datetime";
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowRight } from "@zuccadev-labs/zuix-zicon/icons/arrow-right";
import { calendar as calendarIcon } from "@zuccadev-labs/zuix-zicon/icons/calendar";
import { moon } from "@zuccadev-labs/zuix-zicon/icons/moon";
import { quarterPickerWidget } from "../../core/quarter-widget";
import { rangesPart } from "../forms-ranges";
import type { DomModule } from "../shared";
import { widgetPart } from "../widgets";

export { setCalendarOptions, setCalendarValue, setDatePickerValue, type CalendarOptions, type DateRange } from "../forms-calendar";
export { setDateFieldValue, setTimeFieldValue, setTimePickerValue } from "../forms-datefield";
export { setDateTimeRangeValue, setTimeRangeValue } from "../forms-ranges";
export { destroyWidget, setWidgetProps } from "../widgets";
export { addQuarters, quarterOf, quarterRange } from "../../core/quarter";
export { timeRangeInfo, type TimeRange } from "../../core/time-range";
export { dateTimeRangeText, parseDateTimeRange, type DateTimeRange } from "../../core/datetime-range";
export { formatDateRange, isoWeekText, PRESET_KEYS, rangePresets, resolvePreset, weekNumber, weekStartOf } from "../../core/date";

export const datesModule: DomModule = {
  name: "dates",
  parts: [
    { rank: 22, setup: calendar.setup, hydrate: calendar.hydrate },
    { rank: 24, setup: datefield.setup, hydrate: datefield.hydrate },
    { rank: 25, setup: datetime.setup, hydrate: datetime.hydrate },
    rangesPart,
    widgetPart(45.3, [quarterPickerWidget]),
  ],
};

registerIcons([arrowRight, calendarIcon, moon]);
