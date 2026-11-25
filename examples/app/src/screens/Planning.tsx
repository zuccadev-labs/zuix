import { useState, type ReactNode } from "react";
import {
  Button,
  Calendar,
  CalendarHeatmap,
  FreeBusy,
  HabitCalendar,
  PerpetualYear,
  SlotPicker,
  TimelineView,
  type CalendarEvent,
  type CalendarSource,
  type DateRange,
  type FreeBusyAttendee,
  type HabitState,
  type Resource,
  type TimelineGroup,
  type TimelineTask,
} from "@zuccadev-labs/zuix-zui";
import { AGENDA_NOW, AGENDA_TODAY } from "./Agenda";

// Piezas de planificación de la agenda, con la semana de referencia: jueves 19 de noviembre
// de 2026, 10:42 en Madrid. `?screen=planning-stage&piece=<id>` pinta una sola, a todo el ancho (capturas).
const TZ = "Europe/Madrid";

export const GANTT_GROUPS: TimelineGroup[] = [
  { id: "discovery", title: "Discovery" },
  { id: "ds", title: "Design system" },
  { id: "rollout", title: "Rollout" },
];

export const GANTT_TASKS: TimelineTask[] = [
  { id: "interviews", title: "User interviews", start: "2026-11-09", end: "2026-11-14", group: "discovery", progress: 100, color: "6" },
  {
    id: "synthesis",
    title: "Synthesis",
    start: "2026-11-14",
    end: "2026-11-18",
    group: "discovery",
    progress: 100,
    color: "6",
    dependsOn: ["interviews"],
  },
  {
    id: "tokens",
    title: "Tokens v2",
    start: "2026-11-16",
    end: "2026-11-24",
    group: "ds",
    progress: 80,
    color: "5",
    dependsOn: ["synthesis"],
  },
  {
    id: "calendar",
    title: "Calendar components",
    start: "2026-11-20",
    end: "2026-12-03",
    group: "ds",
    progress: 35,
    color: "5",
    dependsOn: ["tokens"],
  },
  { id: "docs", title: "Docs site", start: "2026-11-24", end: "2026-12-03", group: "ds", progress: 10, color: "1", dependsOn: ["tokens"] },
  { id: "beta", title: "Beta release", start: "2026-12-03", milestone: true, group: "ds", dependsOn: ["calendar"] },
  {
    id: "guide",
    title: "Migration guide",
    start: "2026-12-04",
    end: "2026-12-10",
    group: "rollout",
    progress: 0,
    color: "1",
    dependsOn: ["beta"],
  },
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
  {
    id: "marta",
    name: "Marta López",
    meta: "Organiser · Madrid",
    timeZone: TZ,
    workingHours: { start: "08:00", end: "19:00" },
    busy: [busy("09:00", "10:30"), busy("12:00", "13:00"), busy("16:00", "18:00")],
  },
  {
    id: "javier",
    name: "Javier Ruiz",
    meta: "Madrid",
    timeZone: TZ,
    workingHours: { start: "08:00", end: "19:00" },
    busy: [busy("10:00", "11:00"), busy("15:00", "15:30")],
  },
  { id: "aiko", name: "Aiko Kato", timeZone: "Asia/Tokyo", workingHours: { start: "08:00", end: "02:00" }, busy: [busy("08:00", "09:30")] },
  {
    id: "dana",
    name: "Dana Price",
    timeZone: "America/New_York",
    workingHours: { start: "08:00", end: "18:00" },
    busy: [busy("17:00", "18:00")],
  },
  {
    id: "you",
    name: "You",
    meta: "Madrid",
    timeZone: TZ,
    workingHours: { start: "08:00", end: "19:00" },
    busy: [busy("10:00", "12:00"), busy("13:00", "13:45"), busy("15:00", "16:00")],
  },
];

export type PieceId = "perpetual" | "gantt" | "resources" | "freebusy" | "slots" | "stay" | "heatmap" | "habits" | "cells";
export const PIECES: PieceId[] = ["perpetual", "gantt", "resources", "freebusy", "slots", "stay", "heatmap", "habits", "cells"];

// Estancia: noches reservadas y días de solo salida.
const BOOKED = new Set(["2026-11-20", "2026-11-21", "2026-11-22", "2026-12-05", "2026-12-06", "2026-12-07", "2026-12-08"]);
const CHECKOUT_ONLY = new Set(["2026-11-19", "2026-12-04"]);
const nightsOf = (r: DateRange | null) =>
  r?.from && r.to ? Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) : 0;
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    Date.parse(`${iso}T00:00:00Z`),
  );

