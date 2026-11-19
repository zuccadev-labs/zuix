"use client";
import {
  createElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Ref,
} from "react";
import type { AgendaView, CalendarEvent, CalendarSource } from "../../core/agenda";
import { clockMinutes } from "../../core/agenda";
import {
  attachAgenda,
  beginFocusMove,
  everyMinute,
  syncAgenda,
  type AgendaEventName,
  type AgendaHost,
  type EventChange,
  type SlotSelection,
} from "../../core/agenda-control";
import {
  agendaTree,
  mergeLabels,
  initialState,
  type AgendaConfig,
  type AgendaLabels,
  type AgendaLabelsInput,
  type AgendaModel,
  type AgendaState,
  type BusinessHours,
} from "../../core/agenda-view";
import { localeWeekInfo, todayISO, valid } from "../../core/date";
import { safeTimeZone } from "../../core/zone";
import { useMergedRef } from "../../refs";
import { Calendar } from "../forms/Calendar";
import { toReact } from "./vtree";

export type { AgendaView, CalendarEvent, CalendarSource, EventChange, SlotSelection, AgendaLabels, AgendaLabelsInput, BusinessHours };

export interface EventCalendarProps {
  /** Eventos (ISO; ver el modelo en el manifiesto). La agenda no los cambia: avisa con `onEventChange`. */
  events?: CalendarEvent[];
  /** Calendarios: nombre, color y visibilidad; la lista del lateral es la leyenda de color. */
  calendars?: CalendarSource[];
  view?: AgendaView;
  defaultView?: AgendaView;
  onViewChange?: (view: AgendaView) => void;
  /** Vistas que ofrece el selector. */
  views?: AgendaView[];
  /** Ancla de la vista, `YYYY-MM-DD`. */
  date?: string;
  defaultDate?: string;
  onDateChange?: (date: string) => void;
  /** Zona de presentación (IANA). Por defecto, la del dispositivo. */
  timeZone?: string;
  /** Zonas del selector de la barra; sin ellas solo se muestra la zona. */
  timeZones?: string[];
  onTimeZoneChange?: (timeZone: string) => void;
  /** Segundo canal de horas (solo presentación). */
  secondaryTimeZone?: string;
  locale?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Días que no se muestran en la semana (0 domingo … 6 sábado). */
  hiddenDays?: number[];
  /** Rango visible de la rejilla de horas (`HH:mm`) y hora a la que se desplaza al abrir. */
  dayStart?: string;
  dayEnd?: string;
  scrollTime?: string;
  /** Minutos por franja y paso al mover o redimensionar. */
  slotDuration?: number;
  snapDuration?: number;
  businessHours?: BusinessHours[];
  /** Mover y redimensionar (puntero, teclado y «Mover a…»). */
  editable?: boolean;
  /** Crear arrastrando sobre franjas vacías (y con Intro en el cursor de franja). */
  selectable?: boolean;
  /** Mes y fila de todo el día: carriles visibles antes de «+N más». */
  dayMaxEvents?: number;
  fixedWeeks?: boolean;
  /** Días de la vista de agenda. */
  listDays?: number;
  /** Lateral con minicalendario y calendarios. */
  sidebar?: boolean;
  showWeekNumber?: boolean;
  /** Botón «Nuevo evento» en el lateral (llama a `onQuickCreate`). */
  onQuickCreate?: (detail: { date: string }) => void;
  onEventClick?: (detail: { event: CalendarEvent; occurrence: string; seriesId?: string }) => void;
  onEventChange?: (change: EventChange) => void;
  onSelectSlot?: (slot: SlotSelection) => void;
  onCalendarToggle?: (detail: { calendarId: string; visible: boolean }) => void;
  /** Hoy y ahora fijos (servidor y pruebas). */
  today?: string;
  now?: number | string;
  labels?: AgendaLabelsInput;
  /** Vista de línea temporal (`"timeline"`): salas o personas; los eventos las ocupan con `resourceIds`. Sin ellas,
   *  una fila por calendario. */
  resources?: { id: string; title: string; meta?: string }[];
  /** Vista de año: densidad 0…3 de un día (por defecto, por número de eventos: 1, 2–3, 4 o más). */
  density?: (date: string, count: number) => number;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

const ALL_VIEWS: AgendaView[] = ["day", "week", "workweek", "month", "agenda"];
/**
 * Agenda: barra (Hoy, anterior, siguiente, título, zona, vistas), lateral (minicalendario y calendarios) y las vistas
 * de día, semana, semana laboral, mes y agenda sobre el mismo modelo de eventos. Mover, redimensionar y crear con
 * puntero y teclado, y «Mover a…» como alternativa sin arrastre. El marcado y la interacción son los del modo DOM.
 */
export function EventCalendar({
  events = [],
  calendars = [],
  view,
  defaultView = "week",
  onViewChange,
  views = ALL_VIEWS,
  date,
  defaultDate,
  onDateChange,
  timeZone,
  timeZones,
  onTimeZoneChange,
  secondaryTimeZone,
  locale,
  weekStartsOn,
  hiddenDays,
  dayStart = "00:00",
  dayEnd = "24:00",
  scrollTime = "08:00",
  slotDuration = 30,
  snapDuration = 15,
  businessHours,
  editable = false,
  selectable = false,
  dayMaxEvents = 3,
  fixedWeeks = false,
  listDays = 14,
  sidebar = true,
  showWeekNumber = true,
  onQuickCreate,
  onEventClick,
  onEventChange,
  onSelectSlot,
  onCalendarToggle,
  today,
  now,
  labels,
  density,
  resources,
  id,
  className,
  ref,
}: EventCalendarProps) {
  const auto = useId().replace(/:/g, "");
  const uid = id ?? `z-agenda-${auto}`;
  const root = useRef<HTMLDivElement | null>(null);
  const setRoot = useMergedRef(root, ref);
  const zone = useMemo(() => safeTimeZone(timeZone), [timeZone]);
  const nowMs = now === undefined ? undefined : typeof now === "number" ? now : Date.parse(now);
  const config: AgendaConfig = {
    events,
    calendars,
    views: views.length ? views : ALL_VIEWS,
    timeZone: zone,
    timeZones,
    secondaryTimeZone,
    locale,
    weekStart: (weekStartsOn ?? localeWeekInfo(locale).firstDay) % 7,
    hiddenDays,
    dayStart: clockMinutes(dayStart, 0),
    dayEnd: clockMinutes(dayEnd, 1440),
    slotDuration: Math.max(5, slotDuration),
    snapDuration: Math.max(1, snapDuration),
    businessHours,
    editable,
    selectable,
    dayMaxEvents: Math.max(1, dayMaxEvents),
    fixedWeeks,
    listDays: Math.max(1, listDays),
    sidebar,
    showWeekNumber,
    createButton: Boolean(onQuickCreate),
    labels: mergeLabels(labels),
    density,
    resources,
    today: valid(today) ? today : undefined,
    now: Number.isFinite(nowMs) ? nowMs : undefined,
  };

  // «Hoy» y «ahora» se pintan tras hidratar: el HTML del servidor no depende del reloj.
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => {
    setClock(Date.now());
    return everyMinute(() => setClock(Date.now()));
  }, []);
  const anchor = valid(date) ? date : valid(defaultDate) ? defaultDate : (config.today ?? todayISO());

