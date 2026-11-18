// Capas apiladas y gobernadas desde fuera (pantalla `?screen=layers` de examples/app, en StrictMode).
// Lo que los casos de cada componente no ejercitan: cuatro capas unas dentro de otras, dos modales apilados, cientos
// de aperturas seguidas (fugas), `open` que cambia en mitad de una transición y desmontaje con la capa abierta.
// Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, sleep, poll, visible, gone, settled }) {
  const KINDS = ["modal", "drawer", "confirm", "palette", "popover", "popover-modal", "menu", "select", "date", "tooltip"];
  const layers = (open) => open("layers");
  const set = (page, kind) => page.evaluate((k) => window.zLayers.open(k), kind);
  /** Capas abiertas, de abajo arriba: diálogos modales y elementos popover (sin contar la región de avisos). */
  const stack = (page) =>
    page.evaluate(() => {
      const kind = (el) =>
        [...el.classList].find((c) => /^z-(modal|drawer|popover|menu|listbox|tooltip|palette)$/.test(c))?.slice(2) ?? el.className;
      return {
        modals: [...document.querySelectorAll("dialog:modal")].map(kind),
        popovers: [...document.querySelectorAll(":popover-open")].filter((el) => !el.matches(".z-toast-viewport")).map(kind),
        focus: document.activeElement?.getAttribute("data-testid") ?? [...(document.activeElement?.classList ?? [])].pop() ?? "",
        locked: getComputedStyle(document.documentElement).overflowY === "hidden",
      };
    });
  const closed = (page, message) =>
    poll(async () => {
      const s = await stack(page);
      return s.modals.length === 0 && s.popovers.length === 0 && !s.locked;
    }, message);
  const same = (actual, expected, message) =>
    assert(
      JSON.stringify(actual) === JSON.stringify(expected),
      `${message}: esperado ${JSON.stringify(expected)}, es ${JSON.stringify(actual)}`,
    );

  /** Cuenta, desde antes de que cargue la página, los listeners de window, document, <html> y <body> y los observadores vivos. */
  const instrument = () => {
    const live = new Map();
    const nameOf = (target) =>
      target === window
        ? "window"
        : target === document
          ? "document"
          : target === document.body
            ? "body"
            : target === document.documentElement
              ? "html"
              : null;
    const capture = (options) => (typeof options === "boolean" ? options : !!options?.capture);
    const { addEventListener, removeEventListener } = EventTarget.prototype;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const name = nameOf(this);
      if (name && listener) {
        const key = `${name}:${type}:${capture(options)}`;
        if (!live.has(key)) live.set(key, new Set());
        const set = live.get(key);
        set.add(listener);
        if (options && typeof options === "object" && options.signal) options.signal.addEventListener("abort", () => set.delete(listener));
      }
      return addEventListener.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const name = nameOf(this);
      if (name) live.get(`${name}:${type}:${capture(options)}`)?.delete(listener);
      return removeEventListener.call(this, type, listener, options);
    };
    const observers = { mutation: 0, resize: 0 };
    const Mutation = window.MutationObserver;
    window.MutationObserver = class extends Mutation {
      #on = false;
      observe(...args) {
        if (!this.#on) observers.mutation += 1;
        this.#on = true;
        return super.observe(...args);
      }
      disconnect() {
        if (this.#on) observers.mutation -= 1;
        this.#on = false;
        return super.disconnect();
      }
    };
    const Resize = window.ResizeObserver;
    window.ResizeObserver = class extends Resize {
      #targets = new Set();
      observe(target, options) {
        if (!this.#targets.size) observers.resize += 1;
        this.#targets.add(target);
        return super.observe(target, options);
      }
      unobserve(target) {
        const had = this.#targets.size > 0;
        this.#targets.delete(target);
        if (had && !this.#targets.size) observers.resize -= 1;
        return super.unobserve(target);
      }
      disconnect() {
        if (this.#targets.size) observers.resize -= 1;
        this.#targets.clear();
        return super.disconnect();
      }
    };
    window.zLeaks = () => ({
      listeners: Object.fromEntries([...live].filter(([, set]) => set.size).map(([key, set]) => [key, set.size])),
      observers: { ...observers },
      nodes: document.querySelectorAll("*").length,
      html: document.documentElement.getAttribute("style") ?? "",
      body: document.body.getAttribute("style") ?? "",
      inert: document.querySelectorAll("[inert]").length,
    });
  };

  return [
    {
      name: "Capas · anidadas: drawer > modal > popover > menú > submenú; Escape cierra de una en una y el foco vuelve a cada disparador",
      async run({ open }) {
        const page = await layers(open);
        for (const id of ["l-drawer", "l-modal", "l-popover", "l-menu"]) {
          await page.click(t(id));
          await settled(page);
        }
        let s = await stack(page);
        same(s.modals, ["drawer", "modal"], "diálogos modales abiertos");
        same(s.popovers, ["popover", "menu"], "capas popover abiertas");
        same(s.focus, "z-menu__item", "el foco está en la primera entrada del menú");
        await page.keyboard.press("End");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await stack(page)).popovers.length === 3, "el submenú se abre con Flecha derecha");
        await settled(page);
        const sequence = [];
        for (let i = 0; i < 5; i++) {
          const before = await stack(page);
          await page.keyboard.press("Escape");
          await poll(
            async () => {
              const now = await stack(page);
              return now.modals.length + now.popovers.length === before.modals.length + before.popovers.length - 1;
            },
            `Escape ${i + 1} cierra exactamente una capa`,
          );
          await settled(page);
          s = await stack(page);
          sequence.push(`${s.modals.length}+${s.popovers.length}@${s.focus}`);
        }
        same(sequence, ["2+2@z-menu__item", "2+1@l-menu", "2+0@l-popover", "1+0@l-modal", "0+0@l-drawer"], "capas y foco tras cada Escape");
        const log = (await page.textContent(t("l-log"))).trim();
        assert(/menu:closed popover:closed modal:closed drawer:closed$/.test(log), `orden de cierre: ${log}`);
        await closed(page, "sin capas y con la página desplazable al terminar");
      },
    },
    {
      name: "Capas · dos modales apilados: el de arriba retiene el foco, su velo cierra solo ese y la página sigue bloqueada",
      async run({ open }) {
        const page = await layers(open);
        for (const id of ["l-drawer", "l-modal", "l-popover"]) {
          await page.click(t(id));
          await settled(page);
        }
        // Elegir en un Select dentro del popover no cierra el popover ni los diálogos.
        await page.click('.z-popover [role="combobox"]');
        await visible(page, ".z-listbox:popover-open");
        await page.click('.z-listbox:popover-open [role="option"] >> nth=1');
        await gone(page, ".z-listbox:popover-open");
        let s = await stack(page);
        same([s.modals, s.popovers], [["drawer", "modal"], ["popover"]], "tras elegir una opción");
        // Pulsar en el cuerpo del modal, fuera del popover, cierra solo el popover.
        await page.click("dialog.z-modal h2");
        await poll(async () => (await stack(page)).popovers.length === 0, "pulsar fuera del popover lo cierra");
        same((await stack(page)).modals, ["drawer", "modal"], "los diálogos siguen abiertos");
        await page.click(t("l-modal-2"));
        await poll(async () => (await stack(page)).modals.length === 3, "se abre el segundo modal sobre el primero");
        await settled(page);
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press("Tab");
          assert(
            await page.evaluate(() => [...document.querySelectorAll("dialog:modal")].pop().contains(document.activeElement)),
            `Tab sacó el foco del modal de arriba (pulsación ${i + 1})`,
          );
        }
        await page.mouse.click(4, 4);
        await poll(async () => (await stack(page)).modals.length === 2, "pulsar en el velo cierra solo el modal de arriba");
        await settled(page);
        s = await stack(page);
        same(s.focus, "l-modal-2", "el foco vuelve al disparador del segundo modal");
        assert(s.locked, "con dos diálogos aún abiertos la página no debe poder desplazarse");
        await page.keyboard.press("Escape");
        await poll(async () => (await stack(page)).modals.length === 1, "Escape cierra el primer modal");
        await settled(page);
        assert((await stack(page)).locked, "con el cajón aún abierto la página sigue bloqueada");
        await page.keyboard.press("Escape");
        await closed(page, "cerrado todo, la página vuelve a desplazarse");
      },
    },
    {
      name: "Capas · 200 aperturas y cierres seguidos no dejan listeners, observadores, nodos ni bloqueos",
      async run({ open }) {
        const page = await layers(open);
        await page.addInitScript(instrument);
        await page.reload({ waitUntil: "load" });
        await page.waitForSelector(t("screen-layers"));
        await page.waitForFunction(() => !!window.zLayers);
        const leaks = () => page.evaluate(() => window.zLeaks());
        const cycle = async (wait) => {
          for (const kind of KINDS) {
            await set(page, kind);
            await sleep(wait);
            await set(page, null);
            await sleep(wait);
          }
        };
        // Una vuelta de calentamiento: lo que se crea una sola vez (portales, regiones) no cuenta como fuga.
        await cycle(250);
        await closed(page, "tras el calentamiento no queda ninguna capa");
        await settled(page);
        const before = await leaks();
        // 20 vueltas × 10 capas, con esperas distintas: unas veces se cierra con la entrada a medias y otras ya asentada.
        for (let i = 0; i < 20; i++) await cycle(30 + (i % 4) * 40);
        await closed(page, "tras 200 aperturas no queda ninguna capa ni el desplazamiento bloqueado");
        await poll(async () => (await leaks()).nodes === before.nodes, `el documento vuelve a tener ${before.nodes} nodos`);
        const after = await leaks();
        same(after.listeners, before.listeners, "listeners en window, document, <html> y <body>");
        same(after.observers, before.observers, "observadores vivos");
        same([after.html, after.body, after.inert], [before.html, before.body, before.inert], "estilos en línea e inercia");
      },
    },
    {
      name: "Capas · open cambia en mitad de la transición y el componente se desmonta con la capa abierta o saliendo",
      async run({ open }) {
        const page = await layers(open);
        await page.waitForFunction(() => !!window.zLayers);
        for (const kind of KINDS) {
          // Abrir, cerrar y volver a abrir antes de que termine ninguna animación: queda abierta, y una sola.
          await page.evaluate(async (k) => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            window.zLayers.open(k);
            await wait(30);
            window.zLayers.open(null);
            await wait(30);
            window.zLayers.open(k);
            await wait(30);
            window.zLayers.open(null);
            await wait(10);
            window.zLayers.open(k);
          }, kind);
          await poll(async () => {
            const s = await stack(page);
            return s.modals.length + s.popovers.length >= 1;
          }, `${kind}: queda abierta tras alternar open`);
          await settled(page);
          const stale = await page.evaluate(
            () => document.querySelectorAll('dialog[open][data-state="closed"], :popover-open[data-state="closed"]').length,
          );
          assert(stale === 0, `${kind}: ${stale} capas siguen a la vista en estado closed`);
          // Desmontar con la capa abierta.
          await page.evaluate(() => window.zLayers.mount(false));
          await visible(page, t("l-unmounted"));
          await closed(page, `${kind}: desmontar con la capa abierta no deja capa ni bloqueo`);
          await page.evaluate(() => window.zLayers.mount(true));
          await page.waitForFunction(() => !!document.querySelector('[data-testid="l-controlled"]') && !!window.zLayers);
          // Desmontar durante la animación de salida.
          await set(page, kind);
          await settled(page);
          await page.evaluate(async () => {
            window.zLayers.open(null);
            await new Promise((resolve) => setTimeout(resolve, 40));
            window.zLayers.mount(false);
          });
          await visible(page, t("l-unmounted"));
          await closed(page, `${kind}: desmontar durante la salida no deja capa ni bloqueo`);
          await page.evaluate(() => {
            window.zLayers.open(null);
            window.zLayers.mount(true);
          });
          await page.waitForFunction(() => !!document.querySelector('[data-testid="l-controlled"]') && !!window.zLayers);
        }
      },
    },
  ];
}
