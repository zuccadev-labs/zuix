// Motor del Carousel (zui/src/components/carousel/engine.ts): posición, límites, bucle, muelle y velocidad de
// lanzamiento. happy-dom no calcula layout, así que las medidas se fijan a mano y el reloj (requestAnimationFrame,
// performance.now) lo controla la prueba. El dibujo WebGL y la captura real de puntero se prueban en navegador.
import { press, setBox, setRect, window } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { createEngine, MIN_SIDE } from "../../zui/src/components/carousel/engine.ts";

const SLIDE = 200;
const GAP = 20;
const STEP = SLIDE + GAP;
const WIDTH = 600;

// Reloj manual.
let now = 0;
let frames = [];
const realNow = performance.now;
beforeEach(() => {
  now = 1000;
  frames = [];
  performance.now = () => now;
  globalThis.requestAnimationFrame = (cb) => frames.push(cb);
  globalThis.cancelAnimationFrame = (id) => {
    frames[id - 1] = null;
  };
  // Sin observador: el layout de la prueba no cambia.
  globalThis.ResizeObserver = undefined;
});
afterEach(() => {
  performance.now = realNow;
});
/** Avanza el reloj `ms` en fotogramas de 16 ms; devuelve cuántos se ejecutaron. */
function advance(ms) {
  let ran = 0;
  for (let t = 0; t < ms; t += 16) {
    now += 16;
    const pending = frames;
    frames = [];
    for (const cb of pending)
      if (cb) {
        cb(now);
        ran++;
      }
    if (!frames.some(Boolean)) break;
  }
  return ran;
}