// Contenido por celda: precios (el más barato con borde y «lowest»), historias y seguimiento de ciclo.
const PRICES: Record<string, number> = {};
for (let d = 1; d <= 31; d++)
  PRICES[`2026-12-${String(d).padStart(2, "0")}`] = [
    79, 108, 137, 128, 93, 136, 115, 39, 61, 126, 72, 129, 107, 125, 41, 140, 73, 90, 83, 85, 112, 79, 95, 0, 0, 111, 128, 140, 137, 147,
    68,
  ][d - 1]!;
const STORIES: Record<string, number> = {
  "2026-11-01": 1,
  "2026-11-02": 1,
  "2026-11-04": 2,
  "2026-11-05": 1,
  "2026-11-07": 1,
  "2026-11-08": 3,
  "2026-11-11": 1,
  "2026-11-12": 2,
  "2026-11-13": 1,
  "2026-11-14": 1,
  "2026-11-15": 1,
  "2026-11-16": 2,
  "2026-11-19": 1,
};
const inSet = (list: string[]) => (d: string) => list.includes(d);
const CYCLE = {
  period: inSet(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]),
  predicted: inSet(["2026-11-28", "2026-11-29", "2026-11-30"]),
  fertile: inSet(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]),
  ovulation: inSet(["2026-11-17"]),
};
const SYMPTOMS: Record<string, number> = { "2026-11-02": 1, "2026-11-03": 2, "2026-11-16": 1, "2026-11-21": 1 };

// Contribuciones de 2026 (deterministas: un generador sencillo con semilla, sin Math.random).
function contributions(): Record<string, number> {
  const out: Record<string, number> = {};
  let seed = 7;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let d = new Date(Date.UTC(2026, 0, 1)); d <= new Date(Date.UTC(2026, 10, 19)); d.setUTCDate(d.getUTCDate() + 1)) {
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const r = next();
    const v = r < (weekend ? 0.55 : 0.18) ? 0 : Math.round(r * (weekend ? 4 : 9));
    if (v) out[d.toISOString().slice(0, 10)] = v;
  }
  for (let i = 0; i < 12; i++)
    out[`2026-11-${String(8 + i).padStart(2, "0")}`] = Math.max(out[`2026-11-${String(8 + i).padStart(2, "0")}`] ?? 0, 3 + (i % 4));
  out["2026-11-12"] = 14;
  return out;
}
export const CONTRIBUTIONS = contributions();

export const HABITS: Record<string, HabitState> = {
  "2026-11-02": "done",
  "2026-11-03": "done",
  "2026-11-04": "missed",
  "2026-11-05": "done",
  "2026-11-06": "done",
  "2026-11-07": "done",
  "2026-11-08": "rest",
  "2026-11-09": "done",
  "2026-11-10": "done",
  "2026-11-11": "missed",
  "2026-11-12": "done",
  "2026-11-13": "done",
  "2026-11-14": "done",
  "2026-11-15": "rest",
  "2026-11-16": "done",
  "2026-11-17": "done",
  "2026-11-18": "done",
  "2026-11-19": { progress: 60 },
};
const LESSONS: Record<string, HabitState> = { "2026-11-16": "done", "2026-11-17": "done", "2026-11-18": "done" };