  const state = useRef<AgendaState | null>(null);
  state.current ??= initialState(config, view ?? defaultView, anchor);
  // Lo controlado manda en cada pintado.
  if (view && config.views.includes(view)) state.current.view = view;
  if (valid(date)) state.current.date = date;
  if (timeZone && state.current.timeZone !== zone && !timeZones) state.current.timeZone = zone;

  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const wantFocus = useRef(false);
  const model = useRef<AgendaModel | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const handlers = useRef({
    onViewChange,
    onDateChange,
    onTimeZoneChange,
    onQuickCreate,
    onEventClick,
    onEventChange,
    onSelectSlot,
    onCalendarToggle,
  });
  handlers.current = {
    onViewChange,
    onDateChange,
    onTimeZoneChange,
    onQuickCreate,
    onEventClick,
    onEventChange,
    onSelectSlot,
    onCalendarToggle,
  };

  const host = useMemo<AgendaHost>(
    () => ({
      config: () => configRef.current,
      state: () => state.current!,
      model: () => model.current,
      update(patch, focus) {
        state.current = { ...state.current!, ...patch };
        if (focus) {
          wantFocus.current = true;
          if (root.current) beginFocusMove(root.current);
        }
        rerender();
      },
      emit(name: AgendaEventName, detail: unknown) {
        const h = handlers.current;
        const d = detail as never;
        if (name === "view-change") h.onViewChange?.((detail as { view: AgendaView }).view);
        else if (name === "date-change") h.onDateChange?.((detail as { date: string }).date);
        else if (name === "time-zone-change") h.onTimeZoneChange?.((detail as { timeZone: string }).timeZone);
        else if (name === "quick-create") h.onQuickCreate?.(d);
        else if (name === "event-click") h.onEventClick?.(d);
        else if (name === "event-change") h.onEventChange?.(d);
        else if (name === "select-slot") h.onSelectSlot?.(d);
        else if (name === "calendar-toggle") h.onCalendarToggle?.(d);
      },
    }),
    [],
  );

  useEffect(() => (root.current ? attachAgenda(root.current, host) : undefined), [host]);
  useLayoutEffect(() => {
    if (!root.current) return;
    const focus = wantFocus.current;
    wantFocus.current = false;
    syncAgenda(root.current, host, focus, clockMinutes(scrollTime, 480));
  });

  const { tree, model: built } = agendaTree(config, state.current, clock ?? config.now ?? Date.parse(`${anchor}T12:00:00Z`), {
    id: uid,
    class: className,
  });
  model.current = built;

  const minical = (p: Record<string, unknown>) => (
    <Calendar
      key="minical"
      className="z-agenda__minical"
      value={p.value as string}
      onValueChange={(d) => {
        if (!d) return;
        state.current = { ...state.current!, date: d, focus: null, more: null, detail: null };
        rerender();
        handlers.current.onDateChange?.(d);
      }}
      today={p.today as string}
      locale={p.locale as string | undefined}
      weekStartsOn={p.weekStart as 0}
      showWeekNumber={Boolean(p.showWeekNumber)}
      cellSize="sm"
      weekdayFormat="narrow"
      modifiers={{ "in-view": p.inView as (d: string) => boolean, "has-events": p.hasEvents as (d: string) => boolean }}
    />
  );
  const { className: _c, ...rest } = (toReact(tree, { minical }) as { props: Record<string, unknown> }).props;
  // La raíz lleva la ref; lo demás es el árbol tal cual.
  return createElement("div", { ...rest, className: (tree.a?.class as string) ?? "z-agenda", ref: setRoot });
}
