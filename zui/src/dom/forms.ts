// Comportamiento sin framework del grupo forms: Select (listbox), Combobox, Calendar, DatePicker, Slider,
// OTPInput y FileUpload. `setup()` conecta los listeners delegados una vez; `hydrate(root)` prepara marcado nuevo.
// Todo se activa dentro de `[data-z-dom]`. El campo y su popup se enlazan con aria-controls="id".
//
// Select      .z-select > button.z-select__control[aria-controls] + .z-listbox[popover] con .z-listbox__option[data-value].
//             En .z-select: data-value, data-placeholder. z:change { value }.
// Combobox    .z-combobox > input.z-input__control[aria-controls] + .z-listbox[popover]. En .z-combobox: data-value,
//             data-filter="false", data-loading, data-empty-text, data-loading-text. z:input { value } al escribir,
//             z:change { value, label }. setComboboxOptions(), setComboboxLoading().
// Calendar    .z-calendar vacío: data-mode="single|range", data-value ("YYYY-MM-DD" o "desde/hasta"), data-month,
//             data-min, data-max, data-locale, data-week-start, data-disabled-weekdays="0,6", data-disabled-dates,
//             data-outside-days="false". z:change { value }.
// DatePicker  .z-select.z-datepicker > button[aria-controls] + .z-popover[popover] con un .z-calendar. Los mismos
//             atributos que Calendar, en .z-datepicker, más data-placeholder y data-date-style. z:change { value }.
// Slider      .z-slider: data-min, data-max, data-step, data-value ("60" o "20,80"), data-orientation, data-disabled.
//             z:change { value, index }.
// OTPInput    .z-otp: data-mode="numeric|text", data-value. z:change { value, complete }.
// FileUpload  .z-upload: data-max-size (bytes); accept y multiple, en el input. Lista opcional: ul.z-upload__files.
//             z:change { files, rejected }.
import * as calendar from "./forms-calendar";
import * as controls from "./forms-controls";
import * as listbox from "./forms-listbox";
import * as popup from "./forms-popup";
import type { Listen } from "./shared";

export { setCalendarValue, setDatePickerValue, type DateRange } from "./forms-calendar";
export { setOtpValue, setSliderValue } from "./forms-controls";
export { setComboboxLoading, setComboboxOptions, setComboboxValue, setSelectValue, type ComboboxOption } from "./forms-listbox";

const parts = [popup, listbox, calendar, controls];

export function setup(on: Listen): void {
  for (const part of parts) part.setup(on);
}

export function hydrate(root: ParentNode): void {
  listbox.hydrate(root);
  calendar.hydrate(root);
  controls.hydrate(root);
}
