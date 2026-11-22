import { centerBounds, createLensShape, lensForward, lensSource, quadToMatrix3d, type LensShape } from "./lens";
import type { LensInstance, LensRenderer, Rgb } from "./lensRenderer";
import type { CarouselRasterSize } from "./slideTexture";

/**
 * Motor del carrusel, sin React ni dependencias: lo comparten el binding de React (useCarouselTrack)
 * y el comportamiento sin framework (zui/src/dom/carousel.ts). Espera el marcado del contrato ya montado:
 * slides con data-copy y data-index dentro de la tira.
 *
 * Qué hace: tira con bucle infinito, arrastre con inercia, ajuste al slide más cercano,
 * teclado y la lente opcional. Todo el movimiento corre sobre requestAnimationFrame con un muelle
 * amortiguado propio; no hay dependencias de animación.
 *
 * Dibujo (atributo data-mode en la raíz):
 * - "css": cada slide real se deforma con matrix3d. Funciona con cualquier contenido.
 * - "gl": la franja central es el slide HTML real; las zonas curvas las dibuja WebGL2 con la
 *   textura que entrega `rasterize`. Solo si hay `rasterize` y WebGL2; ante cualquier fallo vuelve a "css".
 * - "flat": sin lente (effect="none" o prefers-reduced-motion).
 */

export type CarouselMode = "css" | "gl" | "flat";

/** Réplicas a cada lado de la copia principal: mínimo y máximo. */
export const MIN_SIDE = 1;
const MAX_SIDE = 4;
/** Tope del margen vertical (fracción del alto del slide) que deja sitio al estiramiento de la lente. */
const BLEED = 0.45;
/** Muelle del desplazamiento: rigidez (1/s²) y amortiguación (1/s), casi crítico. */
const STIFFNESS = 90;
const DAMPING = 16.5;
/** Proyección de la velocidad de arrastre (ms) al elegir el slide objetivo. */
const THROW = 280;
/** Ventana (ms) sobre la que se mide la velocidad del arrastre al soltar. */
const VELOCITY_WINDOW = 100;
/** Duración mínima (ms) de esa medida: un salto del puntero en menos tiempo no es una velocidad fiable. */
const VELOCITY_MIN_SPAN = 16;
/**
 * Cola de asentamiento del muelle: a menos de esta distancia (px) y de esta velocidad (px/s) del objetivo, el
 * movimiento ya no se percibe aunque el muelle siga corrigiendo décimas de píxel.
 */
const SETTLE_DISTANCE = 2;
const SETTLE_SPEED = 40;
const NO_DRAG = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
const FOCUSABLE = "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])";

interface Slot {
  el: HTMLElement;
  copy: number;
  index: number;
  left: number;
  width: number;
  off: boolean;
}

export interface EngineElements {
  root: HTMLElement;
  viewport: HTMLElement;
  stage: HTMLElement;
  track: HTMLElement;
  canvas: HTMLCanvasElement | null;
}

export interface EngineOptions {
  count: number;
  loop: boolean;
  lens: boolean;
  reducedMotion: boolean;
  initialIndex: number;
  side: number;
  rasterize: ((index: number, size: CarouselRasterSize) => Promise<TexImageSource>) | null;
  /** Fábrica del dibujo WebGL2 (LensRenderer.create). Sin ella el motor no carga WebGL: lente por CSS. */
  createRenderer: ((canvas: HTMLCanvasElement, onLost: () => void) => LensRenderer | null) | null;
  maxTextureSize: (value: number) => void;
  onActive: (index: number) => void;
  onNavigate: (index: number) => void;
  onSide: (side: number) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const wrap = (value: number, min: number, max: number) => {
  const range = max - min;
  return range > 0 ? ((((value - min) % range) + range) % range) + min : value;
};
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

/** Color calculado por el navegador → [r, g, b, a] en 0..1; null si el formato no se reconoce. */
function parseComputedColor(value: string): [number, number, number, number] | null {
  const text = value.trim();
  const parts = text.match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number) ?? [];
  const [r, g, b, a = 1] = parts;
  if (r === undefined || g === undefined || b === undefined) return null;
  if (text.startsWith("rgb")) return [r / 255, g / 255, b / 255, a];
  if (text.startsWith("color(srgb")) return [r, g, b, a];
  return null;
}

