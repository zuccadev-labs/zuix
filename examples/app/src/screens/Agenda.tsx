import { useState } from "react";
import { Page, PageHeader } from "@zuccadev-labs/zuix-zout";
import { PlanningPieces } from "./Planning";
import { EventCalendar, type AgendaView, type CalendarEvent, type CalendarSource, type EventChange } from "@zuccadev-labs/zuix-zui";

// Semana de referencia de la agenda: jueves 19 de noviembre de 2026, 10:42 en Madrid.
export const AGENDA_TODAY = "2026-11-19";
export const AGENDA_NOW = "2026-11-19T09:42:00Z";
const TZ = "Europe/Madrid";

export const AGENDA_CALENDARS: CalendarSource[] = [
  { id: "work", name: "Work", color: "1" },
  { id: "product", name: "Product", color: "5" },
  { id: "team", name: "Team", color: "6" },
  { id: "personal", name: "Personal", color: "2" },
  { id: "health", name: "Health", color: "4" },
  { id: "travel", name: "Travel", color: "3" },
  { id: "holidays", name: "Holidays in Spain", color: "neutral", editable: false },
];

const ROOM_OF: Record<string, string> = { "Room Atlas": "atlas", "Room Kepler": "kepler", "Room Nova": "nova" };
const at = (date: string, from: string, to: string, rest: Omit<CalendarEvent, "start" | "end" | "id">): CalendarEvent => ({
  id: `${rest.title}-${date}-${from}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  start: `${date}T${from}`,
  end: `${date}T${to}`,
  timeZone: TZ,
  ...(rest.location && ROOM_OF[rest.location] ? { resourceIds: [ROOM_OF[rest.location]!] } : {}),
  ...rest,
});

export const AGENDA_EVENTS: CalendarEvent[] = [
  {
    id: "standup",
    title: "Daily standup",
    start: "2026-11-02T09:00",
    end: "2026-11-02T09:15",
    timeZone: TZ,
    calendarId: "work",
    rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    location: "Meet",
  },
  { id: "web-days", title: "Web Days · Lisbon", start: "2026-11-16", end: "2026-11-19", calendarId: "travel" },
  { id: "ana", title: "Ana visiting", start: "2026-11-19", end: "2026-11-24", calendarId: "personal" },
  { id: "freeze", title: "Deploy freeze", start: "2026-11-20", end: "2026-11-21", calendarId: "product" },
  { id: "sprint", title: "Sprint 47", start: "2026-11-09", end: "2026-11-21", calendarId: "work" },
  at("2026-11-16", "10:00", "11:30", { title: "Design review", calendarId: "product", location: "Room Atlas" }),
  at("2026-11-16", "13:00", "14:00", { title: "Lunch with Ana", calendarId: "personal", location: "La Pepita" }),
  {
    id: "one-to-one",
    title: "1:1 with Marta",
    start: "2026-11-02T16:00",
    end: "2026-11-02T17:00",
    timeZone: TZ,
    calendarId: "work",
    rrule: "FREQ=WEEKLY;INTERVAL=2",
  },
  at("2026-11-17", "11:00", "12:30", { title: "Roadmap sync", calendarId: "product", location: "Room Nova" }),
  at("2026-11-17", "11:30", "12:30", { title: "Customer call", calendarId: "work" }),
  at("2026-11-17", "15:00", "17:00", { title: "Focus: tokens refactor", calendarId: "team" }),
  at("2026-11-18", "10:00", "12:00", { title: "Workshop: liquid glass", calendarId: "product", location: "Room Atlas" }),
  at("2026-11-18", "12:30", "13:00", { title: "Quick sync", calendarId: "work" }),
  at("2026-11-18", "14:00", "15:00", { title: "Dentist", calendarId: "health", location: "Clínica Sol" }),
  at("2026-11-18", "17:00", "18:00", { title: "Pick up parcel", calendarId: "personal", status: "tentative" }),
  at("2026-11-19", "07:30", "08:30", { title: "Gym", calendarId: "health" }),
  {
    id: "planning",
    title: "Sprint planning",
    start: "2026-11-05T10:00",
    end: "2026-11-05T11:00",
    timeZone: TZ,
    calendarId: "work",
    rrule: "FREQ=WEEKLY",
    location: "Room Atlas",
  },
  at("2026-11-19", "10:30", "12:00", { title: "Vendor demo", calendarId: "product", status: "tentative", location: "Zoom" }),
  at("2026-11-19", "10:30", "11:30", { title: "Interview: frontend", calendarId: "team", location: "Room Kepler" }),
  at("2026-11-19", "13:00", "13:45", { title: "Lunch", calendarId: "personal" }),
  at("2026-11-19", "15:00", "16:00", { title: "Release review", calendarId: "product", location: "Room Nova" }),
  {
    id: "piano",
    title: "Piano lesson",
    start: "2026-11-05T17:30",
    end: "2026-11-05T18:30",
    timeZone: TZ,
    calendarId: "personal",
    rrule: "FREQ=WEEKLY",
  },
  at("2026-11-20", "12:00", "13:30", { title: "Team lunch", calendarId: "team", location: "Mercado" }),
  at("2026-11-20", "14:00", "15:00", { title: "Accessibility audit", calendarId: "work" }),
  at("2026-11-21", "10:00", "12:30", { title: "Climbing", calendarId: "personal", location: "Sputnik" }),
  at("2026-11-22", "11:00", "12:00", { title: "Call with mum", calendarId: "personal" }),
  { id: "invoices", title: "Send invoices", start: "2026-11-23", end: "2026-11-24", calendarId: "work", kind: "task" },
  { id: "passport", title: "Renew passport", start: "2026-11-13", end: "2026-11-14", calendarId: "personal", kind: "task", done: true },
  { id: "porto", title: "Weekend in Porto", start: "2026-11-27", end: "2026-12-01", calendarId: "travel" },
  { id: "constitution", title: "Constitution Day", start: "2026-12-06", end: "2026-12-07", calendarId: "holidays" },
  at("2026-11-04", "18:30", "19:30", { title: "Yoga", calendarId: "health", rrule: "FREQ=WEEKLY" }),
];

// Salas de la vista de línea temporal; algunos eventos las ocupan (resourceIds).
const AGENDA_ROOMS = [
  { id: "atlas", title: "Room Atlas", meta: "8 seats" },
  { id: "kepler", title: "Room Kepler", meta: "4 seats" },
  { id: "nova", title: "Room Nova", meta: "12 seats" },
];

const VIEWS: AgendaView[] = ["day", "week", "workweek", "month", "agenda", "year", "perpetual", "timeline"];

export function AgendaScreen({ bare = false }: { bare?: boolean }) {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("agenda-view");
  const [events, setEvents] = useState(AGENDA_EVENTS);
  const [log, setLog] = useState<string>("");
  const [current, setCurrent] = useState<AgendaView>((VIEWS as string[]).includes(requested ?? "") ? (requested as AgendaView) : "week");
  const apply = (change: EventChange) => {
    // Una ocurrencia de una serie se guarda como excepción; un evento suelto se mueve.
    setEvents((list) =>
      change.seriesId
        ? [
            ...list,
            {
              ...change.event,
              id: `${change.occurrence}-moved`,
              seriesId: change.seriesId,
              recurrenceId: change.occurrence.split("::")[1],
              rrule: undefined,
              start: change.start,
              end: change.end,
            },
          ]
        : list.map((e) => (e.id === change.event.id ? { ...e, start: change.start, end: change.end } : e)),
    );
    setLog(`${change.event.title}: ${change.start} → ${change.end}`);
  };
  const content = (
    <div data-testid="agenda-screen">
      <EventCalendar
        id="app-agenda"
        events={events}
        calendars={AGENDA_CALENDARS}
        views={VIEWS}
        view={current}
        onViewChange={setCurrent}
        // La segunda zona (Nueva York) solo en el día, como en el prototipo.
        secondaryTimeZone={current === "day" ? "America/New_York" : undefined}
        defaultDate={AGENDA_TODAY}
        today={AGENDA_TODAY}
        now={AGENDA_NOW}
        timeZone={TZ}
        timeZones={[TZ, "America/New_York", "Asia/Tokyo"]}
        locale="en-GB"
        weekStartsOn={1}
        dayStart="07:00"
        dayEnd="21:00"
        scrollTime="09:00"
        businessHours={[{ days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" }]}
        editable
        selectable
        onEventChange={apply}
        onSelectSlot={(slot) => setLog(`New event: ${slot.start} → ${slot.end}`)}
        onQuickCreate={() => setLog("Quick create")}
        resources={AGENDA_ROOMS}
      />
      <p className="app-muted" data-testid="agenda-log">
        {log}
      </p>
    </div>
  );
  if (bare) return content;
  // Fuera de la captura: debajo, las piezas de planificación (línea temporal, recursos, franjas, estancia…).
  return (
    <Page
      header={<PageHeader eyebrow="Components" title="Agenda" description="Day, week, work week, month and list over one event model." />}
    >
      {content}
      <PlanningPieces />
    </Page>
  );
}