// Disponibilidad del anfitrión (Madrid): días laborables 09:00–17:00, franjas de 30 min, algunas ya reservadas.
const HOST_BUSY = [
  { start: "2026-11-24T09:00:00Z", end: "2026-11-24T09:30:00Z" },
  { start: "2026-11-24T11:00:00Z", end: "2026-11-24T12:00:00Z" },
  { start: "2026-11-24T13:00:00Z", end: "2026-11-24T14:30:00Z" },
  { start: "2026-11-25T08:00:00Z", end: "2026-11-25T16:00:00Z" },
  { start: "2026-11-20T08:00:00Z", end: "2026-11-20T14:00:00Z" },
];

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
  const [stay, setStay] = useState<DateRange>({ from: "2026-11-24", to: "2026-11-29" });
  const [flex, setFlex] = useState(1);
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
      {show("slots") ? (
        <Section id="slots" title="Book a call">
          <div className="app-booking z-liquid">
            <div className="app-booking__host">
              <span className="z-avatar" data-size="md" aria-hidden="true">
                ML
              </span>
              <p className="app-muted">Marta López</p>
              <h3>Intro call · 30 min</h3>
              <p className="app-muted">Video call, link after booking · Host in Europe/Madrid</p>
            </div>
            <SlotPicker
              id="app-slots"
              availability={[{ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }]}
              hostTimeZone={TZ}
              duration={30}
              step={30}
              from={AGENDA_TODAY}
              to="2026-11-30"
              busy={HOST_BUSY}
              timeZone={TZ}
              timeZones={[TZ, "America/New_York", "Asia/Tokyo"]}
              now={AGENDA_NOW}
              today={AGENDA_TODAY}
              date="2026-11-24"
              locale="en-GB"
              weekStartsOn={1}
              onSelect={(slot) => setLog(`Slot: ${slot.start}`)}
              onConfirm={(slot) => setLog(`Confirm: ${slot.start}`)}
            />
          </div>
        </Section>
      ) : null}
      {show("stay") ? (
        <Section id="stay" title="Stay">
          <div className="app-stay z-liquid" data-testid="stay">
            <div className="app-stay__head">
              <div>
                <h3>{nightsOf(stay)} nights in Lisbon</h3>
                <p className="app-muted">
                  {stay.from ? shortDate(stay.from) : "—"} – {stay.to ? shortDate(stay.to) : "—"} · min. 2 nights
                </p>
              </div>
              <div className="app-stay__fields" aria-hidden="true">
                <div data-active={stay.from && !stay.to ? undefined : ""}>
                  <small>Check-in</small>
                  {stay.from ? shortDate(stay.from) : "Add date"}
                </div>
                <div data-active={stay.from && !stay.to ? "" : undefined}>
                  <small>Check-out</small>
                  {stay.to ? shortDate(stay.to) : "Add date"}
                </div>
              </div>
            </div>
            <Calendar
              id="app-stay-calendar"
              className="app-stay__calendar"
              mode="range"
              value={stay}
              onValueChange={setStay}
              numberOfMonths={2}
              defaultMonth="2026-11"
              today={AGENDA_TODAY}
              locale="en-GB"
              weekStartsOn={1}
              cellSize="lg"
              rangeUnit="nights"
              minRange={2}
              isDateUnavailable={(d) => BOOKED.has(d)}
              isDateCheckoutOnly={(d) => CHECKOUT_ONLY.has(d)}
              unavailableLabel="booked"
              flexibility={flex}
              onFlexibilityChange={setFlex}
              showLengthStepper
              footer={
                <>
                  <span className="app-muted">20–22 Nov booked · 4 Dec check-out only</span>
                  <span className="app-stay__actions">
                    <Button variant="ghost" size="sm" onClick={() => setStay({ from: null, to: null })}>
                      Clear dates
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setLog(`Stay: ${stay.from} → ${stay.to} ±${flex}`)}>
                      Close
                    </Button>
                  </span>
                </>
              }
            />
          </div>
        </Section>
      ) : null}
      {show("heatmap") ? (
        <Section id="heatmap" title="Contributions">
          <div className="app-planning__stack">
            <CalendarHeatmap
              id="app-heatmap"
              title={`${Object.values(CONTRIBUTIONS)
                .reduce((a, b) => a + b, 0)
                .toLocaleString("en-GB")} contributions in 2026`}
              values={CONTRIBUTIONS}
              range={{ from: "2026-01-01", to: "2026-12-31" }}
              today={AGENDA_TODAY}
              locale="en-GB"
              weekStartsOn={1}
              onDayClick={({ date, value }) => setLog(`Day: ${date} ${value}`)}
            />
            <div className="app-planning__row">
              <CalendarHeatmap
                id="app-heatmap-12"
                title="Last 12 weeks · color"
                values={CONTRIBUTIONS}
                range={{ from: "2026-08-31", to: AGENDA_TODAY }}
                today={AGENDA_TODAY}
                locale="en-GB"
                weekStartsOn={1}
                showStats={false}
              />
              <CalendarHeatmap
                id="app-heatmap-size"
                title="Last 12 weeks · size + color"
                values={CONTRIBUTIONS}
                range={{ from: "2026-08-31", to: AGENDA_TODAY }}
                today={AGENDA_TODAY}
                locale="en-GB"
                weekStartsOn={1}
                encoding="size"
                showStats={false}
              />
            </div>
          </div>
        </Section>
      ) : null}
      {show("habits") ? (
        <Section id="habits" title="Habits">
          <div className="app-planning__row">
            <HabitCalendar
              id="app-habit"
              states={HABITS}
              subtitle="Read 20 minutes"
              today={AGENDA_TODAY}
              locale="en-GB"
              weekStartsOn={1}
              onDayClick={({ date }) => setLog(`Habit: ${date}`)}
            />
            <HabitCalendar
              id="app-habit-week"
              variant="week"
              states={LESSONS}
              subtitle="Practice German"
              note="Complete a lesson today to reach 4 days."
              today={AGENDA_TODAY}
              locale="en-GB"
              weekStartsOn={1}
            />
          </div>
        </Section>
      ) : null}
      {show("cells") ? (
        <Section id="cells" title="Content per cell">
          <div className="app-planning__row app-cells">
            <div className="app-cells__card z-liquid">
              <h3>
                Madrid → Lisbon <small>one way · from</small>
              </h3>
              <Calendar
                id="app-prices"
                className="app-cells--prices"
                defaultMonth="2026-12"
                defaultValue="2026-12-12"
                today={AGENDA_TODAY}
                locale="en-GB"
                weekStartsOn={1}
                cellSize="lg"
                isDateDisabled={(d) => PRICES[d] === 0}
                modifiers={{ cheap: (d) => PRICES[d] !== undefined && PRICES[d]! > 0 && PRICES[d]! < 50 }}
                renderDay={(d) => (PRICES[d] === undefined ? null : PRICES[d] ? `€${PRICES[d]}` : "—")}
                getDayDescription={(d) =>
                  PRICES[d] === undefined ? null : PRICES[d] === 0 ? "sold out" : `€${PRICES[d]}${PRICES[d]! < 50 ? ", lowest" : ""}`
                }
              />
              <p className="app-cells__legend">
                <span data-key="cheap">€39 Lowest</span> <span data-key="selected">Selected</span> <span>— Sold out</span>
              </p>
            </div>
            <div className="app-cells__card z-liquid">
              <h3>
                Stories archive <small>2026</small>
              </h3>
              <Calendar
                id="app-stories"
                className="app-cells--stories"
                defaultMonth="2026-11"
                today={AGENDA_TODAY}
                locale="en-GB"
                weekStartsOn={1}
                cellSize="lg"
                modifiers={{
                  story: (d) => Boolean(STORIES[d]),
                  "story-a": (d) => Number(d.slice(8)) % 3 === 0,
                  "story-b": (d) => Number(d.slice(8)) % 3 === 1,
                }}
                renderDay={(d) => (STORIES[d] && STORIES[d]! > 1 ? `+${STORIES[d]! - 1}` : null)}
                getDayDescription={(d) => (STORIES[d] ? `${STORIES[d]} ${STORIES[d] === 1 ? "story" : "stories"}` : "no story")}
              />
              <p className="app-cells__legend">
                <span>+n several stories</span> <span>Empty: no story</span>
              </p>
            </div>
            <div className="app-cells__card z-liquid">
              <h3>
                Cycle <small>day 19</small>
              </h3>
              <Calendar
                id="app-cycle"
                className="app-cells--cycle"
                defaultMonth="2026-11"
                today={AGENDA_TODAY}
                locale="en-GB"
                weekStartsOn={1}
                cellSize="lg"
                modifiers={CYCLE}
                renderDay={(d) => (SYMPTOMS[d] ? "•".repeat(SYMPTOMS[d]!) : null)}
                getDayDescription={(d) =>
                  [
                    CYCLE.period(d) ? "period" : null,
                    CYCLE.predicted(d) ? "predicted period" : null,
                    CYCLE.fertile(d) ? "fertile window" : null,
                    CYCLE.ovulation(d) ? "ovulation" : null,
                    SYMPTOMS[d] ? `${SYMPTOMS[d]} symptom${SYMPTOMS[d] === 1 ? "" : "s"}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || null
                }
              />
              <p className="app-cells__legend">
                <span data-key="period">Period</span> <span data-key="predicted">Predicted</span> <span data-key="fertile">Fertile</span>{" "}
                <span data-key="ovulation">Ovulation</span> <span>• Symptom</span>
              </p>
            </div>
          </div>
        </Section>
      ) : null}
      <p className="app-muted" data-testid="planning-log">
        {log}
      </p>
    </div>
  );
}
