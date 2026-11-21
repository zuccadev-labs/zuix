// Pausa fuera de pantalla para los efectos y cargadores animados: un único IntersectionObserver compartido marca
// cada elemento con `data-offscreen` mientras queda lejos del viewport, y el CSS detiene sus animaciones
// (`animation-play-state: paused`). Lo usan el binding de React y el modo sin framework. Sin efectos al importar:
// el observador se crea con el primer elemento observado.

type Observer = Pick<IntersectionObserver, "observe" | "unobserve">;
let shared: Observer | null = null;
const watched = new Set<Element>();

/** Margen alrededor del viewport: la animación se reanuda un poco antes de entrar a la vista. */
export const OFFSCREEN_MARGIN = "200px";

function observer(): Observer | null {
  if (shared) return shared;
  const IO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
  if (!IO) return null;
  shared = new IO(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        if (!el.isConnected) {
          stopWatching(el);
          continue;
        }
        el.toggleAttribute("data-offscreen", !entry.isIntersecting);
      }
    },
    { rootMargin: OFFSCREEN_MARGIN },
  );
  return shared;
}

function stopWatching(el: Element): void {
  if (!watched.delete(el)) return;
  shared?.unobserve(el);
  el.removeAttribute("data-offscreen");
}

/**
 * Pausa las animaciones de `el` mientras está fuera de pantalla. Devuelve la función que deja de observarlo.
 * Sin IntersectionObserver (entornos sin DOM) no hace nada: la animación sigue, que es lo seguro.
 */
export function pauseOffscreen(el: Element): () => void {
  const io = observer();
  if (!io || watched.has(el)) return () => stopWatching(el);
  watched.add(el);
  io.observe(el);
  return () => stopWatching(el);
}

/** Elementos observados ahora (para las pruebas). */
export const watchedCount = () => watched.size;

/** Olvida el observador compartido (para las pruebas). */
export function resetVisibility(): void {
  for (const el of [...watched]) stopWatching(el);
  shared = null;
}
