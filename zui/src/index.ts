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
export * from "./components/effects";
export * from "./components/media";
export * from "./components/time";
export * from "./components/terminal";
export * from "./components/dashboard";
export * from "./components/people";
export { cx } from "./cx";
// Patrones del cargador DotMatrix (los mismos que dibuja el modo sin framework).
export { DOT_PATTERNS, type DotPattern } from "./core/dotmatrix";
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
// Color de la aplicación (el valor de ColorPicker): lectura de cadenas CSS, conversiones y escritura estable.
export {
  contrastRatio,
  formatColor,
  formatOf,
  hslToRgb,
  hsvToRgb,
  normalizeColor,
  oklchToRgb,
  parseColor,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  type Hsla,
  type Hsva,
  type Oklch,
  type Rgba,
} from "./core/color";
// Duraciones y zonas horarias (las que usan FormatDuration, DurationField, Countdown y TimeZoneSelect).
export {
  formatDuration,
  parseISODuration,
  toISODuration,
  toMs as durationToMs,
  type DurationInput,
  type DurationParts,
  type DurationStyle,
  type DurationUnit,
} from "./core/duration";
export { groupZones, listTimeZones, offsetText, zoneOptions, type ZoneGroup, type ZoneOption } from "./core/timezones";
// Terminal y código: ANSI, diferencias y resaltado (los que usan Terminal, DiffViewer y CodeViewer).
export { createAnsiScreen, parseAnsi, stripAnsi, type AnsiLine, type AnsiScreen, type AnsiSpan, type AnsiStyle } from "./core/ansi";
export { diffLines, parsePatch, toHunks, wordDiff, type DiffFile, type DiffHunk, type DiffLine } from "./core/diff";
export { tokenize, tokenizeLines, type CodeToken, type TokenType } from "./core/code-tokens";
// Dashboard y tableros: variación y ritmo, disposición de la rejilla y movimientos del kanban (los que usan las piezas).
export {
  computeDelta,
  computePace,
  elapsedFraction,
  type Delta,
  type DeltaDirection,
  type DeltaPositive,
  type DeltaSentiment,
  type Pace,
  type PaceStatus,
} from "./core/metric";
export {
  compact as compactLayout,
  fitColumns,
  moveItem as moveGridItem,
  normalizeLayout,
  parseLayout,
  resizeItem as resizeGridItem,
  serializeLayout,
  sortLayout,
  type GridItem,
  type GridLayout,
} from "./core/grid-layout";
export { locateCard, moveCard } from "./core/kanban";
export { funnelStages } from "./core/funnel";
// Usuarios y perfiles: presencia, iniciales, miembros y validación del perfil.
export { presenceText, presenceRank, PRESENCE_LABELS, type PresenceLabels as PresenceText } from "./core/user-presence";
export { initialsOf } from "./core/initials";
export { filterMembers, groupMembers, sortByName, sortByPresence } from "./core/members";
export { validateProfile, validHandle, bioCounter } from "./core/profile";
