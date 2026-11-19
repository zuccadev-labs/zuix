import { useState, type ReactNode } from "react";
import {
  FreeBusy,
  PerpetualYear,
  TimelineView,
  type CalendarEvent,
  type CalendarSource,
  type FreeBusyAttendee,
  type Resource,
  type TimelineGroup,
  type TimelineTask,
} from "@zuccadev-labs/zuix-zui";
import { AGENDA_NOW, AGENDA_TODAY } from "./Agenda";

// Piezas de planificación de la agenda (oleada 2), con los datos del prototipo (agenda.md): jueves 19 de noviembre
// de 2026, 10:42 en Madrid. `?screen=planning-stage&piece=<id>` pinta una sola, a todo el ancho (capturas).
const TZ = "Europe/Madrid";

export const GANTT_GROUPS: TimelineGroup[] = [
  { id: "discovery", title: "Discovery" },
  { id: "ds", title: "Design system" },
  { id: "rollout", title: "Rollout" },
];

export const GANTT_TASKS: TimelineTask[] = [
  { id: "interviews", title: "User interviews", start: "2026-11-09", end: "2026-11-14", group: "discovery", progress: 100, color: "6" },
  { id: "synthesis", title: "Synthesis", start: "2026-11-14", end: "2026-11-18", group: "discovery", progress: 100, color: "6", dependsOn: ["interviews"] },
  { id: "tokens", title: "Tokens v2", start: "2026-11-16", end: "2026-11-24", group: "ds", progress: 80, color: "5", dependsOn: ["synthesis"] },
  { id: "calendar", title: "Calendar components", start: "2026-11-20", end: "2026-12-03", group: "ds", progress: 35, color: "5", dependsOn: ["tokens"] },
  { id: "docs", title: "Docs site", start: "2026-11-24", end: "2026-12-03", group: "ds", progress: 10, color: "1", dependsOn: ["tokens"] },
  { id: "beta", title: "Beta release", start: "2026-12-03", milestone: true, group: "ds", dependsOn: ["calendar"] },
  { id: "guide", title: "Migration guide", start: "2026-12-04", end: "2026-12-10", group: "rollout", progress: 0, color: "1", dependsOn: ["beta"] },
  { id: "launch", title: "Launch", start: "2026-12-12", milestone: true, group: "rollout", dependsOn: ["guide"] },
];

export const ROOMS: Resource[] = [
  { id: "atlas", title: "Atlas", meta: "8 seats · screen" },
  { id: "kepler", title: "Kepler", meta: "4 seats" },
  { id: "nova", title: "Nova", meta: "12 seats · VC" },
  { id: "orion", title: "Orion", meta: "2 seats · booth" },
  { id: "vega", title: "Vega", meta: "20 seats" },
];

export const ROOM_CALENDARS: CalendarSource[] = [
  { id: "work", name: "Work", color: "1" },
  { id: "product", name: "Product", color: "5" },
  { id: "team", name: "Team", color: "6" },
  { id: "personal", name: "Personal", color: "2" },
];

const booking = (id: string, title: string, room: string, from: string, to: string, calendarId: string): CalendarEvent => ({
  id,
  title,
  start: `2026-11-19T${from}`,
  end: `2026-11-19T${to}`,
  timeZone: TZ,
  calendarId,
  resourceIds: [room],
});

export const ROOM_BOOKINGS: CalendarEvent[] = [
  booking("sprint", "Sprint planning", "atlas", "09:00", "10:00", "work"),
  booking("roadmap", "Roadmap sync", "atlas", "11:00", "12:00", "product"),
  booking("board", "Board prep", "atlas", "16:00", "17:30", "work"),
  booking("interview", "Interview: frontend", "kepler", "10:30", "11:30", "team"),
  booking("supplier", "Supplier call", "kepler", "11:00", "12:00", "product"),
  booking("one-to-one", "1:1 Javier", "kepler", "14:00", "15:00", "team"),
  booking("workshop", "Workshop: liquid glass", "nova", "10:00", "12:00", "product"),
  booking("release", "Release review", "nova", "15:00", "16:00", "product"),
  booking("focus", "Focus", "orion", "08:30", "09:30", "personal"),
  booking("phone", "Phone interview", "orion", "13:00", "14:00", "team"),
];

