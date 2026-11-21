// @zuccadev-labs/zuix-zui/dom/dates — Calendar, DatePicker (y sus variantes de rango, mes, semana y año), DateField,
// TimeField, TimePicker y DateTimePicker sin framework. Registro: init(datesModule) o use(datesModule) junto a
// @zuccadev-labs/zuix-zui/dom/core.
import * as calendar from "../forms-calendar";
import * as datefield from "../forms-datefield";
import * as datetime from "../forms-datetime";
import type { DomModule } from "../shared";

export { setCalendarOptions, setCalendarValue, setDatePickerValue, type CalendarOptions, type DateRange } from "../forms-calendar";
export { setDateFieldValue, setTimeFieldValue, setTimePickerValue } from "../forms-datefield";
export { formatDateRange, isoWeekText, PRESET_KEYS, rangePresets, resolvePreset, weekNumber, weekStartOf } from "../../core/date";

export const datesModule: DomModule = {
  name: "dates",
  parts: [
    { rank: 22, setup: calendar.setup, hydrate: calendar.hydrate },
    { rank: 24, setup: datefield.setup, hydrate: datefield.hydrate },
    { rank: 25, setup: datetime.setup, hydrate: datetime.hydrate },
  ],
};
