// Reposo real de un Carousel, para las dos suites de navegador.
// El motor mueve la tira en `requestAnimationFrame`. Mirar la posición dos veces con una pausa entre medias no basta:
// con la CPU saturada el navegador puede pasar más de 100 ms sin pintar un fotograma y dos lecturas iguales no
// significan que la tira se haya detenido. Aquí la lectura va dentro de la página y cuenta fotogramas: la tira está en
// reposo cuando su `transform` no cambia durante varios fotogramas seguidos y no hay un arrastre en curso.

/**
 * Espera a que la tira de `root` (selector de `.z-carousel`) se detenga. Lanza si no lo hace en `timeout` ms.
 * `frames`: fotogramas seguidos sin cambio que cuentan como reposo.
 */
export async function carouselAtRest(page, root, { frames = 4, timeout = 15000 } = {}) {
  const stopped = await page.evaluate(
    ([selector, wanted, limit]) =>
      new Promise((resolve) => {
        const el = document.querySelector(selector);
        const track = el?.querySelector(".z-carousel__track");
        const viewport = el?.querySelector(".z-carousel__viewport");
        if (!track || !viewport) return resolve(`no hay un carrusel activo en ${selector}`);
        const started = performance.now();
        let last = null;
        let same = 0;
        const frame = () => {
          const now = `${track.style.transform}|${viewport.hasAttribute("data-dragging")}`;
          same = now === last ? same + 1 : 0;
          last = now;
          if (same >= wanted && !viewport.hasAttribute("data-dragging")) return resolve(null);
          if (performance.now() - started > limit) return resolve(`la tira de ${selector} no se detuvo: ${now}`);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    [root, frames, timeout],
  );
  if (stopped) throw new Error(stopped);
}
