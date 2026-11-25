// Historias (patrón de Instagram): grupos por persona, cada uno con sus historias; una barra por historia que se llena
// con el tiempo. Máquina de estados pura con reloj inyectado (`now` en ms): quien pinta llama a `tick(now)` en cada
// fotograma y lee `progress`. Sin temporizadores ni documento.

export interface StoriesShape {
  /** Número de historias de cada grupo (al menos una). */
  sizes: readonly number[];
  /** Duración de cada historia, por grupo e índice (ms). */
  duration: (group: number, item: number) => number;
}

export interface StoriesState {
  group: number;
  item: number;
  /** Tiempo transcurrido de la historia actual (ms). */
  elapsed: number;
  /** Pausa de la persona (botón, Espacio). */
  paused: boolean;
  /** Retenida sin decidirlo la persona (pulsación larga, pestaña oculta, fuera de pantalla, movimiento reducido). */
  held: boolean;
  /** Se acabó la última historia del último grupo. */
  done: boolean;
}

export type StoriesEvent = { type: "item" } | { type: "group" } | { type: "complete" };

export const MIN_DURATION = 1000;
export const DEFAULT_STORY_DURATION = 5000;

export const durationOf = (v: unknown, fallback = DEFAULT_STORY_DURATION) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.max(MIN_DURATION, v) : fallback;

export const initialStories = (group = 0, sizes: readonly number[] = []): StoriesState => ({
  group: Math.max(0, Math.min(sizes.length - 1, Math.floor(group))) || 0,
  item: 0,
  elapsed: 0,
  paused: false,
  held: false,
  done: false,
});

const sizeOf = (shape: StoriesShape, g: number) => Math.max(1, Math.floor(shape.sizes[g] ?? 1));

/** Avanza a la historia siguiente (o al grupo siguiente). Devuelve el estado nuevo y qué cambió. */
export function nextStory(shape: StoriesShape, s: StoriesState): [StoriesState, StoriesEvent | null] {
  if (s.item + 1 < sizeOf(shape, s.group)) return [{ ...s, item: s.item + 1, elapsed: 0, done: false }, { type: "item" }];
  if (s.group + 1 < shape.sizes.length) return [{ ...s, group: s.group + 1, item: 0, elapsed: 0, done: false }, { type: "group" }];
  return [{ ...s, elapsed: shape.duration(s.group, s.item), done: true }, { type: "complete" }];
}

/** Vuelve a la historia anterior (o a la última del grupo anterior). Al principio de todo, reinicia la primera. */
export function prevStory(shape: StoriesShape, s: StoriesState): [StoriesState, StoriesEvent | null] {
  if (s.item > 0) return [{ ...s, item: s.item - 1, elapsed: 0, done: false }, { type: "item" }];
  if (s.group > 0) {
    const group = s.group - 1;
    return [{ ...s, group, item: sizeOf(shape, group) - 1, elapsed: 0, done: false }, { type: "group" }];
  }
  return [{ ...s, elapsed: 0, done: false }, null];
}

/** Salta de persona: al principio del grupo siguiente o anterior. */
export function jumpGroup(shape: StoriesShape, s: StoriesState, direction: 1 | -1): [StoriesState, StoriesEvent | null] {
  const group = s.group + direction;
  if (group < 0) return [{ ...s, item: 0, elapsed: 0, done: false }, null];
  if (group >= shape.sizes.length) return [{ ...s, elapsed: shape.duration(s.group, s.item), done: true }, { type: "complete" }];
  return [{ ...s, group, item: 0, elapsed: 0, done: false }, { type: "group" }];
}

/** Ve a un grupo concreto. */
export function goToGroup(shape: StoriesShape, s: StoriesState, group: number): StoriesState {
  const g = Math.max(0, Math.min(shape.sizes.length - 1, Math.floor(group)));
  return { ...s, group: g, item: 0, elapsed: 0, done: false };
}

/** Corre el reloj `dt` ms. Si la historia termina, pasa a la siguiente (como mucho una por llamada). */
export function tickStories(shape: StoriesShape, s: StoriesState, dt: number): [StoriesState, StoriesEvent | null] {
  if (s.paused || s.held || s.done || !(dt > 0)) return [s, null];
  const total = shape.duration(s.group, s.item);
  const elapsed = s.elapsed + dt;
  if (elapsed < total) return [{ ...s, elapsed }, null];
  return nextStory(shape, s);
}

/** Fracción llena de la barra `item` del grupo actual: 1 las pasadas, 0 las futuras, la actual según el reloj. */
export function barFill(shape: StoriesShape, s: StoriesState, item: number): number {
  if (item < s.item) return 1;
  if (item > s.item) return 0;
  const total = shape.duration(s.group, s.item);
  return total > 0 ? Math.max(0, Math.min(1, s.elapsed / total)) : 1;
}

/** «Story 2 of 5, Ana» con la posición desde 1. */
export const storyText = (template: string, item: number, count: number, author: string) =>
  template
    .replace("{index}", String(item + 1))
    .replace("{count}", String(count))
    .replace("{author}", author);