/** Monta el marcado del contrato con medidas fijas y crea el motor. */
function carousel({ count = 5, loop = false, reducedMotion = true, lens = false, initialIndex = 0, side = MIN_SIDE, width = WIDTH } = {}) {
  const root = document.createElement("div");
  root.innerHTML = '<div class="viewport"><div class="stage"><div class="track"></div></div></div>';
  document.body.replaceChildren(root);
  const viewport = root.querySelector(".viewport");
  const stage = root.querySelector(".stage");
  const track = root.querySelector(".track");
  const copies = loop ? side * 2 + 1 : 1;
  for (let copy = 0; copy < copies; copy++) {
    for (let index = 0; index < count; index++) {
      const slide = document.createElement("div");
      slide.dataset.copy = String(copy);
      slide.dataset.index = String(index);
      slide.innerHTML = '<a href="#x">x</a>';
      setBox(slide, { offsetLeft: (copy * count + index) * STEP, offsetWidth: SLIDE });
      track.append(slide);
    }
  }
  setBox(viewport, { clientWidth: width });
  setRect(viewport, { left: 0, top: 0, width, height: 100 });
  setBox(track, { offsetHeight: 100, offsetWidth: copies * count * STEP });
  viewport.setPointerCapture = () => {};
  viewport.releasePointerCapture = () => {};
  viewport.hasPointerCapture = () => false;
  const log = { active: [], navigate: [], side: [] };
  const engine = createEngine(
    { root, viewport, stage, track, canvas: null },
    {
      count,
      loop,
      lens,
      reducedMotion,
      initialIndex,
      side,
      rasterize: null,
      createRenderer: null,
      maxTextureSize() {},
      onActive: (i) => log.active.push(i),
      onNavigate: (i) => log.navigate.push(i),
      onSide: (n) => log.side.push(n),
    },
  );
  const x = () => Number(/translate3d\((-?[\d.]+)px/.exec(track.style.transform)?.[1]);
  /** x que centra el slide `index` de la copia principal. */
  const centered = (index) => width / 2 - ((loop ? side * count : 0) * STEP + index * STEP + SLIDE / 2);
  return { root, viewport, track, engine, log, x, centered, active: () => log.active.at(-1) };
}

let pointerId = 0;
function pointer(target, type, clientX, timeStamp, id) {
  const event = new window.PointerEvent(type, {
    pointerId: id,
    clientX,
    clientY: 50,
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerType: "mouse",
  });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  target.dispatchEvent(event);
  return event;
}
/** Arrastra por los puntos [x, t] dados y suelta en `releaseAt` (por defecto, el instante del último punto). */
function drag(c, points, releaseAt) {
  const id = ++pointerId;
  const [first, ...rest] = points;
  pointer(c.viewport, "pointerdown", first[0], first[1], id);
  for (const [px, t] of rest) pointer(c.viewport, "pointermove", px, t, id);
  const last = points.at(-1);
  pointer(c.viewport, "pointerup", last[0], releaseAt ?? last[1], id);
}

describe("posición y límites (sin bucle)", () => {
  test("el slide inicial queda centrado y se anuncia como activo", () => {
    const c = carousel({ initialIndex: 2 });
    assert.equal(c.x(), c.centered(2));
    assert.deepEqual(c.log.active, [2]);
    assert.equal(c.root.dataset.mode, "flat");
  });
  test("un índice inicial fuera de rango se acota", () => {
    assert.equal(carousel({ initialIndex: 99 }).active(), 4);
    assert.equal(carousel({ initialIndex: -3 }).active(), 0);
  });
  test("step avanza y retrocede de uno en uno y se detiene en los extremos", () => {
    const c = carousel();
    c.engine.step(1);
    c.engine.step(1);
    assert.equal(c.x(), c.centered(2));
    assert.deepEqual(c.log.navigate, [1, 2]);
    for (let i = 0; i < 10; i++) c.engine.step(1);
    assert.equal(c.x(), c.centered(4));
    assert.deepEqual(c.log.navigate, [1, 2, 3, 4], "en el extremo no se navega ni se anuncia");
    for (let i = 0; i < 10; i++) c.engine.step(-1);
    assert.equal(c.x(), c.centered(0));
  });
  test("goTo acota y redondea el índice", () => {
    const c = carousel();
    c.engine.goTo(99);
    assert.equal(c.active(), 4);
    c.engine.goTo(-1);
    assert.equal(c.active(), 0);
    c.engine.goTo(2.4);
    assert.equal(c.x(), c.centered(2));
  });
  test("un solo slide: nada se mueve", () => {
    const c = carousel({ count: 1 });
    c.engine.step(1);
    c.engine.step(-1);
    assert.equal(c.x(), c.centered(0));
    assert.deepEqual(c.log.navigate, []);
  });
  test("sin medidas (contenedor oculto) no lanza ni navega", () => {
    const c = carousel({ width: 0 });
    assert.doesNotThrow(() => {
      c.engine.step(1);
      c.engine.goTo(3);
    });
    assert.deepEqual(c.log.navigate, []);
    assert.equal(c.track.style.transform, "");
  });
});

describe("bucle", () => {
  test("empieza en la copia central", () => {
    const c = carousel({ loop: true });
    assert.equal(c.x(), c.centered(0));
  });
  test("retroceder desde el primero lleva al último, y avanzar desde el último al primero", () => {
    const c = carousel({ loop: true });
    c.engine.step(-1);
    assert.equal(c.active(), 4);
    c.engine.step(1);
    assert.equal(c.active(), 0);
    assert.deepEqual(c.log.navigate, [4, 0]);
  });
  test("dar muchas vueltas mantiene la tira dentro de un periodo (no se queda sin réplicas)", () => {
    const c = carousel({ loop: true });
    const period = 5 * STEP;
    const seen = [];
    for (let i = 0; i < 23; i++) {
      c.engine.step(1);
      seen.push(c.active());
      assert.ok(c.x() <= WIDTH / 2 - period && c.x() > WIDTH / 2 - 2 * period, `x=${c.x()} fuera de la copia central`);
    }
    assert.deepEqual(
      seen,
      Array.from({ length: 23 }, (_, i) => (i + 1) % 5),
    );
  });
  test("goTo elige la réplica más cercana: del primero al último es un paso atrás, no cuatro adelante", () => {
    const c = carousel({ loop: true, reducedMotion: false });
    const from = c.x();
    c.engine.goTo(4);
    advance(16);
    assert.ok(c.x() > from, "se mueve hacia la derecha (contenido anterior)");
    advance(3000);
    assert.equal(c.active(), 4);
  });
  test("pide más réplicas cuando la ventana es más ancha que la tira", () => {
    assert.deepEqual(carousel({ loop: true, count: 2, width: 1800 }).log.side, [3]);
    assert.deepEqual(carousel({ loop: true, count: 2, width: 100000 }).log.side, [4], "con un máximo de 4");
    assert.deepEqual(carousel({ loop: true }).log.side, [], "si basta con las que hay no avisa");
  });
});

describe("movimiento con muelle", () => {
  test("goTo llega exactamente al objetivo, se detiene y no se pasa de forma apreciable", () => {
    const c = carousel({ reducedMotion: false });
    c.engine.goTo(3);
    const target = c.centered(3);
    let min = Infinity;
    for (let i = 0; i < 400 && frames.some(Boolean); i++) {
      advance(16);
      min = Math.min(min, c.x());
    }
    assert.equal(c.x(), target);
    assert.equal(frames.some(Boolean), false, "sin fotogramas pendientes en reposo");
    assert.ok(min >= target - 2, `rebasa el objetivo en ${target - min}px`);
    assert.deepEqual(c.log.active, [0, 1, 2, 3]);
  });
  test("en reposo la posición es un píxel entero (texto nítido)", () => {
    const c = carousel({ reducedMotion: false, width: 601 });
    c.engine.goTo(1);
    advance(5000);
    assert.equal(Number.isInteger(c.x()), true);
  });
  test("una pestaña en segundo plano (salto de reloj de 10 s) no dispara la tira", () => {
    const c = carousel({ reducedMotion: false });
    c.engine.goTo(4);
    advance(16);
    now += 10_000;
    advance(16);
    assert.ok(c.x() <= c.centered(0) && c.x() >= c.centered(4) - 2, `x=${c.x()}`);
  });
  test("con movimiento reducido el cambio es inmediato y no hay animación", () => {
    const c = carousel({ reducedMotion: true });
    c.engine.goTo(3);
    assert.equal(c.x(), c.centered(3));
    assert.equal(frames.some(Boolean), false);
  });
  test("dispose detiene la animación y limpia el marcado", () => {
    const c = carousel({ reducedMotion: false });
    c.engine.goTo(3);
    advance(32);
    c.engine.dispose();
    assert.equal(c.track.style.transform, "");
    assert.equal(c.root.dataset.mode, undefined);
    const before = c.log.active.length;
    advance(1000);
    press(c.root, "ArrowRight");
    assert.equal(c.log.active.length, before);
  });
});

describe("arrastre y velocidad de lanzamiento", () => {
  test("un arrastre corto y lento vuelve al slide de partida", () => {
    const c = carousel({ initialIndex: 2 });
    drag(c, [
      [300, 0],
      [290, 200],
      [270, 400],
      [260, 600],
    ]);
    assert.equal(c.x(), c.centered(2));
  });
  test("arrastrar más de medio slide cambia al vecino", () => {
    const c = carousel({ initialIndex: 2 });
    drag(
      c,
      [
        [300, 0],
        [250, 300],
        [200, 600],
        [170, 900],
      ],
      1100,
    );
    assert.equal(c.active(), 3);
  });
  test("un gesto rápido y corto (flick) avanza aunque no llegue a medio slide", () => {
    const c = carousel({ initialIndex: 2 });
    // 50 px en 48 ms ≈ 1 px/ms; proyectado 280 ms son ~290 px más: pasa de largo el vecino.
    drag(c, [
      [300, 0],
      [290, 16],
      [270, 32],
      [250, 48],
    ]);
    assert.equal(c.active(), 4);
    // El mismo recorrido, despacio, no cambia de slide.
    const slow = carousel({ initialIndex: 2 });
    drag(slow, [
      [300, 0],
      [290, 300],
      [270, 600],
      [250, 900],
    ]);
    assert.equal(slow.active(), 2);
  });
  test("la velocidad sale de la ventana reciente, no del último par de eventos", () => {
    // Dos eventos con la misma marca de tiempo (Firefox redondea al milisegundo): no puede salir una velocidad infinita.
    const c = carousel({ count: 9, initialIndex: 4 });
    drag(c, [
      [300, 0],
      [294, 100],
      [292, 200],
      [280, 200],
    ]);
    assert.ok(Math.abs(c.active() - 4) <= 1, `activo ${c.active()}`);
  });
  test("si el puntero se detiene antes de soltar no hay lanzamiento", () => {
    const c = carousel({ initialIndex: 2 });
    drag(
      c,
      [
        [300, 0],
        [290, 16],
        [270, 32],
        [250, 48],
      ],
      200,
    );
    assert.equal(c.active(), 2);
  });
  test("un clic en un slide lateral lo centra", () => {
    const c = carousel({ reducedMotion: false, initialIndex: 1 });
    // Con el slide 1 centrado en una ventana de 600 px, el 2 ocupa [420, 620].
    const id = ++pointerId;
    pointer(c.viewport, "pointerdown", 500, 0, id);
    pointer(c.viewport, "pointerup", 500, 40, id);
    advance(5000);
    assert.equal(c.active(), 2);
    assert.equal(c.x(), c.centered(2));
  });
  test("la cola imperceptible del muelle no se traga el clic: la tira ya parece quieta y el slide pulsado se centra", () => {
    const c = carousel({ reducedMotion: false, initialIndex: 0 });
    c.engine.goTo(1);
    // Se avanza hasta que falta menos de 1 px, con el muelle aún sin dar el movimiento por terminado.
    for (let i = 0; i < 400 && Math.abs(c.x() - c.centered(1)) >= 1; i++) advance(16);
    assert.ok(frames.some(Boolean), "el muelle sigue activo (cola de asentamiento)");
    assert.ok(Math.abs(c.x() - c.centered(1)) < 1 && c.x() !== c.centered(1), `x=${c.x()}`);
    const id = ++pointerId;
    pointer(c.viewport, "pointerdown", 500, 0, id);
    pointer(c.viewport, "pointerup", 500, 40, id);
    advance(5000);
    assert.equal(c.active(), 2, "el clic sobre el slide 2 lo centra");
  });
  test("una pulsación con la tira en pleno movimiento la detiene y no navega al slide pulsado", () => {
    const c = carousel({ reducedMotion: false, count: 9, initialIndex: 0 });
    c.engine.goTo(6);
    advance(160);
    const moving = c.active();
    assert.ok(moving < 6, "aún en camino");
    const id = ++pointerId;
    pointer(c.viewport, "pointerdown", 590, 0, id);
    pointer(c.viewport, "pointerup", 590, 40, id);
    advance(5000);
    assert.ok(Math.abs(c.active() - moving) <= 1, `se ajusta al slide más cercano a donde se detuvo: ${c.active()} (iba por ${moving})`);
  });
  test("menos de 5 px no es un arrastre: no mueve la tira ni anula el clic", () => {
    const c = carousel({ initialIndex: 2 });
    const id = ++pointerId;
    pointer(c.viewport, "pointerdown", 300, 0, id);
    pointer(c.viewport, "pointermove", 303, 10, id);
    assert.equal(c.viewport.dataset.dragging, undefined);
    pointer(c.viewport, "pointerup", 303, 20, id);
    const click = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    c.track.querySelector("a").dispatchEvent(click);
    assert.equal(click.defaultPrevented, false);
  });
  test("tras un arrastre, el clic que genera el navegador se anula una sola vez", () => {
    const c = carousel({ initialIndex: 2 });
    drag(
      c,
      [
        [300, 0],
        [250, 100],
        [200, 200],
      ],
      500,
    );
    const link = c.track.querySelector("a");
    const first = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(first);
    const second = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(second);
    assert.deepEqual([first.defaultPrevented, second.defaultPrevented], [true, false]);
  });
  test("sin bucle, pasar del extremo ofrece resistencia (35 %) y al soltar vuelve", () => {
    const c = carousel({ initialIndex: 0 });
    const id = ++pointerId;
    pointer(c.viewport, "pointerdown", 100, 0, id);
    pointer(c.viewport, "pointermove", 300, 500, id);
    assert.equal(c.x(), c.centered(0) + 200 * 0.35);
    pointer(c.viewport, "pointerup", 300, 1000, id);
    assert.equal(c.x(), c.centered(0));
    assert.equal(c.active(), 0);
  });
  test("sin bucle, un lanzamiento enorme se queda en el último slide", () => {
    const c = carousel({ initialIndex: 2 });
    drag(c, [
      [590, 0],
      [300, 16],
      [10, 32],
    ]);
    assert.equal(c.active(), 4);
    assert.equal(c.x(), c.centered(4));
  });
  test("en bucle, el lanzamiento se limita a media vuelta por muy rápido que sea el gesto", () => {
    // 60 px en 4 ms son 15 px/ms: sin límite serían 4200 px (19 slides, más de tres vueltas a una tira de 6).
    const c = carousel({ loop: true, count: 6, initialIndex: 0 });
    drag(c, [
      [300, 0],
      [280, 2],
      [240, 4],
    ]);
    // Media vuelta (3 slides = 660 px) más los 60 px arrastrados: el slide 3.
    assert.equal(c.active(), 3);
    const back = carousel({ loop: true, count: 6, initialIndex: 0 });
    drag(back, [
      [300, 0],
      [320, 2],
      [360, 4],
    ]);
    assert.equal(back.active(), 3);
  });
  test("pointercancel abandona el gesto sin lanzar ni anular el clic", () => {
    const c = carousel({ initialIndex: 2 });
    const id = ++pointerId;
    pointer(c.viewport, "pointerdown", 300, 0, id);
    pointer(c.viewport, "pointermove", 280, 16, id);
    pointer(c.viewport, "pointermove", 250, 32, id);
    pointer(c.viewport, "pointercancel", 250, 300, id);
    assert.equal(c.viewport.dataset.dragging, undefined);
    assert.equal(c.active(), 2);
    const click = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    c.track.querySelector("a").dispatchEvent(click);
    assert.equal(click.defaultPrevented, false);
  });
  test("el botón secundario del ratón y un campo de texto no inician arrastre", () => {
    const c = carousel({ initialIndex: 2 });
    const id = ++pointerId;
    const event = new window.PointerEvent("pointerdown", { pointerId: id, clientX: 300, button: 2, pointerType: "mouse", bubbles: true });
    c.viewport.dispatchEvent(event);
    pointer(c.viewport, "pointermove", 100, 50, id);
    assert.equal(c.x(), c.centered(2));
    const input = document.createElement("input");
    c.track.firstElementChild.append(input);
    const id2 = ++pointerId;
    pointer(input, "pointerdown", 300, 0, id2);
    pointer(c.viewport, "pointermove", 100, 50, id2);
    assert.equal(c.x(), c.centered(2));
  });
});

describe("teclado", () => {
  test("flechas, Home y End navegan y consumen la tecla", () => {
    const c = carousel({ initialIndex: 2 });
    assert.equal(press(c.root, "ArrowRight").defaultPrevented, true);
    assert.equal(c.active(), 3);
    press(c.root, "ArrowLeft");
    assert.equal(c.active(), 2);
    press(c.root, "End");
    assert.equal(c.active(), 4);
    press(c.root, "Home");
    assert.equal(c.active(), 0);
    assert.deepEqual(c.log.navigate, [3, 2, 4, 0]);
  });
  test("con modificador, en un campo de texto o con otra tecla no hace nada", () => {
    const c = carousel({ initialIndex: 2 });
    assert.equal(press(c.root, "ArrowRight", { ctrlKey: true }).defaultPrevented, false);
    assert.equal(press(c.root, "a").defaultPrevented, false);
    const input = document.createElement("input");
    c.track.firstElementChild.append(input);
    assert.equal(press(input, "ArrowRight").defaultPrevented, false);
    assert.equal(c.active(), 2);
  });
  test("en el extremo sin bucle la flecha se consume pero no navega", () => {
    const c = carousel({ initialIndex: 4 });
    assert.equal(press(c.root, "ArrowRight").defaultPrevented, true);
    assert.deepEqual(c.log.navigate, []);
  });
});

describe("lente", () => {
  test("modo css: deforma los slides visibles de los lados con matrix3d y deja plano el centro", () => {
    const c = carousel({ lens: true, reducedMotion: false, count: 7, initialIndex: 3, width: 1200 });
    assert.equal(c.root.dataset.mode, "css");
    assert.equal(c.root.style.getPropertyValue("--z-carousel-bleed"), "45px");
    const slides = [...c.track.children];
    assert.doesNotMatch(slides[3].style.transform, /NaN/);
    assert.match(slides[1].style.transform, /^matrix3d\(/);
    assert.match(slides[5].style.transform, /^matrix3d\(/);
    assert.ok(["", "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)"].includes(slides[3].style.transform), slides[3].style.transform);
  });
  test("con movimiento reducido la lente se apaga", () => {
    const c = carousel({ lens: true, reducedMotion: true });
    assert.equal(c.root.dataset.mode, "flat");
    assert.equal(
      [...c.track.children].every((slide) => slide.style.transform === ""),
      true,
    );
  });
});
