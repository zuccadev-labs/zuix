// Línea temporal (Gantt y recursos): escalas de día, semana y mes, posición de las barras en columnas, filas con
// fases plegables, ruta de las dependencias en codo y camino crítico (método del camino crítico sobre fechas
// planificadas). Puro: fechas civiles `YYYY-MM-DD` con fin exclusivo, coordenadas lógicas (en RTL se refleja el SVG).

import { addDays, addMonths, daysInMonth, diffDays, startOfWeek, valid } from "./date";

export type TimelineScale = "day" | "week" | "month";

export interface TimelineTask {
  id: string;
  title: string;
  /** `YYYY-MM-DD`. */
  start: string;
  /** Exclusivo; un hito tiene `end === start` (o lo omite). */
  end?: string;
  /** Fase a la que pertenece (`TimelineGroup.id`). */
  group?: string;
  /** 0–100. */
  progress?: number;
  /** Tareas que tienen que terminar antes de que esta empiece (fin → inicio). */
  dependsOn?: string[];
  milestone?: boolean;
  /** Color de paleta (`"1"`…`"6"`) o token semántico. */
  color?: string;
  editable?: boolean;
  data?: unknown;
}

export interface TimelineGroup {
  id: string;
  title: string;
  collapsed?: boolean;
}

export const isMilestone = (t: TimelineTask) => Boolean(t.milestone) || !t.end || t.end <= t.start;
export const taskEnd = (t: TimelineTask) => (isMilestone(t) ? t.start : t.end!);
/** Duración en días (0 en un hito). */
export const taskDays = (t: TimelineTask) => Math.max(0, diffDays(t.start, taskEnd(t)));

/* ---------- Escala ---------- */

export interface TimelineColumn {
  /** Primer día de la columna. */
  date: string;
  /** Días que abarca (1 en la escala de días). */
  days: number;
}

/** Inicio de la unidad que contiene `date`. */
export function unitStart(date: string, scale: TimelineScale, weekStart = 1): string {
  if (scale === "week") return startOfWeek(date, weekStart);
  if (scale === "month") return `${date.slice(0, 7)}-01`;
  return date;
}

/** Columnas de la escala que cubren `[from, to)`. */
export function timelineColumns(from: string, to: string, scale: TimelineScale, weekStart = 1): TimelineColumn[] {
  if (!valid(from) || !valid(to) || to <= from) return [];
  const out: TimelineColumn[] = [];
  let d = unitStart(from, scale, weekStart);
  for (let i = 0; d < to && i < 5000; i++) {
    const next = scale === "day" ? addDays(d, 1) : scale === "week" ? addDays(d, 7) : addMonths(d, 1);
    out.push({ date: d, days: diffDays(d, next) });
    d = next;
  }
  return out;
}

/** Posición de un día en columnas (fraccionaria en semanas y meses) desde la primera columna. */
export function columnAt(date: string, columns: TimelineColumn[]): number {
  if (!columns.length) return 0;
  const first = columns[0]!.date;
  if (date <= first) return diffDays(first, date) / columns[0]!.days;
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i]!;
    const end = addDays(c.date, c.days);
    if (date < end) return i + diffDays(c.date, date) / c.days;
  }
  const last = columns[columns.length - 1]!;
  return columns.length + diffDays(addDays(last.date, last.days), date) / last.days;
}

/** Barra de `[start, end)` en columnas: inicio y ancho (un hito tiene ancho 0). */
export function barPosition(start: string, end: string, columns: TimelineColumn[]): { from: number; span: number } {
  const from = columnAt(start, columns);
  return { from, span: Math.max(0, columnAt(end, columns) - from) };
}

/** Días hábiles de una columna: en la escala de meses, cuántos días tiene el mes. */
export const monthDays = (date: string) => daysInMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1);

/* ---------- Filas ---------- */

export type TimelineRow =
  | { kind: "group"; group: TimelineGroup; tasks: TimelineTask[]; start: string; end: string; collapsed: boolean }
  | { kind: "task"; task: TimelineTask; group?: string };

/** Filas en orden: cada fase seguida de sus tareas (si no está plegada); las tareas sin fase, al final. */
export function timelineRows(tasks: TimelineTask[], groups: TimelineGroup[] = [], collapsed: Iterable<string> = []): TimelineRow[] {
  const folded = new Set(collapsed);
  const known = new Set(groups.map((g) => g.id));
  const rows: TimelineRow[] = [];
  for (const group of groups) {
    const own = tasks.filter((t) => t.group === group.id);
    if (!own.length) continue;
    const start = own.map((t) => t.start).sort()[0]!;
    const end = own.map(taskEnd).sort().at(-1)!;
    const isFolded = folded.has(group.id) || Boolean(group.collapsed && !folded.has(`!${group.id}`));
    rows.push({ kind: "group", group, tasks: own, start, end, collapsed: isFolded });
    if (!isFolded) for (const task of own) rows.push({ kind: "task", task, group: group.id });
  }
  for (const task of tasks) if (!task.group || !known.has(task.group)) rows.push({ kind: "task", task });
  return rows;
}

/* ---------- Dependencias ---------- */

export interface Point {
  x: number;
  y: number;
}

