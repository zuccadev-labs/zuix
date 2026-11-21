// @zuccadev-labs/zuix-zui/dom/agenda — EventCalendar, TimelineView, PerpetualYear, FreeBusy, SlotPicker,
// CalendarHeatmap y HabitCalendar sin framework. Trae también la familia de fechas (el calendario de la barra
// lateral y el de SlotPicker). Registro: init(agendaModule) o use(agendaModule) junto a @zuccadev-labs/zuix-zui/dom/core.
import * as agenda from "../agenda";
import type { DomModule } from "../shared";
import { agendaWidgets } from "../widgets-agenda";
import { datesModule } from "./dates";

export {
  destroyAgenda,
  setAgendaCalendars,
  setAgendaEvents,
  setAgendaOptions,
  setAgendaView,
  type CalendarEvent,
  type CalendarSource,
} from "../agenda";
export { destroyWidget, setWidgetProps } from "../widgets";

export const agendaModule: DomModule = {
  name: "agenda",
  requires: [datesModule],
  parts: [{ rank: 42, setup: agenda.setup, hydrate: agenda.hydrate, teardown: agenda.destroyAgendas }, agendaWidgets],
};
