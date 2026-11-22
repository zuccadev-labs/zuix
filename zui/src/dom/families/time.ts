// @zuccadev-labs/zuix-zui/dom/time — Clock, AnalogClock, WorldClock, Countdown, DurationField y TimeZoneSelect sin
// framework. Registro: init(timeModule) o use(timeModule) junto a @zuccadev-labs/zuix-zui/dom/core (TimeZoneSelect
// usa el Combobox del núcleo).
import type { DomModule } from "../shared";
import { timeWidgets, timeZonePart } from "../widgets-time";

export { refreshTimeZoneSelect } from "../widgets-time";
export { destroyWidget, setWidgetProps } from "../widgets";
export { formatDuration, parseISODuration, toISODuration, toMs as durationToMs } from "../../core/duration";

export const timeModule: DomModule = {
  name: "time",
  parts: [timeWidgets, timeZonePart],
};