/** Primer fondo opaco detrás del elemento; null si no lo hay (degradados, cristal). */
function backgroundBehind(element: HTMLElement): Rgb | null {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const color = parseComputedColor(getComputedStyle(node).backgroundColor);
    if (color && color[3] > 0.99) return [color[0], color[1], color[2]];
  }
  return null;
}

export function createEngine(elements: EngineElements, options: EngineOptions) {
  const { root, viewport, stage, track, canvas } = elements;
  const { count, loop } = options;
  const reduceMotion = options.reducedMotion;
  const lensOn = options.lens && !reduceMotion;
  const main = loop ? options.side : 0;
  // Fuente de texturas y fábrica del dibujo: llegan al crear el motor o después, con enableGl().
  const glSource = { rasterize: options.rasterize, createRenderer: options.createRenderer };

  let slots: Slot[] = [];
  const state = {
    renderer: "css" as "css" | "gl",
    gl: null as LensRenderer | null,
    rasterToken: 0,
    radius: 0,
    background: null as Rgb | null,
    x: 0,
    velocity: 0, // px/s
    target: null as number | null,
    raf: 0,
    lastTick: 0,
    width: 0,
    height: 0,
    slideH: 0,
    trackW: 0,
    period: 0,
    centers: [] as number[],
    shape: null as LensShape | null,
    boost: 0,
    boostTarget: 0,
    speedX: 0,
    speedT: 0,
    wheelTimer: 0,
    resizeTimer: 0,
    active: -1,
    suppressClick: false,
    drag: { id: -1, startX: 0, startTrack: 0, lastT: 0, samples: [] as { x: number; t: number }[], moved: false, wasMoving: false },
    disposed: false,
  };

  // ---------- Geometría ----------
  const measure = () => {
    slots = [];
    for (const child of Array.from(track.children)) {
      if (!(child instanceof HTMLElement) || child.dataset.index === undefined) continue;
      slots.push({
        el: child,
        copy: Number(child.dataset.copy ?? 0),
        index: Number(child.dataset.index),
        left: child.offsetLeft,
        width: child.offsetWidth,
        off: child.hasAttribute("data-lens-off"),
      });
    }
    state.width = viewport.clientWidth;
    state.slideH = track.offsetHeight;
    state.trackW = track.offsetWidth;

    const mains = slots.filter((slot) => slot.copy === main).sort((a, b) => a.index - b.index);
    state.centers = mains.map((slot) => slot.left + slot.width / 2);
    const first = mains[0];
    const next = slots.find((slot) => slot.copy === main + 1 && slot.index === 0);
    state.period = loop && first && next ? next.left - first.left : 0;
    state.radius = first ? parseFloat(getComputedStyle(first.el).borderTopLeftRadius) || 0 : 0;
    state.background = backgroundBehind(viewport);
    const widest = mains.reduce((max, slot) => Math.max(max, slot.width), 0);
    // El margen vertical cubre el estiramiento en reposo (el de la forma, que depende del ancho), con BLEED de tope.
    const stretch = createLensShape(state.width, state.slideH, state.slideH, widest).stretch;
    const bleed = lensOn ? Math.round(state.slideH * Math.min(BLEED, stretch)) : 0;
    root.style.setProperty("--z-carousel-bleed", `${bleed}px`);
    state.height = state.slideH + bleed * 2;
    state.shape = createLensShape(state.width, state.height, state.slideH, widest);
  };

  const ready = () => state.width > 0 && state.centers.length > 0 && (!loop || state.period > 0);
  const top = () => (state.height - state.slideH) / 2;
  const strength = () => (lensOn ? 1 + state.boost : 0);
  const base = (index: number) => state.width / 2 - (state.centers[index] ?? 0);
  const clampX = (x: number) => (loop ? x : clamp(x, base(state.centers.length - 1), base(0)));

  const wrappedX = () => {
    const x = loop ? wrap(state.x, state.width / 2 - (main + 1) * state.period, state.width / 2 - main * state.period) : state.x;
    // En reposo se ajusta al píxel para que el texto quede nítido.
    return state.target === null && state.drag.id === -1 ? Math.round(x) : x;
  };

  /** x que centra el slide `index`, en la réplica más cercana a `from` y en la dirección pedida. */
  const targetFor = (index: number, from: number, direction: -1 | 0 | 1 = 0) => {
    if (!loop) return base(index);
    let target = base(index) + Math.round((from - base(index)) / state.period) * state.period;
    if (direction === 1 && target >= from - 1) target -= state.period;
    if (direction === -1 && target <= from + 1) target += state.period;
    return target;
  };

  const nearest = (from: number) => {
    let index = 0;
    let target = from;
    let best = Infinity;
    for (let i = 0; i < state.centers.length; i++) {
      const candidate = targetFor(i, from);
      if (Math.abs(candidate - from) < best) {
        best = Math.abs(candidate - from);
        index = i;
        target = candidate;
      }
    }
    return { index, target };
  };

  /** Slide que se ve bajo el puntero, deshaciendo la deformación. */
  const slotAt = (clientX: number, clientY: number): Slot | null => {
    const rect = viewport.getBoundingClientRect();
    let px = clientX - rect.left;
    let py = clientY - rect.top;
    const k = strength();
    if (state.shape && k > 0.002) {
      const source = lensSource(px, py, state.shape, k);
      px = source.x;
      py = source.y;
    }
    if (py < top() || py > top() + state.slideH) return null;
    const x = wrappedX();
    return slots.find((slot) => px >= x + slot.left && px <= x + slot.left + slot.width) ?? null;
  };

  // ---------- Pintado ----------
  const applySlideTransforms = () => {
    const shape = state.shape;
    if (!shape) return;
    const k = strength();
    const x = wrappedX();
    const y = top();
    const h = state.slideH;
    for (const slot of slots) {
      const left = x + slot.left;
      const w = slot.width;
      if (k < 0.002 || left > state.width || left + w < 0) {
        if (slot.el.style.transform) slot.el.style.transform = "";
        continue;
      }
      const corner = (cx: number, cy: number) => {
        const p = lensForward(cx, cy, shape, k);
        return { x: p.x - left, y: p.y - y };
      };
      slot.el.style.transform = quadToMatrix3d(w, h, [corner(left, y), corner(left + w, y), corner(left + w, y + h), corner(left, y + h)]);
    }
  };

  const clearSlideTransforms = () => {
    for (const slot of slots) slot.el.style.transform = "";
  };

  const setOff = (slot: Slot, off: boolean) => {
    if (slot.off === off) return;
    slot.off = off;
    if (off) slot.el.setAttribute("data-lens-off", "");
    else slot.el.removeAttribute("data-lens-off");
  };

  const applyMode = () => {
    root.dataset.mode = state.renderer === "gl" ? "gl" : lensOn ? "css" : "flat";
  };

  /** En WebGL el slide HTML solo se ve en la franja central; la máscara vive en la hoja de estilos. */
  const applyStageMask = () => {
    if (state.renderer !== "gl" || !state.shape) {
      stage.style.removeProperty("--z-carousel-lens-left");
      stage.style.removeProperty("--z-carousel-lens-right");
      return;
    }
    const { left, right } = centerBounds(state.shape);
    stage.style.setProperty("--z-carousel-lens-left", `${left}px`);
    stage.style.setProperty("--z-carousel-lens-right", `${right}px`);
  };

  const drawGl = () => {
    const gl = state.gl;
    const shape = state.shape;
    if (!gl || !shape) return;
    const x = wrappedX();
    const bounds = centerBounds(shape);
    const instances: LensInstance[] = [];
    for (const slot of slots) {
      const left = x + slot.left;
      // Fuera de la franja central el slide real no recibe el puntero: lo que se ve es el lienzo.
      setOff(slot, left < bounds.left || left + slot.width > bounds.right);
      if (left > state.width || left + slot.width < 0) continue;
      instances.push({ texture: slot.index, left, top: top(), width: slot.width, height: state.slideH, alpha: 1 });
    }
    const k = strength();
    gl.draw({
      shape,
      strength: k,
      // Sin fondo opaco detrás no hay con qué completar los canales: se omite la separación de color.
      spread: state.background ? 0.022 + state.boost * 0.035 : 0,
      bloom: Math.min(k, 1),
      radius: state.radius,
      glow: state.width < 640 ? 14 : 22,
      background: state.background ?? [0, 0, 0],
      instances,
    });
  };

  const paint = () => {
    if (state.disposed || !ready()) return;
    track.style.transform = `translate3d(${wrappedX()}px, 0, 0)`;
    const { index } = nearest(state.x);
    if (index !== state.active) {
      state.active = index;
      options.onActive(index);
    }
    if (state.renderer === "gl") drawGl();
    else if (lensOn) applySlideTransforms();
  };

  /** La lente se acentúa con la velocidad de la tira. */
  const trackSpeed = (now: number) => {
    if (!lensOn) return;
    const dt = Math.max(now - state.speedT, 1);
    const speed = dt > 120 ? 0 : Math.abs(state.x - state.speedX) / dt;
    state.speedX = state.x;
    state.speedT = now;
    const boost = Math.min(speed / 3.2, 0.85);
    if (Math.abs(boost - state.boostTarget) > 0.02) state.boostTarget = boost;
  };

  // ---------- Movimiento ----------
  const tick = (now: number) => {
    state.raf = 0;
    if (state.disposed) return;
    const dt = clamp(now - state.lastTick, 0, 34);
    state.lastTick = now;

    if (state.target !== null) {
      let rest = dt / 1000;
      while (rest > 0) {
        const h = Math.min(rest, 0.004);
        const acceleration = -STIFFNESS * (state.x - state.target) - DAMPING * state.velocity;
        state.velocity += acceleration * h;
        state.x += state.velocity * h;
        rest -= h;
      }
      if (Math.abs(state.x - state.target) < 0.2 && Math.abs(state.velocity) < 4) {
        state.x = state.target;
        state.velocity = 0;
        state.target = null;
      }
      trackSpeed(now);
    } else if (now - state.speedT > 90) {
      state.boostTarget = 0;
    }

    state.boost += (state.boostTarget - state.boost) * (1 - Math.exp(-dt / 110));
    if (state.boostTarget === 0 && state.boost < 0.002) state.boost = 0;
    paint();
    if (state.target !== null || state.boost !== 0 || state.boostTarget !== 0) state.raf = requestAnimationFrame(tick);
  };

  const ensureTick = () => {
    if (state.raf || state.disposed || reduceMotion) return;
    state.lastTick = performance.now();
    state.raf = requestAnimationFrame(tick);
  };

  const stopMotion = () => {
    state.target = null;
    state.velocity = 0;
  };

  const glide = (target: number, velocity = 0) => {
    const x = clampX(target);
    if (reduceMotion) {
      stopMotion();
      state.x = x;
      paint();
      return;
    }
    state.target = x;
    state.velocity = velocity;
    ensureTick();
  };

  /** Posición de referencia para navegar: el objetivo en curso o la posición actual. */
  const heading = () => state.target ?? state.x;

  const goTo = (index: number, announce = false) => {
    if (!ready()) return;
    const next = clamp(Math.round(index), 0, count - 1);
    glide(targetFor(next, heading()));
    if (announce) options.onNavigate(next);
  };

  const step = (direction: 1 | -1): number | null => {
    if (!ready()) return null;
    const current = nearest(heading()).index;
    const next = loop ? (current + direction + count) % count : clamp(current + direction, 0, count - 1);
    if (!loop && next === current) return null;
    glide(targetFor(next, heading(), direction));
    options.onNavigate(next);
    return next;
  };

  // ---------- WebGL ----------
  const resizeGl = () => state.gl?.resize(state.width, state.height, pixelRatio());

  const fallbackToCss = () => {
    state.rasterToken++;
    state.gl?.dispose();
    state.gl = null;
    state.renderer = "css";
    for (const slot of slots) setOff(slot, false);
    applyMode();
    applyStageMask();
    paint();
  };

  /** Pide una textura por slide al consumidor y, cuando todas están listas, activa el modo WebGL. */
  const refreshTextures = async () => {
    const gl = state.gl;
    const rasterize = glSource.rasterize;
    if (!gl || !rasterize || state.disposed || !ready()) return;
    const token = ++state.rasterToken;
    try {
      // Textura al doble de la pantalla (hasta 3x): las zonas curvas se amplían sin perder nitidez.
      const scale = Math.min(pixelRatio() * 2, 3);
      const mains = slots.filter((slot) => slot.copy === main);
      const sources = await Promise.all(mains.map((slot) => rasterize(slot.index, { width: slot.width, height: state.slideH, scale })));
      if (state.disposed || token !== state.rasterToken || state.gl !== gl || gl.lost) return;
      mains.forEach((slot, i) => {
        const source = sources[i];
        if (source) gl.setTexture(slot.index, source);
      });
    } catch {
      if (!state.disposed && token === state.rasterToken) fallbackToCss();
      return;
    }
    if (state.renderer !== "gl") {
      state.renderer = "gl";
      clearSlideTransforms();
      applyMode();
      applyStageMask();
    }
    paint();
  };

  const startGl = () => {
    if (!lensOn || !glSource.rasterize || !glSource.createRenderer || !canvas || state.gl || state.disposed) return;
    const renderer = glSource.createRenderer(canvas, () => {
      if (!state.disposed) fallbackToCss();
    });
    if (!renderer) return;
    // El halo toma el color del lienzo, que la hoja de estilos fija con un token.
    const glow = parseComputedColor(getComputedStyle(canvas).color);
    if (glow) renderer.setGlowColor([glow[0], glow[1], glow[2]]);
    options.maxTextureSize(renderer.maxTextureSize);
    state.gl = renderer;
    resizeGl();
    void refreshTextures();
  };

  const layout = (initial = false) => {
    const activeBefore = initial ? options.initialIndex : Math.max(state.active, 0);
    measure();
    if (loop && state.period > 0 && state.width > 0) {
      const needed = clamp(Math.ceil(state.width / (2 * state.period)), MIN_SIDE, MAX_SIDE);
      if (needed !== options.side) options.onSide(needed);
    }
    resizeGl();
    applyStageMask();
    if (!ready()) return;
    stopMotion();
    state.x = targetFor(clamp(activeBefore, 0, state.centers.length - 1), initial ? 0 : state.x);
    paint();
  };

  // ---------- Eventos ----------
  const onPointerDown = (e: PointerEvent) => {
    state.suppressClick = false;
    // Un arrastre en curso (con captura) manda; uno que nunca llegó a moverse se descarta.
    if ((state.drag.id !== -1 && state.drag.moved) || !ready()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest(NO_DRAG)) return;
    // «En movimiento» es lo que se ve moverse. En la cola de asentamiento la tira ya parece quieta (y con pocos
    // fotogramas por segundo esa cola dura más de un segundo): ahí una pulsación es un clic, no «parar la tira».
    const wasMoving =
      state.target !== null && (Math.abs(state.target - state.x) > SETTLE_DISTANCE || Math.abs(state.velocity) > SETTLE_SPEED);
    stopMotion();
    Object.assign(state.drag, {
      id: e.pointerId,
      startX: e.clientX,
      startTrack: state.x,
      lastT: e.timeStamp,
      samples: [{ x: e.clientX, t: e.timeStamp }],
      moved: false,
      wasMoving,
    });
  };

  const onPointerMove = (e: PointerEvent) => {
    const drag = state.drag;
    if (drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      viewport.dataset.dragging = "";
      // La captura empieza con el arrastre: un clic simple llega intacto al contenido del slide.
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch {
        // Puntero ya liberado.
      }
    }
    if (!drag.moved) return;
    drag.lastT = e.timeStamp;
    drag.samples.push({ x: e.clientX, t: e.timeStamp });
    while (drag.samples.length > 1 && e.timeStamp - drag.samples[0]!.t > VELOCITY_WINDOW) drag.samples.shift();
    let x = drag.startTrack + dx;
    if (!loop) {
      // Resistencia elástica más allá de los extremos.
      const min = base(state.centers.length - 1);
      const max = base(0);
      if (x > max) x = max + (x - max) * 0.35;
      else if (x < min) x = min + (x - min) * 0.35;
    }
    state.x = x;
    trackSpeed(performance.now());
    paint();
    if (lensOn) ensureTick();
  };

  /**
   * Velocidad del arrastre al soltar (px/ms): desplazamiento total entre las muestras recientes dividido
   * por el tiempo que abarcan. No depende del intervalo entre dos eventos sueltos, que con marcas de tiempo
   * redondeadas al milisegundo (Firefox) o eventos agrupados puede ser de 0-2 ms y disparar la estimación.
   */
  const releaseVelocity = (now: number) => {
    const { samples, lastT } = state.drag;
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (!first || !last || first === last || now - lastT > 80) return 0;
    const velocity = (last.x - first.x) / Math.max(last.t - first.t, VELOCITY_MIN_SPAN);
    if (!loop) return velocity;
    // En bucle, un lanzamiento de una vuelta entera acabaría en el slide de partida: como mucho, media vuelta.
    const reach = state.period / 2 / THROW;
    return clamp(velocity, -reach, reach);
  };

  const endDrag = (e: PointerEvent, cancelled: boolean) => {
    const drag = state.drag;
    if (drag.id !== e.pointerId) return;
    drag.id = -1;
    delete viewport.dataset.dragging;
    if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
    if (!drag.moved) {
      // Clic simple: se centra el slide pulsado (las réplicas son inertes, así que se localiza por geometría).
      const hit = cancelled || drag.wasMoving ? null : slotAt(e.clientX, e.clientY);
      const snap = nearest(state.x);
      if (hit && hit.index !== snap.index) glide(targetFor(hit.index, state.x));
      else if (Math.abs(snap.target - state.x) > 0.5) glide(snap.target);
      else paint();
      return;
    }
    // El clic llega en la misma tarea que pointerup; después la marca ya no hace falta.
    state.suppressClick = !cancelled;
    window.setTimeout(() => {
      state.suppressClick = false;
    }, 0);
    const velocity = releaseVelocity(e.timeStamp);
    glide(nearest(state.x + velocity * THROW).target, reduceMotion ? 0 : velocity * 1000);
  };
  const onPointerUp = (e: PointerEvent) => endDrag(e, false);
  const onPointerCancel = (e: PointerEvent) => endDrag(e, true);
  /** Sin captura todavía, soltar fuera del viewport no avisa: se abandona el gesto al salir. */
  const onPointerLeave = (e: PointerEvent) => {
    if (state.drag.id === e.pointerId && !state.drag.moved) endDrag(e, true);
  };

  /** Tras un arrastre, el clic que genera el navegador no debe activar enlaces ni botones del slide. */
  const onClickCapture = (e: MouseEvent) => {
    if (!state.suppressClick) return;
    state.suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragStart = (e: Event) => e.preventDefault();

  const onWheel = (e: WheelEvent) => {
    if (!ready() || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // el scroll vertical sigue siendo de la página
    e.preventDefault();
    stopMotion();
    state.x = clampX(state.x - e.deltaX * (e.deltaMode === 1 ? 16 : 1));
    trackSpeed(performance.now());
    paint();
    if (lensOn) ensureTick();
    window.clearTimeout(state.wheelTimer);
    state.wheelTimer = window.setTimeout(() => glide(nearest(state.x).target), 140);
  };

  /** El foco que entra en un slide (Tab) lo centra. */
  const onFocusIn = (e: FocusEvent) => {
    if (state.drag.id !== -1 || !ready() || !(e.target instanceof Element)) return;
    const slide = e.target.closest<HTMLElement>("[data-index]");
    if (!slide || !track.contains(slide)) return;
    const index = Number(slide.dataset.index);
    if (index !== nearest(heading()).index) glide(targetFor(index, heading()));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const from = e.target instanceof Element ? e.target : null;
    if (from?.closest(NO_DRAG)) return;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = step(1);
    else if (e.key === "ArrowLeft") next = step(-1);
    else if (e.key === "Home") {
      next = 0;
      goTo(0, true);
    } else if (e.key === "End") {
      next = count - 1;
      goTo(count - 1, true);
    } else return;
    e.preventDefault();
    // Con el foco dentro de un slide, el foco acompaña al slide objetivo.
    if (next === null || !from?.closest("[data-index]") || !track.contains(from)) return;
    const slot = slots.find((item) => item.copy === main && item.index === next);
    slot?.el.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
  };

  // El foco con Tab puede desplazar un contenedor overflow:hidden; la posición la controla la tira.
  const onViewportScroll = () => {
    if (viewport.scrollLeft !== 0) viewport.scrollLeft = 0;
    if (viewport.scrollTop !== 0) viewport.scrollTop = 0;
  };

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerCancel);
  viewport.addEventListener("pointerleave", onPointerLeave);
  viewport.addEventListener("click", onClickCapture, true);
  viewport.addEventListener("dragstart", onDragStart);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  viewport.addEventListener("scroll", onViewportScroll);
  track.addEventListener("focusin", onFocusIn);
  root.addEventListener("keydown", onKeyDown);

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => {
          // La primera notificación llega al observar, sin cambio de tamaño: no debe recolocar la tira.
          if (viewport.clientWidth === state.width && track.offsetHeight === state.slideH && track.offsetWidth === state.trackW) {
            return;
          }
          layout();
          window.clearTimeout(state.resizeTimer);
          state.resizeTimer = window.setTimeout(() => void refreshTextures(), 150);
        });
  resizeObserver?.observe(viewport);
  resizeObserver?.observe(track);

  applyMode();
  layout(true);
  startGl();

  return {
    step: (direction: 1 | -1) => {
      step(direction);
    },
    goTo: (index: number) => goTo(index),
    /**
     * Activa el dibujo WebGL con el motor ya en marcha (zui/dom carga los shaders bajo demanda).
     * Necesita el lienzo en `elements.canvas`; sin WebGL2 o sin lente no hace nada y sigue en "css".
     */
    enableGl: (rasterize: NonNullable<EngineOptions["rasterize"]>, createRenderer: NonNullable<EngineOptions["createRenderer"]>) => {
      glSource.rasterize = rasterize;
      glSource.createRenderer = createRenderer;
      startGl();
    },
    dispose: () => {
      state.disposed = true;
      state.rasterToken++;
      if (state.raf) cancelAnimationFrame(state.raf);
      window.clearTimeout(state.wheelTimer);
      window.clearTimeout(state.resizeTimer);
      resizeObserver?.disconnect();
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerCancel);
      viewport.removeEventListener("pointerleave", onPointerLeave);
      viewport.removeEventListener("click", onClickCapture, true);
      viewport.removeEventListener("dragstart", onDragStart);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("scroll", onViewportScroll);
      track.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("keydown", onKeyDown);
      if (state.drag.id !== -1 && viewport.hasPointerCapture(state.drag.id)) viewport.releasePointerCapture(state.drag.id);
      state.gl?.dispose();
      state.gl = null;
      delete root.dataset.mode;
      delete viewport.dataset.dragging;
      root.style.removeProperty("--z-carousel-bleed");
      stage.style.removeProperty("--z-carousel-lens-left");
      stage.style.removeProperty("--z-carousel-lens-right");
      track.style.transform = "";
      for (const slot of slots) {
        slot.el.style.transform = "";
        slot.el.removeAttribute("data-lens-off");
      }
    },
  };
}