const busy = (from: string, to: string) => ({ start: `2026-11-19T${from}:00+01:00`, end: `2026-11-19T${to}:00+01:00` });
export const GUESTS: FreeBusyAttendee[] = [
  { id: "marta", name: "Marta López", meta: "Organiser · Madrid", timeZone: TZ, workingHours: { start: "08:00", end: "19:00" }, busy: [busy("09:00", "10:30"), busy("12:00", "13:00"), busy("16:00", "18:00")] },
  { id: "javier", name: "Javier Ruiz", meta: "Madrid", timeZone: TZ, workingHours: { start: "08:00", end: "19:00" }, busy: [busy("10:00", "11:00"), busy("15:00", "15:30")] },
  { id: "aiko", name: "Aiko Kato", timeZone: "Asia/Tokyo", workingHours: { start: "08:00", end: "02:00" }, busy: [busy("08:00", "09:30")] },
  { id: "dana", name: "Dana Price", timeZone: "America/New_York", workingHours: { start: "08:00", end: "18:00" }, busy: [busy("17:00", "18:00")] },
  { id: "you", name: "You", meta: "Madrid", timeZone: TZ, workingHours: { start: "08:00", end: "19:00" }, busy: [busy("10:00", "12:00"), busy("13:00", "13:45"), busy("15:00", "16:00")] },
];

export type PieceId = "perpetual" | "gantt" | "resources" | "freebusy";
export const PIECES: PieceId[] = ["perpetual", "gantt", "resources", "freebusy"];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="app-planning__piece" data-piece={id} aria-label={title}>
      {children}
    </section>
  );
}

export function PlanningPieces({ only }: { only?: PieceId | null }) {
  const [tasks, setTasks] = useState(GANTT_TASKS);
  const [bookings, setBookings] = useState(ROOM_BOOKINGS);
  const [log, setLog] = useState("");
  const show = (id: PieceId) => !only || only === id;
  return (
    <div className="app-planning" data-testid="planning">
      {show("perpetual") ? (
        <Section id="perpetual" title="One-page calendar">
          <PerpetualYear id="app-perpetual" defaultHighlight={AGENDA_TODAY} today={AGENDA_TODAY} locale="en-GB" weekStartsOn={1} />
        </Section>
      ) : null}
      {show("gantt") ? (
        <Section id="gantt" title="Timeline">
          <TimelineView
            id="app-gantt"
            title="Design system Q4"
            tasks={tasks}
            groups={GANTT_GROUPS}
            range={{ from: "2026-11-09", to: "2026-12-14" }}
            today={AGENDA_TODAY}
            locale="en-GB"
            weekStartsOn={1}
            editable
            onTaskChange={({ task, start, end }) => {
              setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, start, end: t.milestone ? undefined : end } : t)));
              setLog(`${task.title}: ${start} → ${end}`);
            }}
          />
        </Section>
      ) : null}
      {show("resources") ? (
        <Section id="resources" title="Rooms">
          <TimelineView
            id="app-rooms"
            mode="resources"
            title="Rooms · Thu 19 Nov"
            resources={ROOMS}
            events={bookings}
            calendars={ROOM_CALENDARS}
            date={AGENDA_TODAY}
            today={AGENDA_TODAY}
            now={AGENDA_NOW}
            timeZone={TZ}
            locale="en-GB"
            dayStart="08:00"
            dayEnd="19:00"
            editable
            selectable
            onEventChange={({ event, start, end }) => {
              setBookings((list) => list.map((e) => (e.id === event.id ? { ...e, start, end } : e)));
              setLog(`${event.title}: ${start} → ${end}`);
            }}
            onSelectSlot={(slot) => setLog(`New booking: ${slot.resourceId} ${slot.start} → ${slot.end}`)}
          />
        </Section>
      ) : null}
      {show("freebusy") ? (
        <Section id="freebusy" title="Find a time">
          <FreeBusy
            id="app-freebusy"
            title="Find a time · 1 h"
            attendees={GUESTS}
            date={AGENDA_TODAY}
            timeZone={TZ}
            now={AGENDA_NOW}
            duration={60}
            locale="en-GB"
            dayStart="08:00"
            dayEnd="19:00"
            onSelect={(slot) => setLog(`Use: ${slot.start} → ${slot.end}`)}
          />
        </Section>
      ) : null}
      <p className="app-muted" data-testid="planning-log">
        {log}
      </p>
    </div>
  );
}
