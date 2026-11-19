// Comportamiento sin framework del grupo forms: Select (listbox), Combobox, Calendar, DatePicker, Slider,
// OTPInput y FileUpload. `setup()` conecta los listeners delegados una vez; `hydrate(root)` prepara marcado nuevo.
// Todo se activa dentro de `[data-z-dom]`. El campo y su popup se enlazan con aria-controls="id".
//
// Select      .z-select > button.z-select__control[aria-controls] + .z-listbox[popover] con .z-listbox__option[data-value].
//             En .z-select: data-value, data-placeholder. z:change { value }.
// Combobox    .z-combobox > input.z-input__control[aria-controls] + .z-listbox[popover]. En .z-combobox: data-value,
//             data-filter="false", data-loading, data-empty-text, data-loading-text. z:input { value } al escribir,
//             z:change { value, label }. setComboboxOptions(), setComboboxLoading().
// Calendar    .z-calendar vacío: data-mode="single|range|multiple", data-value ("YYYY-MM-DD", "desde/hasta" o
//             "a,b,c"), data-month, data-months (varios meses), data-paged, data-view, data-min-view, data-max-view,
//             data-caption="dropdown", data-min, data-max, data-locale, data-week-start, data-disabled-weekdays="0,6",
//             data-disabled-dates, data-unavailable-dates, data-outside-days, data-fixed-weeks, data-week-numbers,
//             data-today, data-today-button, data-presets (JSON), data-legend (JSON), data-cell-size,
//             data-selection-unit="week", data-min-range, data-max-range, data-max-selected y las etiquetas
//             data-*-label. Funciones (deshabilitadas, reservadas, contenido por día): setCalendarOptions().
//             z:change { value }, z:monthchange { month }, z:viewchange { view }.
// DatePicker  .z-select.z-datepicker > button[aria-controls] + .z-popover[popover] con un .z-calendar. Los mismos
//             atributos que Calendar, en .z-datepicker, más data-placeholder, data-date-style, data-confirm,
//             data-close-on-select y data-count-label. z:change { value }.
// Slider      .z-slider: data-min, data-max, data-step, data-value ("60" o "20,80"), data-orientation, data-disabled.
//             z:change { value, index }.
// OTPInput    .z-otp: data-mode="numeric|text", data-value. z:change { value, complete }.
// FileUpload  .z-upload: data-max-size (bytes); accept y multiple, en el input. Lista opcional: ul.z-upload__files.
//             z:change { files, rejected }.
// DateField   .z-input.z-datefield[role=group] > .z-datefield__input con span.z-datefield__segment[role=spinbutton]
//             [data-segment] y .z-datefield__literal (se rehacen si no siguen el orden del locale), button.z-datefield__clear
//             opcional e input.z-native-input (valor ISO y validez nativa). En .z-datefield: data-locale, data-granularity
//             ="day|hour|minute|second", data-hour-cycle="12|24", data-minute-step, data-second-step, data-min, data-max,
//             data-value, data-placeholder-value, data-leading-zeros="false", data-disabled, data-readonly, data-invalid,
//             data-empty-label, data-incomplete-message, data-invalid-message, data-range-message. z:change { value }
//             (ISO, o null mientras está incompleto). setDateFieldValue(). Otros botones dentro del campo no se tocan.
// TimeField   El mismo marcado con la clase .z-timefield: segmentos de hora, minuto, (segundo) y AM/PM; data-granularity
//             ="minute|second". setTimeFieldValue().
// InputGroup, PasswordInput y NumberInput: ver ./forms-fields.
// TimePicker  .z-timefield.z-timepicker con button.z-timepicker__trigger[aria-controls] + .z-timepicker__panel[popover]
//             vacío. En el campo: data-variant="columns|list", data-step (minutos de la lista), data-disabled-times
//             ="12:00,12:30", data-show-now, data-now-label, data-hours-label, data-minutes-label, data-seconds-label,
//             data-period-label, data-times-label. z:change { value }. setTimePickerValue().
import * as calendar from "./forms-calendar";
import * as controls from "./forms-controls";
import * as datefield from "./forms-datefield";
import * as datetime from "./forms-datetime";
import * as fields from "./forms-fields";
import * as listbox from "./forms-listbox";
import * as popup from "./forms-popup";
import type { Listen } from "./shared";

export { setCalendarOptions, setCalendarValue, setDatePickerValue, type CalendarOptions, type DateRange } from "./forms-calendar";
export { setOtpValue, setSliderValue } from "./forms-controls";
export { setDateFieldValue, setTimeFieldValue, setTimePickerValue } from "./forms-datefield";
export { setNumberInputValue } from "./forms-fields";
export { setComboboxLoading, setComboboxOptions, setComboboxValue, setSelectValue, type ComboboxOption } from "./forms-listbox";

const parts = [popup, listbox, calendar, controls, datefield, datetime, fields];

export function setup(on: Listen): void {
  for (const part of parts) part.setup(on);
}

export function hydrate(root: ParentNode): void {
  listbox.hydrate(root);
  calendar.hydrate(root);
  controls.hydrate(root);
  datefield.hydrate(root);
  fields.hydrate(root);
}
