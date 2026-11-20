import { useState } from "react";
import { EventCalendar, TimelineView, type AgendaView, type CalendarEvent, type Resource } from "@zuccadev-labs/zuix-zui";

// Rendimiento (agenda.md §6): 5000 eventos en un mes y 500 recursos. Datos deterministas.
const TZ = "Europe/Madrid";
const CALS = ["work", "product", "team", "personal", "health", "travel"];

export function perfEvents(n: number): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  let seed = 11;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < n; i++) {
    const day = 1 + Math.floor(next() * 30);
    const hour = 7 + Math.floor(next() * 12);
    const minutes = [0, 15, 30, 45][Math.floor(next() * 4)]!;
    const length = [15, 30, 45, 60, 90, 120][Math.floor(next() * 6)]!;
    const start = hour * 60 + minutes;
    const end = Math.min(start + length, 23 * 60 + 45);
    const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const date = `2026-11-${String(day).padStart(2, "0")}`;
    out.push({
      id: `p${i}`,
      title: `Event ${i}`,
      start: `${date}T${t(start)}`,
      end: `${date}T${t(end)}`,
      timeZone: TZ,
      calendarId: CALS[i % CALS.length]!,
      resourceIds: [`r${i % 500}`],
    });
  }
  return out;
}

export function PerfStage({ n = 5000 }: { n?: number }) {
  const [events] = useState(() => perfEvents(n));
  const [resources] = useState<Resource[]>(() => Array.from({ length: 500 }, (_, i) => ({ id: `r${i}`, title: `Room ${i + 1}`, meta: `${2 + (i % 18)} seats` })));
  const [view, setView] = useState<AgendaView>("month");
  return (
    <div className="app-planning" data-testid="perf">
      <EventCalendar
        id="perf-agenda"
        events={events}
        calendars={CALS.map((id, i) => ({ id, name: id, color: String((i % 6) + 1) as "1" }))}
        views={["day", "week", "month", "agenda", "year"]}
        view={view}
        onViewChange={setView}
        defaultDate="2026-11-19"
        today="2026-11-19"
        now="2026-11-19T09:42:00Z"
        timeZone={TZ}
        locale="en-GB"
        weekStartsOn={1}
        listDays={30}
      />
      <TimelineView
        id="perf-rooms"
        mode="resources"
        title="500 rooms"
        resources={resources}
        events={events}
        date="2026-11-19"
        today="2026-11-19"
        timeZone={TZ}
        locale="en-GB"
      />
    </div>
  );
}
