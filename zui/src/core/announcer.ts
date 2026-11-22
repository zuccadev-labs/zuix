// Anunciador central: una región viva educada y una asertiva por documento (o por diálogo modal abierto, porque
// fuera de él todo es inerte), con retraso corto y vaciado previo. Lo usan las piezas que anuncian sin tener el foco
// (carruseles, historias, visor de imágenes y las familias que vienen detrás). La cola es lógica pura con reloj
// inyectable; `announce()` toca el documento solo cuando se llama, nunca al importar.

export type Politeness = "polite" | "assertive";

export interface LiveQueueOptions {
  /** Escribe en la región (texto vacío = vaciado previo). */
  write: (text: string, politeness: Politeness) => void;
  /** Retraso entre el vaciado y el texto (ms). Por defecto 150. */
  delay?: number;
  /** Silencio que se espera tras la última pulsación de la persona antes de hablar (ms). Por defecto 1000. */
  quiet?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export interface LiveQueue {
  /** Pide un anuncio. Dentro del mismo retraso, el último manda: no se leen estados intermedios. */
  push(text: string, politeness?: Politeness, delay?: number): void;
  /** La persona escribe: los anuncios esperan a que pare (`quiet`). */
  typing(): void;
  /** Vacía y cancela lo pendiente. */
  clear(): void;
  dispose(): void;
}

export const DEFAULT_DELAY = 150;
export const DEFAULT_QUIET = 1000;

/**
 * Cola de anuncios por urgencia. Cada `push` vacía la región en el acto y escribe el texto tras el retraso: así un
 * texto igual al anterior se vuelve a leer, y una ráfaga (pasar tres slides seguidos) solo lee el último.
 */
export function createLiveQueue(o: LiveQueueOptions): LiveQueue {
  const now = o.now ?? (() => Date.now());
  const setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const quiet = Math.max(0, o.quiet ?? DEFAULT_QUIET);
  let lastInput = Number.NEGATIVE_INFINITY;
  let disposed = false;
  const pending = new Map<Politeness, { text: string; timer: unknown }>();

  const fire = (politeness: Politeness) => {
    const entry = pending.get(politeness);
    if (!entry || disposed) return;
    const wait = lastInput + quiet - now();
    if (wait > 0) {
      entry.timer = setTimer(() => fire(politeness), wait);
      return;
    }
    pending.delete(politeness);
    o.write(entry.text, politeness);
  };
  const cancel = (politeness: Politeness) => {
    const entry = pending.get(politeness);
    if (entry) clearTimer(entry.timer);
    pending.delete(politeness);
  };
  return {
    push(text, politeness = "polite", delay = o.delay ?? DEFAULT_DELAY) {
      if (disposed) return;
      const message = text.trim();
      cancel(politeness);
      o.write("", politeness);
      if (!message) return;
      pending.set(politeness, { text: message, timer: setTimer(() => fire(politeness), Math.max(0, delay)) });
    },
    typing() {
      lastInput = now();
    },
    clear() {
      for (const p of [...pending.keys()]) cancel(p);
      o.write("", "polite");
      o.write("", "assertive");
    },
    dispose() {
      for (const p of [...pending.keys()]) cancel(p);
      disposed = true;
    },
  };
}

/** Escritura diferida en una región concreta (la `[data-live]` de una pieza): vaciado previo y el último manda. */
const local = new WeakMap<HTMLElement, LiveQueue>();
export function announceTo(region: HTMLElement, text: string, delay = 500): void {
  let queue = local.get(region);
  if (!queue) {
    queue = createLiveQueue({
      quiet: 0,
      write: (value) => {
        region.textContent = value;
      },
    });
    local.set(region, queue);
  }
  queue.push(text, "polite", delay);
}

export interface AnnounceOptions {
  politeness?: Politeness;
  /** Retraso propio (ms). */
  delay?: number;
  /** Quien anuncia: si está dentro de un árbol inerte no se dice nada; dentro de un diálogo modal se habla desde él. */
  source?: Element | null;
}

interface Hub {
  queue: LiveQueue;
  box: HTMLElement;
}
const hubs = new WeakMap<Node, Hub>();
const typingDocs = new WeakSet<Document>();

/** Host de las regiones: el diálogo modal abierto que contiene a quien habla (fuera de él todo es inerte) o el body. */
function hostFor(doc: Document, source: Element | null | undefined): HTMLElement | null {
  const dialog = source?.closest("dialog[open]");
  if (dialog instanceof HTMLElement && dialog.matches(":modal")) return dialog;
  return doc.body;
}

function hubFor(host: HTMLElement): Hub {
  const known = hubs.get(host);
  if (known?.box.isConnected) return known;
  const doc = host.ownerDocument;
  const box = doc.createElement("div");
  box.className = "z-sr-only z-announcer";
  box.dataset.zAnnouncer = "";
  const regions: Record<Politeness, HTMLElement> = { polite: doc.createElement("div"), assertive: doc.createElement("div") };
  regions.polite.setAttribute("role", "status");
  regions.polite.setAttribute("aria-live", "polite");
  regions.assertive.setAttribute("role", "alert");
  regions.assertive.setAttribute("aria-live", "assertive");
  for (const region of Object.values(regions)) {
    region.setAttribute("aria-atomic", "true");
    box.append(region);
  }
  host.append(box);
  const queue = createLiveQueue({
    write: (text, politeness) => {
      regions[politeness].textContent = text;
    },
  });
  if (!typingDocs.has(doc)) {
    typingDocs.add(doc);
    // Mientras la persona escribe, el lector no la interrumpe: el anuncio espera a que pare.
    doc.addEventListener("input", (event) => hubs.get(hostFor(doc, event.target as Element) ?? doc.body)?.queue.typing(), true);
  }
  const hub = { queue, box };
  hubs.set(host, hub);
  return hub;
}

/**
 * Anuncia `text` en la región viva compartida del documento. Educado por defecto; `assertive` solo para lo que no
 * puede esperar. No dice nada si quien habla está en un árbol `inert` o fuera del documento.
 */
export function announce(text: string, options: AnnounceOptions = {}): void {
  const source = options.source ?? null;
  const doc = source?.ownerDocument ?? (typeof document === "undefined" ? null : document);
  if (!doc?.body) return;
  if (source && (!source.isConnected || source.closest("[inert]"))) return;
  const host = hostFor(doc, source);
  if (!host) return;
  hubFor(host).queue.push(text, options.politeness ?? "polite", options.delay);
}
