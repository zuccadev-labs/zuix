// Gestos táctiles para las dos suites (tests/html y tests/browser).
//   Chromium: gestos reales por el protocolo de depuración (`Input.dispatchTouchEvent`). El navegador aplica
//     `touch-action`, el desplazamiento nativo, la captura implícita del puntero y `pointercancel`.
//   Firefox y WebKit: Playwright solo ofrece un toque real (`page.touchscreen.tap`). Los arrastres se emulan con
//     PointerEvent sintéticos de `pointerType: "touch"` enviados al elemento que recibió la pulsación (lo que hace la
//     captura implícita de un dedo). Ejercitan los manejadores, no la decisión del navegador sobre `touch-action`
//     ni el desplazamiento nativo: eso queda como no verificable en esos motores.
// El contexto debe crearse con `hasTouch: true` (ver touchContext).
//
// El gesto lleva su propio reloj. Cada evento se envía con la marca de tiempo que le corresponde en el gesto descrito
// (`stepMs` entre pasos, `hold` antes de soltar), no con la hora a la que el proceso de pruebas consiguió enviarlo:
// un dedo no va más despacio porque la CPU esté ocupada. Sin esto, con la máquina cargada un lanzamiento de 50 ms
// llega repartido en cientos de milisegundos y el componente, con razón, no lo trata como un lanzamiento.

/** Opciones de contexto para un teléfono. Firefox no admite `isMobile`. */
export const touchContext = (browserName, viewport = { width: 390, height: 844 }) => ({
  viewport,
  hasTouch: true,
  deviceScaleFactor: 1,
  ...(browserName === "firefox" ? {} : { isMobile: true }),
});

export async function touchDriver(page, browserName) {
  // Reloj del gesto (ms). `wait` deja pasar el tiempo real (la página pinta) y adelanta el reloj lo que dice el gesto.
  let clock = 0;
  const wait = async (ms) => {
    clock += ms;
    await page.waitForTimeout(ms);
  };
  let down, move, up;
  const real = browserName === "chromium";
  if (real) {
    const cdp = await page.context().newCDPSession(page);
    // Origen del reloj en segundos desde la época, que es lo que espera `timestamp`. Se fija al bajar el dedo.
    let origin = 0;
    const send = (type, points) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        timestamp: origin + clock / 1000,
        touchPoints: points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), id: 1 })),
      });
    down = (p) => {
      origin = Date.now() / 1000;
      clock = 0;
      return send("touchStart", [p]);
    };
    move = (p) => send("touchMove", [p]);
    up = () => send("touchEnd", []);
  } else {
    // `setPointerCapture` lanza con un identificador que no sea de un puntero activo. El del ratón siempre lo es:
    // con él la llamada no lanza (y no captura nada, porque el ratón no tiene botones pulsados).
    const mouseId = await (async () => {
      const waiting = page.evaluate(
        () =>
          new Promise((resolve) => {
            const done = (event) => {
              removeEventListener("pointermove", done, true);
              resolve(event.pointerId);
            };
            addEventListener("pointermove", done, true);
            setTimeout(() => {
              removeEventListener("pointermove", done, true);
              resolve(1);
            }, 1500);
          }),
      );
      await page.mouse.move(3, 3);
      await page.mouse.move(4, 4);
      return waiting;
    })();
    const fire = (type, p) =>
      page.evaluate(
        ([type, x, y, id, elapsed]) => {
          window.__zTouch ??= {};
          const state = window.__zTouch;
          if (type === "pointerdown") {
            state.target = document.elementFromPoint(x, y);
            state.origin = performance.now();
          }
          const target = state.target?.isConnected ? state.target : document.elementFromPoint(x, y);
          if (!target) return;
          const pressed = type !== "pointerup" && type !== "pointercancel";
          const event = new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            pointerId: id,
            pointerType: "touch",
            isPrimary: true,
            clientX: x,
            clientY: y,
            screenX: x,
            screenY: y,
            button: type === "pointermove" ? -1 : 0,
            buttons: pressed ? 1 : 0,
            width: 24,
            height: 24,
            pressure: pressed ? 0.5 : 0,
          });
          // `timeStamp` es de solo lectura y vale el instante de creación: se sustituye por el del reloj del gesto.
          Object.defineProperty(event, "timeStamp", { value: (state.origin ?? performance.now()) + elapsed });
          target.dispatchEvent(event);
          if (!pressed) state.target = null;
        },
        [type, p.x, p.y, mouseId, clock],
      );
    let last = { x: 0, y: 0 };
    down = (p) => {
      last = p;
      clock = 0;
      return fire("pointerdown", p);
    };
    move = (p) => {
      last = p;
      return fire("pointermove", p);
    };
    up = () => fire("pointerup", last);
  }
  /** Arrastre con el dedo de `from` a `to`. `stepMs` bajo y pocos pasos = gesto rápido (lanzamiento). */
  async function swipe(from, to, { steps = 8, stepMs = 16, hold = 0 } = {}) {
    await down(from);
    for (let i = 1; i <= steps; i++) {
      await move({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
      await wait(stepMs);
    }
    if (hold) await wait(hold);
    await up();
  }
  /** Pulsación larga: el dedo baja, espera `ms` sin moverse y `during` se ejecuta antes de levantarlo. */
  async function press(point, ms = 900, during) {
    await down(point);
    await wait(ms);
    try {
      if (during) await during();
    } finally {
      await up();
    }
  }
  /** Toque real en los tres motores. */
  const tap = (point) => page.touchscreen.tap(point.x, point.y);
  return { real, down, move, up, swipe, press, tap };
}
