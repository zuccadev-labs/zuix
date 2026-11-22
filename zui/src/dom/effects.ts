// Efectos y cargadores sin framework. Todo dentro de `[data-z-dom]`; el texto entra siempre como texto.
//
// DotMatrix   .z-dotmatrix[data-pattern]: si llega sin puntos, los dibuja (data-cols, data-rows); en pausa fuera de
//             pantalla. setDotMatrixPattern(el, patrón, { cols, rows }) lo redibuja.
// Backdrop    .z-backdrop[data-animated]: en pausa fuera de pantalla.
// BorderBeam  .z-beam: en pausa fuera de pantalla. Si llega sin anillo, lo añade.
// Glow        .z-glow: escribe --z-glow-x/--z-glow-y al mover un puntero que no es táctil (un fotograma por vez).
// Attention   .z-attention[data-active]: en pausa fuera de pantalla.
// TextEffect  .z-texteffect[data-effect=reveal|blur]: si llega con el texto sin partir, lo parte (piezas aria-hidden y
//             el texto entero para los lectores); con data-trigger="visible" espera a entrar en pantalla.
import { dotDuration, dotGrid, dotMatrixCells, dotMotion, dotValue, isDotPattern, type DotPattern } from "../core/dotmatrix";
import { glowPoint, splitText, type TextSplit } from "../core/effects";
import { pauseOffscreen } from "../core/visibility";
import { inDom } from "./forms-popup";
import type { Listen } from "./shared";

function pick(root: ParentNode, selector: string): HTMLElement[] {
  const list = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root);
  return list.filter(inDom);
}

/** Redibuja los puntos de un DotMatrix con otro patrón o tamaño de rejilla. */
export function setDotMatrixPattern(el: HTMLElement, pattern: DotPattern, size: { cols?: number; rows?: number } = {}): void {
  if (!isDotPattern(pattern)) return;
  const grid = dotGrid(size.cols ?? (Number(el.style.getPropertyValue("--z-dotmatrix-cols")) || undefined), size.rows);
  const doc = el.ownerDocument;
  el.dataset.pattern = pattern;
  el.dataset.motion = dotMotion(pattern);
  el.style.setProperty("--z-dotmatrix-cols", String(grid.cols));
  el.style.setProperty("--z-dotmatrix-rows", String(grid.rows));
  if (!el.dataset.duration) el.style.setProperty("--z-dotmatrix-duration", `${dotDuration(pattern)}s`);
  el.replaceChildren(
    ...dotMatrixCells(pattern, grid.cols, grid.rows).map((c) => {
      const dot = doc.createElement("span");
      dot.className = "z-dotmatrix__dot";
      if (c.off) dot.setAttribute("data-off", "");
      dot.style.setProperty("--z-dot-phase", dotValue(c.phase));
      dot.style.setProperty("--z-dot-rest", dotValue(c.rest));
      return dot;
    }),
  );
}

/** Parte el texto de un TextEffect de aparición en piezas (si llega sin partir). */
function splitTextEffect(el: HTMLElement): void {
  if (el.querySelector(".z-texteffect__text")) return;
  const text = el.textContent ?? "";
  const doc = el.ownerDocument;
  const by: TextSplit = el.dataset.by === "letter" ? "letter" : "word";
  const sr = doc.createElement("span");
  sr.className = "z-sr-only";
  sr.textContent = text;
  const visual = doc.createElement("span");
  visual.className = "z-texteffect__text";
  visual.setAttribute("aria-hidden", "true");
  const piece = (content: string, index: number) => {
    const span = doc.createElement("span");
    span.className = "z-texteffect__piece";
    span.style.setProperty("--z-i", String(index));
    span.textContent = content;
    return span;
  };
  for (const t of splitText(text, by)) {
    if ("space" in t) visual.append(doc.createTextNode(t.space));
    else if (t.letters) {
      const word = doc.createElement("span");
      word.className = "z-texteffect__word";
      word.append(...t.letters.map((l) => piece(l.text, l.index)));
      visual.append(word);
    } else visual.append(piece(t.word, t.index ?? 0));
  }
  if (by === "letter" && !el.style.getPropertyValue("--z-texteffect-stagger")) el.style.setProperty("--z-texteffect-stagger", "18ms");
  el.replaceChildren(sr, visual);
}

function revealWhenVisible(el: HTMLElement): void {
  if (typeof IntersectionObserver === "undefined" || el.dataset.state === "pending" || el.hasAttribute("data-z-revealed")) return;
  el.dataset.state = "pending";
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      el.removeAttribute("data-state");
      el.setAttribute("data-z-revealed", "");
      io.disconnect();
    },
    { threshold: 0.2 },
  );
  io.observe(el);
}

const frames = new WeakMap<HTMLElement, number>();

export function setup(on: Listen): void {
  on(
    document,
    "pointermove",
    (event) => {
      if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
      const glow = event.target.closest<HTMLElement>(".z-glow");
      if (!glow || !inDom(glow)) return;
      const { clientX, clientY } = event;
      cancelAnimationFrame(frames.get(glow) ?? 0);
      frames.set(
        glow,
        requestAnimationFrame(() => {
          const p = glowPoint(glow.getBoundingClientRect(), clientX, clientY);
          glow.style.setProperty("--z-glow-x", `${p.x}px`);
          glow.style.setProperty("--z-glow-y", `${p.y}px`);
        }),
      );
    },
    { passive: true },
  );
}

export function hydrate(root: ParentNode): void {
  for (const el of pick(root, ".z-dotmatrix[data-pattern]")) {
    if (!el.querySelector(".z-dotmatrix__dot")) {
      const pattern = el.dataset.pattern as DotPattern;
      const cols = Number(el.dataset.cols) || undefined;
      const rows = Number(el.dataset.rows) || undefined;
      if (el.dataset.duration) el.style.setProperty("--z-dotmatrix-duration", `${Number(el.dataset.duration)}s`);
      setDotMatrixPattern(el, isDotPattern(pattern) ? pattern : "wave", { cols, rows });
    }
    pauseOffscreen(el);
  }
  for (const el of pick(root, ".z-beam")) {
    if (!el.querySelector(":scope > .z-beam__ring")) {
      const ring = el.ownerDocument.createElement("span");
      ring.className = "z-beam__ring";
      ring.setAttribute("aria-hidden", "true");
      el.append(ring);
    }
    pauseOffscreen(el);
  }
  for (const el of pick(root, ".z-backdrop[data-animated], .z-attention[data-active], .z-texteffect[data-animated]")) pauseOffscreen(el);
  for (const el of pick(root, '.z-texteffect:is([data-effect="reveal"], [data-effect="blur"])')) {
    splitTextEffect(el);
    if (el.dataset.trigger === "visible") revealWhenVisible(el);
  }
}
