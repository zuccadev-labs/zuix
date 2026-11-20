// @zuccadev-labs/zuix-zui — punto de entrada. Cada grupo es dueño de su carpeta y de su hoja de estilos.
export * from "./components/actions";
export * from "./components/forms";
export * from "./components/data";
export * from "./components/feedback";
export * from "./components/content";
export * from "./components/overlay";
export * from "./components/navigation";
export * from "./components/carousel";
export * from "./components/agenda";
export * from "./components/charts";
export { cx } from "./cx";
// Utilidades de fechas civiles (cadenas ISO, sin zona) que comparten Calendar y los selectores.
export {
  formatDateRange,
  isoWeekText,
  localeWeekInfo,
  PRESET_KEYS,
  rangePresets,
  resolvePreset,
  weekNumber,
  weekStartOf,
  type PresetKey,
} from "./core/date";
// Agenda: zonas horarias, recurrencia y cálculo de eventos (los mismos que usa EventCalendar).
export { expandEvents, layoutTimed, layoutRow, rewriteSpan, type CalendarColor, type Occurrence } from "./core/agenda";
export { expandDates, parseRRule, formatRRule, type RRule } from "./core/rrule";
export { fromWall, toWall, wallStatus, type Disambiguation, type Wall } from "./core/zone";