/**
 * Ruta en codo de una dependencia fin → inicio, en coordenadas lógicas (x crece en el sentido de lectura). Sale por
 * el fin de la tarea previa, baja o sube hasta la fila de la siguiente y entra por su inicio con un tramo horizontal
 * de `gap` px. Si la siguiente empieza antes del fin de la previa, rodea por el hueco entre filas.
 */
export function routeDependency(from: Point, to: Point, gap = 8, rowGap = 12): Point[] {
  const out: Point[] = [from];
  const exit = from.x + gap;
  const entry = to.x - gap;
  if (entry >= exit) {
    out.push({ x: exit, y: from.y }, { x: exit, y: to.y });
  } else {
    // Rodeo: baja (o sube) medio hueco de fila, vuelve atrás y entra por el inicio.
    const mid = from.y + (to.y >= from.y ? rowGap : -rowGap);
    out.push({ x: exit, y: from.y }, { x: exit, y: mid }, { x: entry, y: mid }, { x: entry, y: to.y });
  }
  out.push(to);
  // Quita puntos repetidos seguidos.
  return out.filter((p, i) => i === 0 || p.x !== out[i - 1]!.x || p.y !== out[i - 1]!.y);
}

/** `d` de un `<path>` SVG a partir de los puntos. */
export const pathOf = (points: Point[]) => points.map((p, i) => `${i ? "L" : "M"}${round(p.x)} ${round(p.y)}`).join(" ");
const round = (n: number) => Math.round(n * 10) / 10;

/** Aristas válidas (fin → inicio) entre tareas que existen, sin las que cerrarían un ciclo. */
export function dependencyEdges(tasks: TimelineTask[]): { from: string; to: string }[] {
  const ids = new Set(tasks.map((t) => t.id));
  const edges: { from: string; to: string }[] = [];
  const succ = new Map<string, string[]>();
  const reaches = (a: string, b: string): boolean => {
    const seen = new Set<string>();
    const stack = [a];
    while (stack.length) {
      const x = stack.pop()!;
      if (x === b) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...(succ.get(x) ?? []));
    }
    return false;
  };
  for (const t of tasks)
    for (const dep of t.dependsOn ?? []) {
      if (!ids.has(dep) || dep === t.id || reaches(t.id, dep)) continue;
      edges.push({ from: dep, to: t.id });
      succ.set(dep, [...(succ.get(dep) ?? []), t.id]);
    }
  return edges;
}

export interface CriticalPath {
  /** Tareas sin holgura. */
  tasks: Set<string>;
  /** Aristas del camino (las dos tareas críticas y sin espera entre ellas). */
  edges: Set<string>;
  /** Fin del proyecto (exclusivo). */
  end: string | null;
}

/**
 * Camino crítico sobre fechas planificadas: pasada hacia delante (inicio temprano = máx(inicio planificado, fin
 * temprano de las previas)), fin del proyecto = el fin temprano mayor, pasada hacia atrás (fin tardío = mín(inicio
 * tardío de las siguientes)). Crítica = holgura 0. Clave de arista: `"<desde>→<hasta>"`.
 */
export function criticalPath(tasks: TimelineTask[]): CriticalPath {
  const edges = dependencyEdges(tasks);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const e of edges) {
    preds.set(e.to, [...(preds.get(e.to) ?? []), e.from]);
    succs.set(e.from, [...(succs.get(e.from) ?? []), e.to]);
  }
  // Orden topológico (Kahn).
  const indeg = new Map(tasks.map((t) => [t.id, preds.get(t.id)?.length ?? 0]));
  const queue = tasks.filter((t) => !indeg.get(t.id)).map((t) => t.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of succs.get(id) ?? []) {
      indeg.set(s, indeg.get(s)! - 1);
      if (!indeg.get(s)) queue.push(s);
    }
  }
  if (!order.length) return { tasks: new Set(), edges: new Set(), end: null };
  const base = order.map((id) => byId.get(id)!.start).sort()[0]!;
  const day = (d: string) => diffDays(base, d);
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    const t = byId.get(id)!;
    const start = Math.max(day(t.start), ...(preds.get(id) ?? []).map((p) => ef.get(p)!));
    es.set(id, start);
    ef.set(id, start + taskDays(t));
  }
  const projectEnd = Math.max(...ef.values());
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const next = succs.get(id) ?? [];
    const finish = next.length ? Math.min(...next.map((s) => ls.get(s)!)) : projectEnd;
    lf.set(id, finish);
    ls.set(id, finish - taskDays(byId.get(id)!));
  }
  const critical = new Set(order.filter((id) => ls.get(id)! - es.get(id)! === 0));
  const path = new Set(
    edges.filter((e) => critical.has(e.from) && critical.has(e.to) && ef.get(e.from) === es.get(e.to)).map((e) => `${e.from}→${e.to}`),
  );
  return { tasks: critical, edges: path, end: addDays(base, projectEnd) };
}

/** Mueve una tarea `days` días (conserva la duración). */
export const shiftTask = (t: TimelineTask, days: number): { start: string; end: string } => ({
  start: addDays(t.start, days),
  end: addDays(taskEnd(t), days),
});

/** Cambia el fin `days` días sin bajar de un día (un hito no cambia de duración). */
export function resizeTask(t: TimelineTask, days: number): { start: string; end: string } {
  if (isMilestone(t)) return { start: t.start, end: t.start };
  const end = addDays(taskEnd(t), days);
  return { start: t.start, end: end <= t.start ? addDays(t.start, 1) : end };
}
