// Casos de prueba en navegador. Cada caso recibe { open, shot, axe, finger, note, browserName, Unverifiable } (ver run.mjs).
// Un caso falla si lanza o si la página registra errores de consola, `pageerror` o peticiones fallidas.

import auditCss from "./cases-audit-css.mjs";
import auditReact from "./cases-audit-react.mjs";
import layers from "./cases-layers.mjs";
import wave3 from "./cases-wave3.mjs";
import wave4Zout from "./cases-wave4-zout.mjs";
import { carouselAtRest } from "../rest.mjs";

const t = (id) => `[data-testid="${id}"]`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const TIMEOUT = 10000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Repite `fn` (en Node) hasta que devuelva algo verdadero. Admite selectores de Playwright a través de locators. */
async function poll(fn, message, timeout = TIMEOUT) {
  const end = Date.now() + timeout;
  let last;
  for (;;) {
    try {
      last = await fn();
      if (last) return last;
    } catch (error) {
      last = error.message.split("\n")[0];
    }
    if (Date.now() > end) throw new Error(`No se cumplió: ${message}${last ? ` (último valor: ${JSON.stringify(last)})` : ""}`);
    await sleep(40);
  }
}

/** Espera a que la condición se cumpla dentro de la página. Solo selectores CSS estándar. */
async function until(page, fn, message, arg, timeout = TIMEOUT) {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 50 });
  } catch {
    throw new Error(`No se cumplió: ${message}`);
  }
}

const visible = (page, selector, message = `${selector} visible`) =>
  page.waitForSelector(selector, { state: "visible", timeout: TIMEOUT }).catch(() => {
    throw new Error(`No se cumplió: ${message}`);
  });
const gone = (page, selector, message = `${selector} retirado`) =>
  page.waitForSelector(selector, { state: "detached", timeout: TIMEOUT }).catch(() => {
    throw new Error(`No se cumplió: ${message}`);
  });

/** Espera a que terminen las animaciones y transiciones finitas (entrada de capas, muelles CSS). */
const settled = (page) =>
  until(
    page,
    () => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity),
    "las animaciones terminan",
  );

const focusInside = (page, selector, message = `foco dentro de ${selector}`) =>
  poll(
    () =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => el.contains(document.activeElement) && document.activeElement !== document.body),
    message,
  );
const focusOn = (page, selector, message = `foco en ${selector}`) =>
  poll(
    () =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => el === document.activeElement),
    message,
  );
const expectAttr = (page, selector, name, value, message = `${selector} con ${name}="${value}"`) =>
  poll(async () => (await page.locator(selector).first().getAttribute(name)) === value, message);
const expectText = (page, selector, expected, message = `${selector} con texto "${expected}"`) =>
  poll(async () => ((await page.locator(selector).first().textContent()) ?? "").trim() === expected, message);
const expectCount = (page, selector, count, message = `${count} × ${selector}`) =>
  poll(async () => (await page.locator(selector).count()) === count, message);

/** Con Tab y Mayús+Tab el foco no debe salir del contenedor. */
async function expectFocusTrap(page, selector, presses = 6) {
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let i = 0; i < presses; i++) {
      await page.keyboard.press(key);
      const inside = await page.evaluate((s) => document.querySelector(s)?.contains(document.activeElement) ?? false, selector);
      assert(inside, `El foco salió de ${selector} tras ${i + 1} × ${key}`);
    }
  }
}

const menuFocus = (page, prefix, message = "elemento de menú enfocado") =>
  poll(
    () =>
      page.evaluate(
        (p) => document.activeElement?.getAttribute("role") === "menuitem" && document.activeElement.textContent.startsWith(p),
        prefix,
      ),
    `${message}: "${prefix}"`,
  );
/**
 * Clic fuera de una capa recién abierta. Se espera al reposo: un clic sintético en el mismo frame de la apertura llega
 * antes de que la capa termine de montarse y colocarse (una persona no llega a tiempo).
 */
async function clickOutside(page, x, y) {
  await settled(page);
  await sleep(80);
  await page.mouse.click(x, y);
}
// biome-ignore lint/performance/useDomNodeTextContent: es el método innerText() de Playwright, no la propiedad del DOM; las aserciones comparan el texto que se ve (sin nodos ocultos), que textContent no da.
const text = (page, selector) => page.locator(selector).first().innerText();

/** El elemento queda por encima de todo en su centro (no lo tapa otra capa). */
async function expectOnTop(page, selector) {
  await settled(page);
  const ok = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (el === hit || el.contains(hit));
  }, selector);
  assert(ok, `${selector} queda tapado por otra capa`);
}

/** El elemento cabe entero en la ventana. */
async function expectInViewport(page, selector) {
  await settled(page);
  const box = await page.locator(selector).first().boundingBox();
  const size = page.viewportSize();
  assert(box, `${selector} sin caja`);
  assert(
    box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= size.width + 0.5 && box.y + box.height <= size.height + 0.5,
    `${selector} se sale de la ventana: ${JSON.stringify(box)} en ${size.width}×${size.height}`,
  );
}

async function drag(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

const center = async (page, selector) => {
  const box = await page.locator(selector).first().boundingBox();
  assert(box, `${selector} sin caja`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
};

/** Desbordamiento horizontal: ni el documento ni los contenedores de página pueden ser más anchos que la ventana. */
async function overflowReport(page) {
  return page.evaluate(() => {
    const out = [];
    const vw = window.innerWidth;
    const check = (el, name) => {
      if (el && el.scrollWidth > el.clientWidth + 1) out.push(`${name}: scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
    };
    check(document.documentElement, "html");
    check(document.body, "body");
    for (const s of [
      ".z-shell",
      ".z-shell__body",
      ".z-shell__main",
      ".z-shell__content",
      ".z-page",
      ".z-container",
      ".z-page__body",
      ".z-titlebar",
    ])
      check(document.querySelector(s), s);
    // Elementos visibles que asoman por la derecha o la izquierda sin estar en un contenedor con desplazamiento horizontal propio.
    const scrollsX = (el) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const o = getComputedStyle(n).overflowX;
        if ((o === "auto" || o === "scroll") && n.scrollWidth > n.clientWidth) return true;
        if (n.classList.contains("z-carousel__viewport")) return true;
      }
      return false;
    };
    for (const el of document.querySelectorAll(".z-shell *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if ((r.right > vw + 1 || r.left < -1) && !scrollsX(el) && getComputedStyle(el).visibility !== "hidden") {
        out.push(
          `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} [${Math.round(r.left)}, ${Math.round(r.right)}] fuera de 0–${vw}`,
        );
        if (out.length > 12) break;
      }
    }
    return out;
  });
}

/** Fecha (`data-date`) del día del calendario que tiene el foco. */
const activeDate = (page) => page.evaluate(() => document.activeElement?.dataset?.date ?? null);

/** Ejecuta `fn("page")` y después `fn("modal")` con el Modal de la pantalla Forms abierto; al final Escape lo cierra. */
async function inPageAndModal(page, fn) {
  await fn("page");
  await page.locator(t("open-forms-modal")).scrollIntoViewIfNeeded();
  await page.click(t("open-forms-modal"));
  await visible(page, "dialog.z-modal:modal");
  await settled(page);
  await fn("modal");
  assert(await page.isVisible(".z-modal"), "el modal sigue abierto tras usar los controles");
  // Al cerrar su capa, el control recupera el foco tras el cierre (no en el mismo instante): se espera a que vuelva.
  await poll(
    () =>
      page.evaluate(() => {
        const a = document.activeElement;
        return !!a && a !== document.body && !!a.closest(".z-modal");
      }),
    "el foco sigue dentro del modal",
  );
  await page.keyboard.press("Escape");
  await gone(page, ".z-modal");
  await focusOn(page, t("open-forms-modal"), "al cerrar el modal el foco vuelve a su disparador");
}

const SCREENS = ["overview", "projects", "overlays", "navigation", "gallery", "editor", "forms", "agenda", "workspace"];

export const cases = [
  // ───────────────────────────── Overlays ─────────────────────────────
  {
    name: "Modal: abre, atrapa el foco, Escape cierra y devuelve el foco",
    async run({ open, shot }) {
      const page = await open("overlays");
      await page.click(t("open-modal"));
      await visible(page, "dialog.z-modal:modal");
      await focusInside(page, ".z-modal");
      assert((await page.getAttribute(".z-modal", "aria-modal")) !== "false", "el modal debe ser modal");
      const labelled = await page.evaluate(() => {
        const d = document.querySelector(".z-modal");
        const id = d?.getAttribute("aria-labelledby");
        return id ? document.getElementById(id)?.textContent : null;
      });
      assert(labelled === "Invite member", `aria-labelledby apunta a "${labelled}"`);
      await settled(page);
      await expectInViewport(page, ".z-modal");
      await expectOnTop(page, ".z-modal");
      await expectFocusTrap(page, ".z-modal");
      await shot(page, "overlay-modal");
      // El fondo queda inerte para lectores de pantalla y puntero.
      // Con <dialog> + showModal() la inercia es nativa (no hay aria-hidden ni atributo inert que mirar): se comprueba su
      // efecto. Un control del fondo no acepta el foco y el puntero sobre él da en el velo del diálogo.
      const hidden = await page.evaluate((trigger) => {
        const dialog = document.querySelector(".z-modal");
        const outside = document.querySelector(trigger);
        if (!dialog?.matches("dialog:modal") || !outside || dialog.contains(outside)) return false;
        outside.focus();
        const box = outside.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return document.activeElement !== outside && dialog.contains(document.activeElement) && !outside.contains(hit);
      }, t("open-modal"));
      assert(hidden, "el fondo no queda oculto/inerte con el modal abierto");
      await page.keyboard.press("Escape");
      await gone(page, ".z-modal");
      await focusOn(page, t("open-modal"), "el foco vuelve al disparador del modal");

      // Escribir y enviar.
      await page.click(t("open-modal"));
      await visible(page, ".z-modal");
      await page.fill(t("modal-email"), "ada@example.com");
      await page.click(t("modal-submit"));
      await gone(page, ".z-modal");
      await expectText(page, t("last-action"), "invite:ada@example.com");

      // Clic en el velo cierra.
      await page.click(t("open-modal"));
      await visible(page, ".z-modal");
      await clickOutside(page, 20, 20);
      await gone(page, ".z-modal", "el clic en el velo cierra el modal");
      // Botón de cierre.
      await page.click(t("open-modal"));
      await visible(page, ".z-modal");
      await page.click(".z-modal__close");
      await gone(page, ".z-modal");
    },
  },
  {
    name: "Modal: menú anidado queda por encima y se maneja con teclado",
    async run({ open, shot }) {
      const page = await open("overlays");
      await page.click(t("open-modal"));
      await visible(page, ".z-modal");
      await page.focus(t("modal-role"));
      await page.keyboard.press("Enter");
      await visible(page, ".z-menu[role=menu]");
      await settled(page);
      await expectOnTop(page, ".z-menu[role=menu]");
      await shot(page, "overlay-modal-menu");
      await menuFocus(page, "Viewer");
      await page.keyboard.press("ArrowDown");
      await menuFocus(page, "Editor");
      await page.keyboard.press("Enter");
      await gone(page, ".z-menu[role=menu]");
      await expectText(page, t("last-action"), "role:editor");
      await visible(page, ".z-modal", "el modal sigue abierto tras elegir en el menú");
      // Escape con el menú abierto cierra solo el menú.
      await page.focus(t("modal-role"));
      await page.keyboard.press("Enter");
      await visible(page, ".z-menu[role=menu]");
      await page.keyboard.press("Escape");
      await gone(page, ".z-menu[role=menu]");
      await visible(page, ".z-modal", "Escape en el menú no cierra el modal");
      await page.keyboard.press("Escape");
      await gone(page, ".z-modal");
    },
  },
  {
    name: "Modal no descartable: Escape y velo no cierran, el botón sí",
    async run({ open }) {
      const page = await open("overlays");
      await page.click(t("open-locked"));
      await visible(page, ".z-modal");
      await page.keyboard.press("Escape");
      await clickOutside(page, 20, 20);
      await page.waitForTimeout(300);
      assert(await page.isVisible(".z-modal"), "el modal no descartable se cerró");
      await focusInside(page, ".z-modal");
      await page.click(".z-modal__close");
      await gone(page, ".z-modal");
      await focusOn(page, t("open-locked"), "el foco vuelve al disparador");
    },
  },
  {
    name: "ConfirmDialog: alertdialog, foco atrapado, Escape, confirmar y cancelar",
    async run({ open, shot }) {
      const page = await open("overlays");
      await page.click(t("open-confirm"));
      await visible(page, ".z-confirm[role=alertdialog]");
      await focusInside(page, ".z-confirm");
      await poll(
        () => page.evaluate(() => document.activeElement?.textContent === "Cancel"),
        "el foco inicial va a Cancel (la acción menos destructiva)",
      );
      await expectFocusTrap(page, ".z-confirm", 5);
      await shot(page, "overlay-confirm");
      // El velo no cierra un alertdialog.
      await clickOutside(page, 20, 20);
      await page.waitForTimeout(200);
      assert(await page.isVisible(".z-confirm"), "un clic fuera cerró el diálogo de confirmación");
      await page.keyboard.press("Escape");
      await gone(page, ".z-confirm");
      await focusOn(page, t("open-confirm"), "el foco vuelve al disparador");

      await page.click(t("open-confirm"));
      await visible(page, ".z-confirm");
      await page.click(".z-confirm .z-dialog-btn[data-variant=danger]");
      await gone(page, ".z-confirm");
      await expectText(page, t("last-action"), "confirm:delete");

      await page.click(t("open-confirm"));
      await visible(page, ".z-confirm");
      await poll(() => page.evaluate(() => document.activeElement?.textContent === "Cancel"), "foco en Cancel");
      await page.keyboard.press("Enter");
      await gone(page, ".z-confirm");
      await expectText(page, t("last-action"), "confirm:cancel");
    },
  },
  {
    name: "Drawer: lateral e inferior, foco atrapado, Escape y velo",
    async run({ open, shot }) {
      const page = await open("overlays");
      await page.click(t("open-drawer"));
      await visible(page, "dialog.z-drawer:modal");
      await focusInside(page, ".z-drawer");
      await settled(page);
      await expectInViewport(page, ".z-drawer");
      await expectFocusTrap(page, ".z-drawer");
      await shot(page, "overlay-drawer");
      const box = await page.locator(".z-drawer").boundingBox();
      assert(box.x + box.width > 1440 - 30 && box.height > 800, `el drawer derecho no está pegado al borde: ${JSON.stringify(box)}`);
      await page.keyboard.press("Escape");
      await gone(page, ".z-drawer");
      await focusOn(page, t("open-drawer"), "el foco vuelve al disparador del drawer");

      await page.click(t("open-drawer"));
      await visible(page, ".z-drawer");
      await clickOutside(page, 200, 400);
      await gone(page, ".z-drawer", "el clic en el velo cierra el drawer");

      await page.click(t("open-drawer"));
      await visible(page, ".z-drawer");
      await page.click(t("drawer-save"));
      await expectText(page, t("last-action"), "drawer:save");
      await page.click(".z-drawer__close");
      await gone(page, ".z-drawer");

      await page.click(t("open-drawer-bottom"));
      await visible(page, ".z-drawer[data-side=bottom]");
      await settled(page);
      await expectInViewport(page, ".z-drawer");
      await shot(page, "overlay-drawer-bottom");
      const bottom = await page.locator(".z-drawer").boundingBox();
      assert(bottom.y + bottom.height > 900 - 30, "el drawer inferior no está abajo");
      await page.keyboard.press("Escape");
      await gone(page, ".z-drawer");
      await focusOn(page, t("open-drawer-bottom"));
    },
  },
  {
    name: "Popover: abre junto al disparador, recibe el foco, Escape y clic fuera",
    async run({ open, shot }) {
      const page = await open("overlays");
      await page.click(t("open-popover"));
      await visible(page, ".z-popover");
      await focusInside(page, ".z-popover");
      await settled(page);
      await expectInViewport(page, ".z-popover");
      await expectOnTop(page, ".z-popover");
      const trigger = await page.locator(t("open-popover")).boundingBox();
      const pop = await page.locator(".z-popover").boundingBox();
      assert(
        Math.abs(pop.y - (trigger.y + trigger.height)) < 16 && Math.abs(pop.x - trigger.x) < 4,
        `el popover no está anclado al disparador: ${JSON.stringify({ trigger, pop })}`,
      );
      assert(Math.abs(pop.width - 260) < 2, `ancho del popover ${pop.width}, se pidió 260`);
      await shot(page, "overlay-popover");
      await page.fill(t("popover-input"), "urgent");
      await page.keyboard.press("Escape");
      await gone(page, ".z-popover");
      await focusOn(page, t("open-popover"), "el foco vuelve al disparador del popover");

      await page.keyboard.press("Enter");
      await visible(page, ".z-popover");
      await page.click(t("popover-apply"));
      await expectText(page, t("last-action"), "popover:apply");
      await clickOutside(page, 700, 850);
      await gone(page, ".z-popover", "el clic fuera cierra el popover");
    },
  },
  {
    name: "Tooltip: aparece con puntero y con foco, Escape lo oculta",
    async run({ open, shot }) {
      const page = await open("overlays");
      await page.hover(t("tooltip-trigger"));
      await visible(page, ".z-tooltip");
      assert((await text(page, ".z-tooltip")).includes("Refresh the list"), "texto del tooltip");
      const described = await page.evaluate((s) => {
        const id = document.querySelector(s)?.getAttribute("aria-describedby");
        return id ? document.getElementById(id)?.textContent : null;
      }, t("tooltip-trigger"));
      assert(described?.includes("Refresh the list"), "el disparador no queda descrito por el tooltip (aria-describedby)");
      await settled(page);
      const trigger = await page.locator(t("tooltip-trigger")).boundingBox();
      const tip = await page.locator(".z-tooltip").boundingBox();
      assert(tip.y + tip.height <= trigger.y + 1, "el tooltip debe quedar encima del disparador");
      await shot(page, "overlay-tooltip");
      await page.mouse.move(700, 850, { steps: 4 });
      await gone(page, ".z-tooltip", "el tooltip se oculta al salir el puntero");

      await page.focus(t("open-popover"));
      await page.keyboard.press("Tab");
      await focusOn(page, t("tooltip-trigger"));
      await visible(page, ".z-tooltip", "el tooltip aparece con el foco de teclado");
      await page.keyboard.press("Escape");
      await gone(page, ".z-tooltip", "Escape oculta el tooltip");
      await focusOn(page, t("tooltip-trigger"), "Escape no mueve el foco");
    },
  },
  {
    name: "Menu: teclado, submenú, elemento persistente, deshabilitado y Escape",
    async run({ open, shot }) {
      const page = await open("overlays");
      await page.focus(t("open-menu"));
      await page.keyboard.press("Enter");
      await visible(page, ".z-menu[role=menu]");
      await expectInViewport(page, ".z-menu[role=menu]");
      const highlighted = (prefix, message) =>
        poll(
          () =>
            page.evaluate(
              (p) => document.activeElement?.getAttribute("role") === "menuitem" && document.activeElement.textContent.startsWith(p),
              prefix,
            ),
          `${message}: elemento enfocado "${prefix}"`,
        );
      await highlighted("Rename", "abrir con teclado enfoca el primer elemento");
      await page.keyboard.press("ArrowDown");
      await highlighted("Duplicate", "flecha abajo");
      await page.keyboard.press("End");
      await highlighted("Delete", "End");
      await page.keyboard.press("Home");
      await highlighted("Rename", "Home");
      await page.keyboard.press("ArrowDown");
      await highlighted("Duplicate", "flecha abajo");
      await page.keyboard.press("ArrowDown");
      await highlighted("Pin", "flecha abajo");
      await page.keyboard.press("Enter");
      await expectText(page, t("pin-state"), "Pinned");
      await highlighted("Unpin", "keepOpen: el menú sigue abierto y conserva el foco");
      // El deshabilitado se salta: Pin → (Locked) → Move to.
      await page.keyboard.press("ArrowDown");
      await highlighted("Move to", "el elemento deshabilitado se salta");
      await page.keyboard.press("ArrowRight");
      await expectCount(page, ".z-menu[role=menu]", 2, "flecha derecha abre el submenú");
      await highlighted("Atlas", "el foco entra en el submenú");
      await settled(page);
      await shot(page, "overlay-menu-submenu");
      await expectInViewport(page, ".z-menu[role=menu] >> nth=1");
      await page.keyboard.press("ArrowLeft");
      await expectCount(page, ".z-menu[role=menu]", 1, "flecha izquierda cierra el submenú");
      await highlighted("Move to", "el foco vuelve al elemento padre");
      await page.keyboard.press("ArrowRight");
      await expectCount(page, ".z-menu[role=menu]", 2, "submenú abierto de nuevo");
      await highlighted("Atlas", "submenú");
      await page.keyboard.press("ArrowDown");
      await highlighted("Borealis", "flecha abajo en el submenú");
      await page.keyboard.press("Enter");
      await gone(page, ".z-menu[role=menu]");
      await expectText(page, t("last-action"), "menu:move-borealis");
      await focusOn(page, t("open-menu"), "el foco vuelve al disparador del menú");

      // Búsqueda por letra y Escape.
      await page.keyboard.press("ArrowDown");
      await visible(page, ".z-menu[role=menu]");
      await page.keyboard.press("d");
      await menuFocus(page, "D", "la búsqueda por letra enfoca un elemento que empieza por D");
      await page.keyboard.press("Escape");
      await gone(page, ".z-menu[role=menu]");
      await focusOn(page, t("open-menu"));

      // Con puntero: el foco va igualmente a la primera entrada (APG), y solo ella queda resaltada.
      await page.click(t("open-menu"));
      await visible(page, ".z-menu[role=menu]");
      await menuFocus(page, "Rename", "al abrir con el puntero el foco va a la primera entrada");
      await expectCount(page, ".z-menu[role=menu] [data-highlighted]", 1, "una sola entrada resaltada al abrir con el puntero");
      await page.click(".z-menu__item:has-text('Delete')");
      await expectText(page, t("last-action"), "menu:delete");
      await gone(page, ".z-menu[role=menu]");
    },
  },
  {
    name: "ContextMenu: abre con clic derecho en el puntero, teclado y Escape",
    async run({ open, shot }) {
      const page = await open("overlays");
      // La zona puede quedar bajo el pliegue según la escala tipográfica: se trae a la vista antes de medirla.
      await page.locator(t("context-area")).scrollIntoViewIfNeeded();
      const { x, y } = await center(page, t("context-area"));
      await page.mouse.click(x, y, { button: "right" });
      await visible(page, ".z-menu[role=menu]");
      await settled(page);
      const box = await page.locator(".z-menu[role=menu]").boundingBox();
      // El menú nace en el puntero; si no cabe hacia abajo, se desplaza hacia arriba lo justo para caber.
      const atPointer = Math.abs(box.x - x) < 12 && y >= box.y - 12 && y <= box.y + box.height + 12;
      assert(atPointer, `el menú contextual no aparece en el puntero: ${JSON.stringify(box)} vs ${x},${y}`);
      await expectInViewport(page, ".z-menu[role=menu]");
      await shot(page, "overlay-context-menu");
      // Al abrir, el foco va a la primera entrada (patrón APG «menu button»), también con el puntero: mismo
      // comportamiento que el modo sin framework. Antes el binding de React dejaba el foco en el menú y hacía falta
      // una flecha para llegar a «Rename».
      await menuFocus(page, "Rename", "al abrir con el puntero el foco va a la primera entrada");
      await page.keyboard.press("ArrowDown");
      await menuFocus(page, "Duplicate");
      await page.keyboard.press("Enter");
      await gone(page, ".z-menu[role=menu]");
      await expectText(page, t("last-action"), "menu:duplicate");

      await page.mouse.click(x, y, { button: "right" });
      await visible(page, ".z-menu[role=menu]");
      await page.keyboard.press("Escape");
      await gone(page, ".z-menu[role=menu]");

      // Junto al borde inferior derecho el menú se recoloca dentro de la ventana.
      await page.setViewportSize({ width: 1440, height: 420 });
      await page.locator(t("context-area")).scrollIntoViewIfNeeded();
      const again = await center(page, t("context-area"));
      await page.mouse.click(again.x, again.y, { button: "right" });
      await visible(page, ".z-menu[role=menu]");
      await settled(page);
      await expectInViewport(page, ".z-menu[role=menu]");
      await page.keyboard.press("Escape");
      await gone(page, ".z-menu[role=menu]");
    },
  },
  {
    name: "ContextMenu sobre tarjetas de proyecto (pantalla Projects)",
    async run({ open }) {
      const page = await open("projects");
      await page.locator(t("pinned-borealis")).scrollIntoViewIfNeeded();
      await page.click(t("pinned-borealis"), { button: "right" });
      await visible(page, ".z-menu[role=menu]");
      assert((await text(page, ".z-menu__label")).includes("Borealis"), "etiqueta del menú");
      await page.click(".z-menu__item:has-text('Rename')");
      await expectText(page, t("projects-last-action"), "rename:borealis");
    },
  },
  {
    name: "CommandPalette: abre con Ctrl+K, filtra, navega y ejecuta",
    async run({ open, shot }) {
      const page = await open("overlays");
      await page.locator(t("open-menu")).focus();
      await page.keyboard.press("Control+k");
      await visible(page, "dialog.z-palette:modal");
      await focusOn(page, ".z-palette__input", "el foco entra en el buscador");
      await expectInViewport(page, ".z-palette");
      await expectCount(page, ".z-palette__item", 22, "22 comandos sin filtro (pantallas Agenda, Inputs y Workspace)");
      await settled(page);
      await shot(page, "overlay-palette");
      await page.keyboard.type("gal");
      await expectCount(page, ".z-palette__item", 1, "el filtro deja un solo comando");
      await expectText(page, ".z-palette__item[aria-selected=true] .z-palette__item-label", "Gallery");
      const active = await page.evaluate(() => {
        const input = document.querySelector(".z-palette__input");
        return document.getElementById(input.getAttribute("aria-activedescendant"))?.textContent;
      });
      assert(active?.includes("Gallery"), "aria-activedescendant apunta a la opción activa");
      await page.keyboard.press("Enter");
      await gone(page, ".z-palette");
      await visible(page, t("screen-gallery"), "el comando navega a Gallery");

      // Sin resultados y navegación con flechas.
      await page.keyboard.press("Control+k");
      await visible(page, ".z-palette");
      await focusOn(page, ".z-palette__input");
      assert((await page.inputValue(".z-palette__input")) === "", "cada apertura empieza con la búsqueda vacía");
      await page.keyboard.type("zzzz");
      await visible(page, ".z-palette__empty");
      await shot(page, "overlay-palette-empty");
      await page.fill(".z-palette__input", "theme");
      await until(page, () => document.querySelectorAll(".z-palette__item").length === 2, "dos comandos de tema");
      await expectText(page, ".z-palette__item[aria-selected=true] .z-palette__item-label", "Use light theme");
      await page.keyboard.press("ArrowDown");
      await expectText(
        page,
        ".z-palette__item[aria-selected=true] .z-palette__item-label",
        "Use dark theme",
        "flecha abajo mueve la selección",
      );
      await page.keyboard.press("ArrowUp");
      await expectText(page, ".z-palette__item[aria-selected=true] .z-palette__item-label", "Use light theme", "flecha arriba vuelve");
      await page.keyboard.press("Enter");
      await gone(page, ".z-palette");
      await until(page, () => document.documentElement.dataset.theme === "light", "el comando cambia el tema a claro");

      // Comando deshabilitado: no se ejecuta ni cierra.
      await page.keyboard.press("Control+k");
      await focusOn(page, ".z-palette__input");
      await page.keyboard.type("Open Ember");
      await expectCount(page, ".z-palette__item", 1, "queda el comando deshabilitado");
      await expectAttr(page, ".z-palette__item", "aria-disabled", "true");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      assert(await page.isVisible(".z-palette"), "un comando deshabilitado no debe cerrar la paleta");
      // Clic con puntero.
      await page.fill(".z-palette__input", "Overlays");
      await expectCount(page, ".z-palette__item", 1);
      await page.click(".z-palette__item:has-text('Overlays')");
      await gone(page, ".z-palette");
      await visible(page, t("screen-overlays"));

      // Abierta desde un botón: Escape devuelve el foco al botón.
      await page.click(t("open-palette-button"));
      await visible(page, ".z-palette");
      await expectFocusTrap(page, ".z-palette", 3);
      await page.keyboard.press("Escape");
      await gone(page, ".z-palette");
      await focusOn(page, t("open-palette-button"), "el foco vuelve al botón que abrió la paleta");
    },
  },
  {
    name: "Toast: aparece, se apila, acción, cierre manual y cierre automático",
    async run({ open, shot }) {
      const page = await open("overlays");
      await page.click(t("toast-danger"));
      await visible(page, ".z-toast[data-intent=danger]");
      assert((await text(page, ".z-toast[data-intent=danger] .z-toast__title")) === "Upload failed", "título del aviso");
      await page.click(t("toast-action"));
      await visible(page, ".z-toast[data-intent=warning]");
      await until(page, () => document.querySelectorAll(".z-toast").length === 2, "dos avisos apilados");
      await expectInViewport(page, ".z-toast[data-intent=danger]");
      await expectInViewport(page, ".z-toast[data-intent=warning]");
      await settled(page);
      const overlap = await page.evaluate(() => {
        const [a, b] = [...document.querySelectorAll(".z-toast")].map((e) => e.getBoundingClientRect());
        return !(a.bottom <= b.top + 1 || b.bottom <= a.top + 1);
      });
      assert(!overlap, "los avisos se solapan");
      await shot(page, "overlay-toasts");
      await page.click(".z-toast[data-intent=warning] .z-toast__action");
      await expectText(page, t("last-action"), "toast:undo");
      await gone(page, ".z-toast[data-intent=warning]", "la acción cierra su aviso");
      await page.click(".z-toast[data-intent=danger] .z-toast__close");
      await gone(page, ".z-toast[data-intent=danger]", "el botón de cierre retira el aviso");

      // Cierre automático (5 s por defecto).
      await page.click(t("toast-success"));
      await visible(page, ".z-toast[data-intent=success]");
      await page.mouse.move(700, 300);
      await page.waitForSelector(".z-toast", { state: "detached", timeout: 15000 }).catch(() => {
        throw new Error("el aviso no se cerró solo tras su duración (5 s)");
      });

      // dismissAll.
      await page.click(t("toast-danger"));
      await page.click(t("toast-danger"));
      await until(page, () => document.querySelectorAll(".z-toast").length === 2, "dos avisos");
      await page.click(t("toast-clear"));
      await until(page, () => document.querySelectorAll(".z-toast").length === 0, "dismissAll retira todos");

      // F8 lleva el foco a la región de avisos.
      await page.click(t("toast-danger"));
      await visible(page, ".z-toast");
      await page.keyboard.press("F8");
      await focusInside(page, ".z-toast-viewport", "F8 enfoca la región de avisos");
    },
  },

  // ───────────────────────────── Navegación ─────────────────────────────
  {
    name: "Tabs: flechas, Inicio/Fin y pestaña deshabilitada",
    async run({ open, shot }) {
      const page = await open("navigation");
      const tab = (name) => `${t("tabs")} [role=tab]:has-text("${name}")`;
      await page.focus(tab("Summary"));
      await page.keyboard.press("ArrowRight");
      await focusOn(page, tab("Activity"));
      await visible(page, t("tab-panel-activity"));
      await expectAttr(page, tab("Activity"), "aria-selected", "true");
      await gone(page, t("tab-panel-summary"), "el panel anterior se retira");
      await page.keyboard.press("End");
      await focusOn(page, tab("Members"), "End va a la última pestaña habilitada");
      await visible(page, t("tab-panel-members"));
      await page.keyboard.press("ArrowRight");
      await focusOn(page, tab("Summary"), "la navegación da la vuelta saltando la deshabilitada");
      await page.keyboard.press("Home");
      await focusOn(page, tab("Summary"));
      await page.click(tab("Activity"));
      await visible(page, t("tab-panel-activity"));
      const controls = await page.evaluate(
        (s) => {
          const el = document.querySelector(s);
          const panel = document.getElementById(el.getAttribute("aria-controls"));
          return panel?.getAttribute("role");
        },
        `${t("tabs")} [role=tab][aria-selected=true]`,
      );
      assert(controls === "tabpanel", "aria-controls apunta a un tabpanel");
      // SegmentedControl con flechas.
      // SegmentedControl.
      await page.click('button:has-text("List")');
      await expectText(page, t("view-state"), "list");
      await page.keyboard.press("ArrowLeft");
      await poll(
        () => page.evaluate(() => document.activeElement?.textContent === "Grid"),
        "flecha izquierda mueve el foco al segmento anterior",
      );
      await page.keyboard.press("Enter");
      await expectText(page, t("view-state"), "grid", "Enter elige el segmento enfocado");
      await shot(page, "screen-navigation");
    },
  },
  {
    name: "Accordion: Enter/Espacio abren y cierran, flechas mueven el foco",
    async run({ open }) {
      const page = await open("navigation");
      const trigger = (name) => `${t("accordion")} .z-accordion__trigger:has-text("${name}")`;
      const expanded = (name) => page.getAttribute(trigger(name), "aria-expanded");
      assert((await expanded("Design tokens")) === "true", "la primera sección empieza abierta");
      await page.focus(trigger("Design tokens"));
      await page.keyboard.press("ArrowDown");
      await focusOn(page, trigger("Icons"));
      await page.keyboard.press("Enter");
      await expectAttr(page, trigger("Icons"), "aria-expanded", "true", "Enter abre Icons");
      await expectAttr(page, trigger("Design tokens"), "aria-expanded", "false", "modo single: la anterior se cierra");
      await visible(page, `${t("accordion")} .z-accordion__content[data-state=open]`);
      // El alto se anima al abrir: se mide cuando la animación ha terminado.
      await settled(page);
      await poll(
        async () => (await page.locator(`${t("accordion")} .z-accordion__content[data-state=open]`).boundingBox()).height > 20,
        "el contenido abierto tiene alto",
      );
      await page.keyboard.press("End");
      await focusOn(page, trigger("Layouts"));
      await page.keyboard.press("Space");
      await expectAttr(page, trigger("Layouts"), "aria-expanded", "true", "Espacio abre Layouts");
      await page.keyboard.press("Space");
      await expectAttr(page, trigger("Layouts"), "aria-expanded", "false", "Espacio cierra (collapsible)");
      await page.keyboard.press("Home");
      await focusOn(page, trigger("Design tokens"));
    },
  },
  {
    name: "Tree: flechas, expandir/contraer, seleccionar y foco itinerante",
    async run({ open }) {
      const page = await open("navigation");
      const item = (name) => `${t("tree")} [role=treeitem]:has(> .z-tree__row .z-tree__label:text-is("${name}"))`;
      const tabStops = await page.locator(`${t("tree")} [role=treeitem][tabindex="0"]`).count();
      assert(tabStops === 1, `debe haber una sola parada de tabulador, hay ${tabStops}`);
      await page.focus(item("index.ts")); // seleccionado inicial
      await page.keyboard.press("Home");
      await focusOn(page, item("src"));
      await page.keyboard.press("ArrowDown");
      await focusOn(page, item("components"));
      await page.keyboard.press("ArrowRight");
      await expectAttr(page, item("components"), "aria-expanded", "true", "flecha derecha expande");
      await page.keyboard.press("ArrowRight");
      await focusOn(page, item("Button.tsx"), "segunda flecha derecha entra al primer hijo");
      await page.keyboard.press("Enter");
      await expectText(page, t("tree-selected"), "button");
      await expectAttr(page, item("Button.tsx"), "aria-selected", "true");
      await page.keyboard.press("ArrowLeft");
      await focusOn(page, item("components"), "flecha izquierda sube al padre");
      await page.keyboard.press("ArrowLeft");
      await expectAttr(page, item("components"), "aria-expanded", "false", "flecha izquierda contrae");
      await page.keyboard.press("End");
      await focusOn(page, item("README.md"));
      await page.keyboard.press("Enter");
      await page.waitForTimeout(250);
      assert((await text(page, t("tree-selected"))) === "button", "un nodo deshabilitado no se selecciona");
      // Puntero.
      await page.click(`${item("package.json")} > .z-tree__row`);
      await expectText(page, t("tree-selected"), "package");
    },
  },

  // ───────────────────────────── Carousel ─────────────────────────────
  {
    name: "Carousel css: flechas, teclado, bucle y arrastre",
    async run({ open, shot }) {
      const page = await open("gallery");
      const root = t("carousel-css");
      const index = t("carousel-css-index");
      await until(page, (s) => document.querySelector(s)?.dataset.mode === "css", "modo css", root);
      const centered = () =>
        page.evaluate((s) => {
          const el = document.querySelector(`${s} .z-carousel__slide[data-active]`);
          const vp = document.querySelector(`${s} .z-carousel__viewport`);
          if (!el || !vp) return null;
          const a = el.getBoundingClientRect();
          const b = vp.getBoundingClientRect();
          return Math.abs(a.left + a.width / 2 - (b.left + b.width / 2));
        }, root);
      const atRest = (message) =>
        poll(
          async () => {
            const d = await centered();
            return d !== null && d < 2;
          },
          message,
          15000,
        );
      await atRest("el slide activo queda centrado al cargar");
      await shot(page, "screen-gallery");

      await page.click(`${root} .z-carousel__arrow[aria-label="Next slide"]`);
      await expectText(page, index, "1");
      await until(
        page,
        (s) => document.querySelector(`${s} .z-carousel__live`)?.textContent === "Slide 2 of 6",
        "anuncio para lectores de pantalla",
        root,
      );
      await page.keyboard.press("ArrowRight"); // foco en la flecha
      await expectText(page, index, "2");
      await page.keyboard.press("ArrowLeft");
      await expectText(page, index, "1");
      await page.keyboard.press("End");
      await expectText(page, index, "5");
      await page.keyboard.press("ArrowRight");
      await expectText(page, index, "0"); // bucle
      await page.click(`${root} .z-carousel__arrow[aria-label="Previous slide"]`);
      await expectText(page, index, "5"); // bucle hacia atrás
      await page.keyboard.press("Home");
      await expectText(page, index, "0");
      await atRest("tras navegar, el slide activo queda centrado");
      assert((await text(page, `${root} .z-carousel__counter-current`)) === "01", "contador");

      // Arrastre con puntero: 340 px a la izquierda avanza al menos un slide.
      const { x, y } = await center(page, `${root} .z-carousel__viewport`);
      await drag(page, { x: x + 100, y }, { x: x - 240, y });
      await until(page, (s) => document.querySelector(s)?.textContent !== "0", "el arrastre cambia de slide", index);
      const after = Number(await text(page, index));
      assert(after >= 1 && after <= 3, `índice tras arrastrar: ${after}`);
      assert((await text(page, t("carousel-css-opened"))) === "none", "el arrastre no debe activar el botón del slide");
      await atRest("tras el arrastre la tira se ajusta al slide más cercano");
      // Arrastre a la derecha vuelve.
      await drag(page, { x: x - 100, y }, { x: x + 260, y });
      await until(page, ([s, a]) => Number(document.querySelector(s)?.textContent) !== a, "arrastre inverso", [index, after]);
      await atRest("reposo tras el arrastre inverso");

      // Clic en el botón del slide activo funciona; clic en un slide lateral lo centra.
      const current = await text(page, index);
      await page.click(`${root} .z-carousel__slide[data-active] button`);
      await until(
        page,
        (s) => document.querySelector(s)?.textContent !== "none",
        "el botón del slide activo responde",
        t("carousel-css-opened"),
      );
      // Si el slide aún se asienta, Playwright reintenta el clic desplazando la página (Firefox): la tira se trae de vuelta y se vuelve a medir.
      await page.locator(`${root} .z-carousel__viewport`).scrollIntoViewIfNeeded();
      const strip = await center(page, `${root} .z-carousel__viewport`);
      await page.mouse.click(strip.x + 260, strip.y - 40);
      await until(page, ([s, c]) => document.querySelector(s)?.textContent !== c, "clic en un slide lateral lo centra", [index, current]);
      await atRest("reposo tras centrar un slide lateral");

      const clones = await page.evaluate(
        (s) => [...document.querySelectorAll(`${s} .z-carousel__slide[aria-hidden=true]`)].every((el) => el.inert),
        root,
      );
      assert(clones, "las réplicas del bucle deben ser inertes");
      await shot(page, "carousel-css-after");
    },
  },
  {
    name: "Carousel plano sin bucle: límites y teclado",
    async run({ open }) {
      const page = await open("gallery");
      const root = t("carousel-flat");
      const index = t("carousel-flat-index");
      await page.locator(root).scrollIntoViewIfNeeded();
      await until(page, (s) => document.querySelector(s)?.dataset.mode === "flat", "modo flat", root);
      const prev = `${root} .z-carousel__arrow[aria-label="Previous slide"]`;
      const next = `${root} .z-carousel__arrow[aria-label="Next slide"]`;
      assert(await page.isDisabled(prev), "sin bucle, anterior deshabilitado en el primero");
      await page.click(next);
      await expectText(page, index, "1");
      assert(!(await page.isDisabled(prev)), "anterior se habilita");
      await page.keyboard.press("End");
      await expectText(page, index, "5");
      assert(await page.isDisabled(next), "siguiente deshabilitado en el último");
      const clones = await page.locator(`${root} .z-carousel__slide[aria-hidden=true]`).count();
      assert(clones === 0, "sin bucle no hay réplicas");
    },
  },
  {
    name: "Carousel gl: contexto WebGL2, dibujo y navegación",
    async run({ open, shot, Unverifiable, note, browserName }) {
      const page = await open("gallery");
      const root = t("carousel-gl");
      await page.locator(root).scrollIntoViewIfNeeded();
      const support = await page.evaluate((useDebugInfo) => {
        const gl = document.createElement("canvas").getContext("webgl2");
        if (!gl) return null;
        // Firefox avisa por consola de que WEBGL_debug_renderer_info está obsoleta: ahí basta con RENDERER.
        const info = useDebugInfo ? gl.getExtension("WEBGL_debug_renderer_info") : null;
        return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || "webgl2";
      }, browserName !== "firefox");
      // En Chrome el WebGL2 sin GPU depende de los flags de SwiftShader del runner; Firefox y WebKit usan su propio rasterizador por software.
      if (!support)
        throw new Unverifiable(
          `${browserName} sin interfaz no ofrece WebGL2 en esta máquina: el modo gl no se puede comprobar (el carrusel cae a modo css).`,
        );
      note(`WebGL2: ${support}`);
      await until(page, (s) => document.querySelector(s)?.dataset.mode === "gl", "el carrusel con rasterize entra en modo gl", root, 15000);
      const state = await page.evaluate((s) => {
        const canvas = document.querySelector(`${s} canvas.z-carousel__canvas`);
        const gl = canvas.getContext("webgl2");
        return {
          same: !!gl,
          lost: gl?.isContextLost(),
          error: gl?.getError(),
          w: canvas.width,
          h: canvas.height,
          visible: getComputedStyle(canvas).visibility,
        };
      }, root);
      assert(state.same && !state.lost, "contexto WebGL2 perdido o ausente");
      assert(state.error === 0, `gl.getError() = ${state.error}`);
      assert(state.w > 100 && state.h > 100 && state.visible === "visible", `lienzo sin tamaño o no visible: ${JSON.stringify(state)}`);
      await page.waitForTimeout(600);
      await shot(page, "carousel-gl");
      // El lienzo pinta algo en las zonas laterales: se compara la captura del lienzo con y sin él.
      const painted = await page.evaluate(async (s) => {
        const canvas = document.querySelector(`${s} canvas.z-carousel__canvas`);
        // Sin preserveDrawingBuffer el lienzo solo se puede leer en el mismo frame en que se dibuja:
        // se lanza una animación y se muestrea dentro de requestAnimationFrame, tras el dibujo del motor.
        const sample = () => {
          const copy = document.createElement("canvas");
          copy.width = canvas.width;
          copy.height = canvas.height;
          const ctx = copy.getContext("2d");
          ctx.drawImage(canvas, 0, 0);
          const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
          let n = 0;
          for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 8) n++;
          return n;
        };
        canvas.closest(".z-carousel").querySelector('.z-carousel__arrow[aria-label="Next slide"]').click();
        let best = 0;
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          best = Math.max(best, sample());
        }
        return best;
      }, root);
      note(`muestras del lienzo con contenido durante la animación: ${painted}`);
      assert(painted > 0, "el lienzo WebGL no dibujó ningún píxel durante la animación");
      await expectText(page, t("carousel-gl-index"), "1");
      await page.focus(`${root} .z-carousel__arrow[aria-label="Next slide"]`);
      await page.keyboard.press("ArrowRight");
      await expectText(page, t("carousel-gl-index"), "2");
      const { x, y } = await center(page, `${root} .z-carousel__viewport`);
      await drag(page, { x: x + 100, y }, { x: x - 260, y });
      await until(page, (s) => document.querySelector(s)?.textContent !== "2", "arrastre en modo gl", t("carousel-gl-index"));
      await page.waitForTimeout(1200);
      const after = await page.evaluate((s) => {
        const gl = document.querySelector(`${s} canvas`).getContext("webgl2");
        return { error: gl.getError(), lost: gl.isContextLost(), mode: document.querySelector(s).dataset.mode };
      }, root);
      assert(after.error === 0 && !after.lost && after.mode === "gl", `estado WebGL tras interactuar: ${JSON.stringify(after)}`);
      await shot(page, "carousel-gl-after");
    },
  },
  {
    name: "Carousel con movimiento reducido: sin lente y navegación inmediata",
    async run({ open }) {
      const page = await open("gallery", { reducedMotion: "reduce" });
      const root = t("carousel-css");
      await until(page, (s) => document.querySelector(s)?.dataset.mode === "flat", "con prefers-reduced-motion el modo es flat", root);
      await page.click(`${root} .z-carousel__arrow[aria-label="Next slide"]`);
      await expectText(page, t("carousel-css-index"), "1");
    },
  },

  // ───────────────────────────── Shell ─────────────────────────────
  {
    name: "Shell a 1440 px: sidebar e inspector acoplados",
    async run({ open, shot }) {
      const page = await open("overview", { width: 1440 });
      await visible(page, ".z-shell__side[data-mode=docked]");
      await visible(page, ".z-shell__inspector[data-mode=docked]");
      assert((await page.locator(".z-shell__scrim").count()) === 0, "no debe haber velo con paneles acoplados");
      assert(!(await page.evaluate(() => document.querySelector(".z-shell__main").inert)), "el área principal no debe estar inerte");
      const boxes = await page.evaluate(() =>
        Object.fromEntries(
          [".z-titlebar", ".z-rail", ".z-shell__side", ".z-shell__main", ".z-shell__inspector"].map((s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return [s, { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }];
          }),
        ),
      );
      assert(
        boxes[".z-rail"].r <= boxes[".z-shell__side"].l &&
          boxes[".z-shell__side"].r <= boxes[".z-shell__main"].l &&
          boxes[".z-shell__main"].r <= boxes[".z-shell__inspector"].l,
        `zonas solapadas: ${JSON.stringify(boxes)}`,
      );
      assert(
        boxes[".z-shell__side"].r - boxes[".z-shell__side"].l === 224 &&
          boxes[".z-shell__inspector"].r - boxes[".z-shell__inspector"].l === 400,
        `anchos de panel fuera de token: ${JSON.stringify(boxes)}`,
      );
      assert(
        boxes[".z-titlebar"].b <= boxes[".z-rail"].t && boxes[".z-shell__inspector"].r <= 1440 && boxes[".z-shell__main"].b <= 900,
        `maquetación del shell: ${JSON.stringify(boxes)}`,
      );
      await shot(page, "shell-1440");
      // Los botones de la barra de título pliegan los paneles acoplados.
      await page.click(t("toggle-sidebar"));
      await gone(page, ".z-shell__side");
      await page.click(t("toggle-inspector"));
      await gone(page, ".z-shell__inspector");
      await shot(page, "shell-1440-collapsed");
      await page.click(t("toggle-sidebar"));
      await visible(page, ".z-shell__side[data-mode=docked]");
      // Secciones de la sidebar plegables.
      const fold = '.z-sidebar__fold:has-text("Projects")';
      await page.click(fold);
      await expectAttr(page, fold, "aria-expanded", "false", "la sección se pliega");
      await poll(async () => !(await page.isVisible('.z-navlink:has-text("Borealis")')), "el contenido plegado se oculta");
      await page.focus(fold);
      await page.keyboard.press("Enter");
      await visible(page, '.z-navlink:has-text("Borealis")');
      // Rail y enlaces de navegación.
      await page.click(t("rail-navigation"));
      await visible(page, t("screen-navigation"));
      await expectAttr(page, t("rail-navigation"), "aria-current", "page", "aria-current en el rail");
      await page.click('.z-shell__side .z-navlink:has-text("Gallery")');
      await visible(page, t("screen-gallery"));
      await expectAttr(page, '.z-shell__side .z-navlink:has-text("Gallery")', "aria-current", "page", "aria-current en la sidebar");
    },
  },
  {
    name: "Shell a 1000 px: inspector en cajón; Escape y velo cierran",
    async run({ open, shot }) {
      const page = await open("overview", { width: 1000 });
      await visible(page, ".z-shell__side[data-mode=docked]", "la sidebar sigue acoplada a 1000 px");
      await expectCount(page, ".z-shell__inspector", 0, "a 1000 px el inspector no ocupa sitio hasta que se abre");
      await expectCount(page, ".z-shell__scrim", 0, "sin cajón abierto no hay velo");
      await shot(page, "shell-1000");
      await page.click(t("toggle-inspector"));
      await visible(page, ".z-shell__inspector.z-shell__drawer[data-mode=overlay][role=dialog]");
      await visible(page, ".z-shell__scrim");
      await until(
        page,
        () => document.querySelector(".z-shell__main").inert === true,
        "con el cajón abierto el área principal queda inerte",
      );
      assert(
        await page.evaluate(() => document.querySelector(".z-shell__rail").inert && document.querySelector(".z-shell__side").inert),
        "con el cajón abierto, el rail y la sidebar acoplada (bajo el velo) también quedan inertes",
      );
      await focusInside(page, ".z-shell__inspector", "el foco entra en el cajón");
      await expectInViewport(page, ".z-shell__inspector");
      await expectOnTop(page, ".z-shell__inspector");
      const box = await page.locator(".z-shell__inspector").boundingBox();
      assert(Math.abs(box.x + box.width - (1000 - 12)) < 2, `el cajón del inspector no está a la derecha: ${JSON.stringify(box)}`);
      await shot(page, "shell-1000-inspector");
      await page.keyboard.press("Escape");
      await gone(page, ".z-shell__inspector");
      await gone(page, ".z-shell__scrim");
      await focusOn(page, t("toggle-inspector"), "al cerrar, el foco vuelve al botón que abrió el cajón");
      assert(
        await page.evaluate(() => !document.querySelector(".z-shell__rail").inert && !document.querySelector(".z-shell__side").inert),
        "al cerrar el cajón, rail y sidebar vuelven a estar activos",
      );
      await until(page, () => !document.querySelector(".z-shell__main").inert, "el área principal deja de estar inerte");

      await page.click(t("toggle-inspector"));
      await visible(page, ".z-shell__scrim");
      await page.mouse.click(400, 500); // sobre el velo
      await gone(page, ".z-shell__inspector", "el clic en el velo cierra el cajón");

      await page.click(t("toggle-inspector"));
      await visible(page, ".z-shell__inspector");
      await page.click(t("close-inspector"));
      await gone(page, ".z-shell__inspector");
    },
  },
  {
    name: "Shell a 700 px: sidebar e inspector en cajón",
    async run({ open, shot }) {
      const page = await open("overview", { width: 700 });
      await expectCount(page, ".z-shell__side, .z-shell__inspector", 0, "a 700 px los paneles empiezan cerrados");
      await expectCount(page, ".z-shell__scrim", 0, "sin cajón no hay velo");
      await shot(page, "shell-700");
      await page.click(t("toggle-sidebar"));
      await visible(page, ".z-shell__side.z-shell__drawer[data-mode=overlay]");
      await visible(page, ".z-shell__scrim");
      await focusInside(page, ".z-shell__side");
      await expectOnTop(page, ".z-shell__side");
      await shot(page, "shell-700-sidebar");
      // Tab dentro del cajón no escapa al contenido inerte.
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
        const where = await page.evaluate(() => {
          const a = document.activeElement;
          return a?.closest(".z-shell__main") ? "el área principal" : a?.closest(".z-rail") ? "el rail" : "ok";
        });
        assert(where === "ok", `con el cajón abierto (aria-modal) el foco llegó a ${where}`);
      }
      await page.keyboard.press("Escape");
      await gone(page, ".z-shell__side");
      // Elegir un destino en el cajón navega y lo cierra.
      await page.click(t("toggle-sidebar"));
      await page.click('.z-shell__side .z-navlink:has-text("Navigation")');
      await visible(page, t("screen-navigation"));
      await gone(page, ".z-shell__side", "navegar desde el cajón lo cierra");

      await page.click(t("toggle-inspector"));
      await visible(page, ".z-shell__inspector.z-shell__drawer");
      await expectInViewport(page, ".z-shell__inspector");
      await shot(page, "shell-700-inspector");
      // Abrir la sidebar con el inspector abierto: solo queda un cajón.
      await page.click(t("toggle-sidebar"));
      await visible(page, ".z-shell__side.z-shell__drawer");
      await expectCount(page, ".z-shell__drawer", 1, "no quedan dos cajones abiertos a la vez");
      await settled(page);
      const scrim = await page.locator(".z-shell__scrim").boundingBox();
      await page.mouse.click(scrim.x + scrim.width - 30, scrim.y + scrim.height / 2);
      await gone(page, ".z-shell__drawer", "el velo cierra el cajón");
    },
  },
  {
    name: "Shell: cambia de modo al redimensionar la ventana",
    async run({ open }) {
      const page = await open("overview", { width: 1440 });
      await visible(page, ".z-shell__inspector[data-mode=docked]");
      await page.setViewportSize({ width: 1000, height: 900 });
      await gone(page, ".z-shell__inspector", "al estrechar, el inspector deja de estar acoplado");
      await visible(page, ".z-shell__side[data-mode=docked]");
      await page.setViewportSize({ width: 700, height: 900 });
      await gone(page, ".z-shell__side", "al estrechar más, la sidebar deja de estar acoplada");
      assert((await page.locator(".z-shell__scrim").count()) === 0, "estrechar la ventana no debe dejar un velo");
      await page.setViewportSize({ width: 1440, height: 900 });
      await visible(page, ".z-shell__side[data-mode=docked]");
      await visible(page, ".z-shell__inspector[data-mode=docked]");
    },
  },
  {
    name: "ResizeHandle: la sidebar acoplada se redimensiona con arrastre, teclado y doble clic",
    async run({ open, shot }) {
      const page = await open("overview");
      const handle = ".z-shell__side > .z-resize";
      const width = async () => Math.round((await page.locator(".z-shell__side").boundingBox()).width);
      const expectWidth = (value, message) => poll(async () => (await width()) === value, `${message}: ancho ${value}`);
      await visible(page, handle);
      assert((await width()) === 224, `ancho inicial ${await width()}`);
      assert(
        (await page.getAttribute(handle, "role")) === "separator" && (await page.getAttribute(handle, "aria-orientation")) === "vertical",
        "el tirador es un separador vertical",
      );
      const mainBefore = (await page.locator(".z-shell__main").boundingBox()).width;
      const c = await center(page, handle);
      await drag(page, c, { x: c.x + 80, y: c.y });
      await expectWidth(304, "arrastrar 80 px a la derecha");
      await expectAttr(page, handle, "aria-valuenow", "304");
      const mainAfter = (await page.locator(".z-shell__main").boundingBox()).width;
      assert(Math.abs(mainBefore - mainAfter - 80) < 2, `el área principal cede el espacio: ${mainBefore} → ${mainAfter}`);
      await shot(page, "shell-sidebar-resized");
      // Teclado: flechas de 16 px e Inicio vuelve al ancho por defecto.
      await page.focus(handle);
      await page.keyboard.press("ArrowRight");
      await expectWidth(320, "flecha derecha");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await expectWidth(288, "dos flechas a la izquierda");
      await page.keyboard.press("Home");
      await expectWidth(224, "Inicio");
      // Límites.
      const c2 = await center(page, handle);
      await drag(page, c2, { x: c2.x + 400, y: c2.y });
      await expectWidth(360, "máximo");
      const c3 = await center(page, handle);
      await drag(page, c3, { x: c3.x - 400, y: c3.y });
      await expectWidth(180, "mínimo");
      const c4 = await center(page, handle);
      await page.mouse.dblclick(c4.x, c4.y);
      await expectWidth(224, "doble clic vuelve al ancho por defecto");
      // En cajón no hay tirador.
      await page.setViewportSize({ width: 700, height: 900 });
      await page.click(t("toggle-sidebar"));
      await visible(page, ".z-shell__side.z-shell__drawer");
      await expectCount(page, ".z-shell__side .z-resize", 0, "el cajón no muestra tirador");
    },
  },
  {
    name: "Shell en RTL (React): la sidebar pasa al lado derecho y su tirador sigue la dirección; enlace de salto al contenido",
    async run({ open }) {
      const page = await open("overview", { query: "dir=rtl&skip=1" });
      assert(
        await page.evaluate(() => getComputedStyle(document.querySelector(".z-shell")).direction === "rtl"),
        "el Shell no está en RTL",
      );
      const handle = ".z-shell__side > .z-resize";
      await visible(page, handle);
      const side = await page.locator(".z-shell__side").boundingBox();
      const main = await page.locator(".z-shell__main").boundingBox();
      assert(
        side.x > main.x + main.width - 1,
        `en RTL la sidebar queda a la derecha del contenido: ${JSON.stringify({ side: side.x, main: main.x })}`,
      );
      assert((await page.getAttribute(handle, "data-side")) === "end", "el tirador de la sidebar usa el lado lógico end");
      const grip = await page.locator(handle).boundingBox();
      assert(
        Math.abs(grip.x + grip.width / 2 - side.x) < 12,
        `el tirador queda en el borde izquierdo de la sidebar (hacia el contenido): ${JSON.stringify({ grip: grip.x, side: side.x })}`,
      );
      const width = async () => Math.round((await page.locator(".z-shell__side").boundingBox()).width);
      const before = await width();
      // Arrastrar hacia el contenido (a la izquierda) ensancha la sidebar: lo contrario que en LTR.
      const c = await center(page, handle);
      await drag(page, c, { x: c.x - 60, y: c.y });
      await poll(
        async () => (await width()) === before + 60,
        `arrastrar 60 px a la izquierda ensancha la sidebar (${before} → ${before + 60})`,
      );
      await page.focus(handle);
      const now = Number(await page.getAttribute(handle, "aria-valuenow"));
      await page.keyboard.press("ArrowLeft");
      await poll(
        async () => Number(await page.getAttribute(handle, "aria-valuenow")) > now,
        "en RTL la flecha izquierda ensancha la sidebar",
      );
      await page.keyboard.press("ArrowRight");
      await expectAttr(page, handle, "aria-valuenow", String(now), "y la derecha la estrecha");

      // Enlace de salto (WCAG 2.4.1): es la primera parada de tabulación, solo se ve con el foco y lleva al contenido.
      // En una página recién cargada: el tabulador empieza por el principio del documento.
      const fresh = await open("overview", { query: "skip=1" });
      const skip = ".z-shell__skip";
      await visible(fresh, ".z-shell__main");
      const hiddenBox = await fresh.locator(skip).boundingBox();
      assert(hiddenBox.y + hiddenBox.height <= 0, "sin foco, el enlace de salto queda fuera de la ventana");
      await fresh.keyboard.press("Tab");
      await focusOn(fresh, skip, "la primera parada de tabulación es el enlace de salto");
      await settled(page);
      await expectInViewport(fresh, skip);
      assert((await fresh.locator(skip).textContent()).trim() === "Skip to content", "texto del enlace de salto");
      const target = await fresh.getAttribute(skip, "href");
      assert(
        await fresh.evaluate((href) => document.querySelector(href)?.matches(".z-shell__main") ?? false, target),
        `el enlace apunta al área principal (${target})`,
      );
      await fresh.keyboard.press("Enter");
      await fresh.keyboard.press("Tab");
      await poll(
        () =>
          fresh.evaluate(
            () => document.querySelector(".z-shell__main").contains(document.activeElement) && document.activeElement !== document.body,
          ),
        "tras el salto, el tabulador sigue dentro del contenido",
      );
    },
  },
  {
    name: "SplitPane: los divisores se mueven con arrastre y con flechas",
    async run({ open, shot }) {
      const page = await open("editor");
      const rowDivider = ".app-split-main > .z-split__divider";
      const colDivider = ".app-split-inner > .z-split__divider";
      const width = async (id) => (await page.locator(t(id)).boundingBox()).width;
      const height = async (id) => (await page.locator(t(id)).boundingBox()).height;
      await shot(page, "screen-editor");
      const filesBefore = await width("pane-files");
      const editorBefore = await width("pane-editor");
      const total = filesBefore + editorBefore;
      assert(Math.abs(filesBefore / total - 0.25) < 0.01, `reparto inicial 25/75: ${filesBefore}/${editorBefore}`);

      const c = await center(page, rowDivider);
      await drag(page, c, { x: c.x + 150, y: c.y });
      const filesAfter = await width("pane-files");
      assert(
        Math.abs(filesAfter - filesBefore - 150) < 4,
        `arrastrar 150 px debe ensanchar el panel 150 px: ${filesBefore} → ${filesAfter}`,
      );
      assert(Math.abs((await width("pane-editor")) - (editorBefore - 150)) < 4, "el panel vecino cede el mismo espacio");
      assert(
        !(await page.evaluate((s) => document.querySelector(s).hasAttribute("data-dragging"), rowDivider)),
        "data-dragging se limpia al soltar",
      );

      // Teclado: cada flecha mueve un 2 %.
      await page.focus(rowDivider);
      const now = Number(await page.getAttribute(rowDivider, "aria-valuenow"));
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await until(
        page,
        ([s, v]) => Number(document.querySelector(s).getAttribute("aria-valuenow")) === v - 4,
        "dos flechas a la izquierda restan un 4 %",
        [rowDivider, now],
      );
      await page.keyboard.press("ArrowRight");
      await until(
        page,
        ([s, v]) => Number(document.querySelector(s).getAttribute("aria-valuenow")) === v - 2,
        "flecha derecha suma un 2 %",
        [rowDivider, now],
      );
      assert((await page.getAttribute(rowDivider, "aria-orientation")) === "vertical", "orientación del divisor");

      // Límite mínimo: arrastrar muy a la izquierda no baja de la fracción mínima.
      const c2 = await center(page, rowDivider);
      await drag(page, c2, { x: 0, y: c2.y });
      const min = await width("pane-files");
      const whole = min + (await width("pane-editor"));
      assert(min / whole > 0.09 && min / whole < 0.12, `fracción mínima: ${(min / whole).toFixed(3)}`);
      const sizes = (await page.textContent(t("split-sizes"))).split(",").map(Number);
      assert(Math.abs(sizes[0] + sizes[1] - 1) < 0.001, `las fracciones controladas deben sumar 1: ${sizes}`);

      // Divisor horizontal (dirección column).
      const editorH = await height("pane-editor");
      const d = await center(page, colDivider);
      await drag(page, d, { x: d.x, y: d.y - 100 });
      const editorH2 = await height("pane-editor");
      assert(Math.abs(editorH - editorH2 - 100) < 4, `arrastre vertical: ${editorH} → ${editorH2}`);
      await page.focus(colDivider);
      await page.keyboard.press("ArrowDown");
      await until(
        page,
        ([id, h]) => document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect().height > h + 5,
        "flecha abajo agranda el panel superior",
        ["pane-editor", editorH2],
      );
      assert((await page.getAttribute(colDivider, "aria-orientation")) === "horizontal", "orientación del divisor horizontal");

      // Panel con foco.
      await page.click(t("editor-text"));
      await expectAttr(page, `${t("pane-editor")} .z-pane`, "data-focused", "true", "panel con foco marcado");
      await page.click(`${t("pane-files")} .z-tree__row:has-text("main.tsx")`);
      await expectText(page, t("editor-file"), "main.tsx");
      await expectAttr(page, `${t("pane-files")} .z-pane`, "data-focused", "true", "el foco pasa al panel de archivos");
      await shot(page, "screen-editor-resized");
    },
  },
  {
    name: "TabStrip: seleccionar, teclado, cerrar y añadir pestañas",
    async run({ open }) {
      const page = await open("overview");
      const tab = (id) => `.z-tabstrip [role=tab][data-tab-id="${id}"]`;
      const ids = () =>
        page.evaluate(() => [...document.querySelectorAll(".z-tabstrip [role=tab]")].map((el) => el.dataset.tabId).join(","));
      assert((await ids()) === "overview,projects", `pestañas iniciales: ${await ids()}`);
      await page.click(tab("projects"));
      await visible(page, t("screen-projects"));
      await expectAttr(page, tab("projects"), "aria-selected", "true");
      await page.click(".z-tabstrip__add");
      await visible(page, t("screen-overlays"));
      await poll(async () => (await ids()) === "overview,projects,overlays", "tras añadir hay tres pestañas");
      // Teclado: flechas con vuelta, Inicio y Fin.
      await page.focus(tab("overlays"));
      await page.keyboard.press("ArrowRight");
      await visible(page, t("screen-overview"));
      await focusOn(page, tab("overview"), "el foco sigue a la pestaña activa");
      await page.keyboard.press("End");
      await visible(page, t("screen-overlays"));
      await page.keyboard.press("ArrowLeft");
      await visible(page, t("screen-projects"));
      await page.keyboard.press("Home");
      await visible(page, t("screen-overview"));
      const stops = await page.locator(".z-tabstrip [role=tab][tabindex='0']").count();
      assert(stops === 1, `una sola pestaña en el orden de tabulación, hay ${stops}`);
      // Cerrar una pestaña inactiva y luego la activa.
      await page.click(`.z-tabstrip__tab:has(${tab("projects").replace(".z-tabstrip ", "")}) .z-tabstrip__close`);
      await poll(async () => (await ids()) === "overview,overlays", "tras cerrar projects quedan overview y overlays");
      await visible(page, t("screen-overview"), "cerrar una pestaña inactiva no cambia de pantalla");
      await page.click(tab("overlays"));
      await visible(page, t("screen-overlays"));
      await page.click(`.z-tabstrip__tab[data-selected] .z-tabstrip__close`);
      await poll(async () => (await ids()) === "overview", "tras cerrar la activa queda overview");
      await visible(page, t("screen-overview"), "al cerrar la pestaña activa se activa la vecina");
      assert(
        (await page.locator(".z-tabstrip__tab[data-selected] .z-tabstrip__close").count()) === 0,
        "la pestaña no cerrable no muestra botón de cierre",
      );
      // Teclado: Supr cierra la pestaña activa y el foco pasa a la que queda activa; la no cerrable lo ignora.
      await page.focus(tab("overview"));
      await page.keyboard.press("Delete");
      await page.waitForTimeout(150);
      assert((await ids()) === "overview", "Supr no cierra una pestaña no cerrable");
      await page.click(".z-tabstrip__add");
      await visible(page, t("screen-projects"));
      await page.focus(tab("projects"));
      assert((await page.getAttribute(tab("projects"), "aria-keyshortcuts")) === "Delete", "la pestaña cerrable anuncia su atajo");
      await page.keyboard.press("Delete");
      await poll(async () => (await ids()) === "overview", "Supr cierra la pestaña activa");
      await focusOn(page, tab("overview"), "tras cerrar con Supr el foco pasa a la pestaña activa");
      const children = await page.evaluate(
        () =>
          [...document.querySelectorAll(".z-tabstrip__list [role], .z-tabstrip__list button")].filter(
            (el) => el.getAttribute("aria-hidden") !== "true" && !["tab", "presentation"].includes(el.getAttribute("role")),
          ).length,
      );
      assert(children === 0, "dentro del tablist solo hay pestañas expuestas a las tecnologías de apoyo");
      // Muchas pestañas: la tira no empuja las acciones fuera de la barra.
      for (let i = 0; i < 5; i++) await page.click(".z-tabstrip__add");
      await expectCount(page, ".z-tabstrip [role=tab]", 6);
      await page.setViewportSize({ width: 700, height: 900 });
      await page.waitForTimeout(400);
      await expectInViewport(page, t("toggle-inspector"));
      await expectInViewport(page, ".z-tabstrip__add");
      const selectedVisible = () =>
        page.evaluate(() => {
          const el = document.querySelector(".z-tabstrip__tab[data-selected]");
          const list = document.querySelector(".z-tabstrip__list");
          const a = el.getBoundingClientRect();
          const b = list.getBoundingClientRect();
          return a.left >= b.left - 1 && a.right <= b.right + 1;
        });
      await poll(selectedVisible, "la pestaña activa queda visible dentro de la tira");
      // Con la tira desplazada, activar la primera pestaña con el teclado también la trae a la vista.
      await page.focus(".z-tabstrip [role=tab][aria-selected=true]");
      await page.keyboard.press("Home");
      await visible(page, t("screen-overview"));
      await poll(selectedVisible, "tras Inicio, la primera pestaña queda visible");
    },
  },

  // ───────────────────────────── Datos y formularios ─────────────────────────────
  {
    name: "DataTable y formulario: ordenar, filtrar, paginar, seleccionar y validar",
    async run({ open, shot }) {
      const page = await open("projects");
      const names = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('[data-testid="projects-table"] tbody tr td:first-child')]
            .map((td) => td.textContent.trim())
            .join(","),
        );
      assert((await names()) === "Atlas,Borealis,Cobalt,Delta,Ember", `orden inicial: ${await names()}`);
      await shot(page, "screen-projects");
      const header = (name) => `${t("projects-table")} th:has-text("${name}")`;
      await expectAttr(page, header("Project"), "aria-sort", "ascending", "aria-sort inicial");
      await page.click(`${header("Tasks")} button`);
      await expectAttr(page, header("Tasks"), "aria-sort", "ascending", "ordenar por Tasks");
      await poll(async () => (await names()).startsWith("Ember"), "orden ascendente por tareas");
      await page.focus(`${header("Tasks")} button`);
      await page.keyboard.press("Enter");
      await expectAttr(page, header("Tasks"), "aria-sort", "descending", "orden descendente con teclado");
      // Paginación.
      await page.click('.z-pagination button:text-is("2")');
      await expectCount(page, `${t("projects-table")} tbody tr`, 3, "la página 2 tiene 3 filas");
      // Filtro.
      await page.fill('input[aria-label="Filter projects"]', "marta");
      await expectText(page, t("projects-count"), "2 projects");
      await page.fill('input[aria-label="Filter projects"]', "zzz");
      await visible(page, ".z-empty", "estado vacío de la tabla");
      await page.fill('input[aria-label="Filter projects"]', "");
      // Selección de fila → inspector.
      await page.click(`${t("projects-table")} tbody tr:has-text("Cobalt")`);
      await expectText(page, ".z-shell__inspector .z-sidepanel__title", "Cobalt");
      // Validación del formulario.
      await page.locator(t("project-submit")).scrollIntoViewIfNeeded();
      await page.click(t("project-submit"));
      await visible(page, ".z-field__error");
      await expectAttr(page, t("project-name"), "aria-invalid", "true", "el control queda marcado como inválido");
      const describedBy = await page.evaluate((s) => {
        const el = document.querySelector(s);
        return (el.getAttribute("aria-describedby") ?? "")
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent)
          .join("|");
      }, t("project-name"));
      assert(describedBy.includes("Use at least 3 characters."), `aria-describedby no enlaza el error: ${describedBy}`);
      await shot(page, "screen-projects-form");
      await page.fill(t("project-name"), "Nimbus");
      await page.keyboard.press("Enter");
      await visible(page, ".z-toast[data-intent=success]");
      await gone(page, ".z-field__error");
    },
  },

  // ───────────────────────────── Transversales ─────────────────────────────
  {
    name: "Todas las pantallas cargan sin errores de consola (1440 px)",
    async run({ open, shot }) {
      for (const screen of SCREENS) {
        const page = await open(screen);
        await page.waitForTimeout(400);
        if (screen === "overview" || screen === "overlays") await shot(page, `screen-${screen}`);
        // Recorre con Tab para detectar errores al enfocar.
        for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
        const report = await overflowReport(page);
        assert(report.length === 0, `desbordamiento horizontal en ${screen} a 1440 px:\n  ${report.join("\n  ")}`);
      }
    },
  },
  {
    name: "Móvil 390 px: sin desbordamiento horizontal en ninguna pantalla",
    async run({ open, shot }) {
      const failures = [];
      for (const screen of SCREENS) {
        const page = await open(screen, { width: 390, height: 844, hasTouch: true });
        await page.waitForTimeout(400);
        await shot(page, `mobile-${screen}`);
        const report = await overflowReport(page);
        if (report.length) failures.push(`${screen}:\n    ${report.join("\n    ")}`);
        if (screen === "gallery") {
          // En una tira estrecha el slide centrado cabe entero y queda plano (sin deformar por la lente).
          const slide = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="carousel-css"] .z-carousel__slide[data-active]');
            const r = el.getBoundingClientRect();
            const vp = el.closest(".z-carousel__viewport").getBoundingClientRect();
            return {
              stretch: Math.round(Math.abs(r.height - el.offsetHeight)),
              fits: r.left >= vp.left - 1 && r.right <= vp.right + 1,
              width: Math.round(r.width),
              viewport: Math.round(vp.width),
            };
          });
          if (slide.stretch > 2 || !slide.fits)
            failures.push(`gallery: el slide centrado del carrusel se deforma o no cabe en la tira: ${JSON.stringify(slide)}`);
        }
        // Página completa desplazada hasta el final.
        await page.evaluate(() => {
          const p = document.querySelector(".z-page");
          if (p) p.scrollTop = p.scrollHeight;
        });
        await page.waitForTimeout(150);
        await shot(page, `mobile-${screen}-end`);
        const report2 = await overflowReport(page);
        if (report2.length) failures.push(`${screen} (final):\n    ${report2.join("\n    ")}`);
      }
      assert(failures.length === 0, `desbordamiento horizontal a 390 px:\n  ${failures.join("\n  ")}`);
    },
  },
  {
    name: "Móvil 390 px: overlays y cajones caben en la ventana",
    async run({ open, shot }) {
      const page = await open("overlays", { width: 390, height: 844 });
      await page.click(t("open-modal"));
      await visible(page, ".z-modal");
      await expectInViewport(page, ".z-modal");
      await shot(page, "mobile-modal");
      await page.keyboard.press("Escape");
      await gone(page, ".z-modal");
      await page.click(t("open-confirm"));
      await visible(page, ".z-confirm");
      await expectInViewport(page, ".z-confirm");
      await page.keyboard.press("Escape");
      await gone(page, ".z-confirm");
      await page.click(t("open-drawer"));
      await visible(page, ".z-drawer");
      await expectInViewport(page, ".z-drawer");
      await shot(page, "mobile-drawer");
      await page.keyboard.press("Escape");
      await gone(page, ".z-drawer");
      await page.click(t("open-popover"));
      await visible(page, ".z-popover");
      await expectInViewport(page, ".z-popover");
      await page.keyboard.press("Escape");
      await page.click(t("open-menu"));
      await visible(page, ".z-menu[role=menu]");
      await expectInViewport(page, ".z-menu[role=menu]");
      await page.keyboard.press("Escape");
      await gone(page, ".z-menu[role=menu]");
      await page.click(t("open-palette"));
      await visible(page, ".z-palette");
      await expectInViewport(page, ".z-palette");
      await shot(page, "mobile-palette");
      await page.keyboard.press("Escape");
      await gone(page, ".z-palette");
      await page.locator(t("toast-danger")).scrollIntoViewIfNeeded();
      await page.click(t("toast-danger"));
      await visible(page, ".z-toast");
      await expectInViewport(page, ".z-toast");
      await shot(page, "mobile-toast");
      await page.click(".z-toast__close");
      // Cajones del shell.
      await page.click(t("toggle-sidebar"));
      await visible(page, ".z-shell__side.z-shell__drawer");
      await expectInViewport(page, ".z-shell__side");
      await shot(page, "mobile-shell-sidebar");
      await page.keyboard.press("Escape");
      await gone(page, ".z-shell__side");
      await page.click(t("toggle-inspector"));
      await visible(page, ".z-shell__inspector.z-shell__drawer");
      await expectInViewport(page, ".z-shell__inspector");
      await shot(page, "mobile-shell-inspector");
      await page.keyboard.press("Escape");
      await gone(page, ".z-shell__inspector");
    },
  },
  {
    name: "Temas y marcas: las cuatro combinaciones renderizan y difieren",
    async run({ open, shot }) {
      const seen = {};
      for (const brand of ["dazlabs", "zutool"]) {
        for (const theme of ["dark", "light"]) {
          const page = await open("overview", { theme, brand });
          const state = await page.evaluate(() => {
            const cs = getComputedStyle(document.documentElement);
            const probe = (name) => {
              const el = document.createElement("div");
              el.style.color = `var(${name})`;
              document.body.append(el);
              const c = getComputedStyle(el).color;
              el.remove();
              return c;
            };
            return {
              theme: document.documentElement.dataset.theme,
              brand: document.documentElement.dataset.brand,
              canvas: probe("--z-canvas"),
              fg: probe("--z-fg"),
              accent: probe("--z-accent"),
              font: cs.getPropertyValue("--z-font-sans").trim(),
              scheme: cs.colorScheme,
            };
          });
          assert(state.theme === theme && state.brand === brand, `atributos: ${JSON.stringify(state)}`);
          seen[`${brand}-${theme}`] = state;
          await page.waitForTimeout(300);
          await shot(page, `theme-${brand}-${theme}-overview`);
          // Misma combinación con un modal y un menú abiertos (capas portaladas fuera de .z-root).
          await page.click(t("rail-overlays"));
          await visible(page, t("screen-overlays"));
          await page.click(t("open-modal"));
          await visible(page, ".z-modal");
          const modalFg = await page.evaluate(() => getComputedStyle(document.querySelector(".z-modal__title")).color);
          assert(modalFg === state.fg, `el modal (portal) no hereda el color del tema: ${modalFg} vs ${state.fg}`);
          await page.waitForTimeout(250);
          await shot(page, `theme-${brand}-${theme}-modal`);
          await page.keyboard.press("Escape");
          await gone(page, ".z-modal");
          await page.click(t("rail-gallery"));
          await visible(page, t("screen-gallery"));
          await page.waitForTimeout(500);
          await shot(page, `theme-${brand}-${theme}-gallery`);
        }
      }
      for (const brand of ["dazlabs", "zutool"]) {
        assert(seen[`${brand}-dark`].canvas !== seen[`${brand}-light`].canvas, `${brand}: el fondo no cambia entre tema claro y oscuro`);
        assert(seen[`${brand}-dark`].fg !== seen[`${brand}-light`].fg, `${brand}: el color de texto no cambia entre temas`);
      }
      const differs = ["canvas", "accent", "font"].some((k) => seen["dazlabs-dark"][k] !== seen["zutool-dark"][k]);
      assert(
        differs,
        `las marcas dazlabs y zutool no difieren en fondo, acento ni fuente: ${JSON.stringify([seen["dazlabs-dark"], seen["zutool-dark"]])}`,
      );
    },
  },
  {
    name: "Cambio de tema y marca en caliente desde la barra de título",
    async run({ open }) {
      const page = await open("overview");
      const bg = () => page.evaluate(() => getComputedStyle(document.querySelector(".z-shell")).backgroundColor);
      const before = await bg();
      await page.click(t("toggle-theme"));
      await until(page, () => document.documentElement.dataset.theme === "light", "data-theme=light");
      assert((await bg()) !== before, "el fondo del shell cambia con el tema");
      await page.click(t("toggle-brand"));
      await until(page, () => document.documentElement.dataset.brand === "zutool", "data-brand=zutool");
      await expectText(page, t("brand-name"), "zutool");
      await page.click(t("toggle-theme"));
      await until(page, () => document.documentElement.dataset.theme === "dark", "data-theme=dark");
    },
  },

  // ───────────────────────────── Select, Combobox, Calendar, DatePicker, NativeSelect ─────────────────────────────
  // Cada caso recorre los controles de la página y después los mismos dentro de un Modal (pantalla Forms).
  {
    name: "Select: puntero, teclado, grupos y opción deshabilitada, en la página y en un Modal",
    async run({ open, shot }) {
      const page = await open("forms");
      await inPageAndModal(page, async (scope) => {
        const trigger = `${t(`${scope}-select`)} .z-select__control`;
        const value = t(`${scope}-select-value`);
        const list = ".z-listbox [role=listbox]";
        const option = (label) => `${list} [role=option]:has-text("${label}")`;
        const focusedOption = (label, message) =>
          poll(
            () =>
              page.evaluate(
                (l) => document.activeElement?.getAttribute("role") === "option" && document.activeElement.textContent.trim() === l,
                label,
              ),
            message ?? `opción enfocada: ${label}`,
          );

        assert(
          (await page.locator(trigger).evaluate((el) => el.labels?.[0]?.textContent ?? "")).includes("Role"),
          "la etiqueta del Field nombra el control",
        );
        await expectText(page, trigger, "Choose a role", "sin valor muestra el placeholder");
        // Puntero.
        await page.click(trigger);
        await visible(page, list);
        await expectAttr(page, trigger, "aria-expanded", "true");
        await expectOnTop(page, list);
        await expectInViewport(page, list);
        await expectCount(page, `${list} [role=option]`, 5, "cinco opciones, dos de ellas en un grupo");
        assert(
          (await page
            .locator(`${list} [role=group]`)
            .evaluate((g) => document.getElementById(g.getAttribute("aria-labelledby"))?.textContent)) === "Administration",
          "el grupo está etiquetado por su título",
        );
        if (scope === "page") await shot(page, "forms-select-open");
        else await shot(page, "forms-modal-select-open");
        await page.click(option("Editor"));
        await gone(page, list);
        await expectText(page, value, "editor");
        await expectText(page, trigger, "Editor", "el control muestra la etiqueta elegida");
        await focusOn(page, trigger, "al elegir, el foco vuelve al control");
        // Una opción deshabilitada no se elige con el puntero.
        await page.click(trigger);
        await visible(page, list);
        await expectAttr(page, option("Guest (unavailable)"), "aria-disabled", "true");
        await page.locator(option("Guest (unavailable)")).click({ force: true });
        await page.waitForTimeout(150);
        await expectText(page, value, "editor", "la opción deshabilitada no cambia el valor");
        await page.keyboard.press("Escape");
        await gone(page, list);
        await focusOn(page, trigger, "Escape devuelve el foco al control");
        // Teclado: abrir, saltar la opción deshabilitada, elegir.
        await page.keyboard.press("Enter");
        await visible(page, list);
        await focusedOption("Editor", "al abrir con teclado el foco va a la opción elegida");
        await page.keyboard.press("ArrowDown");
        await focusedOption("Admin", "flecha abajo salta la opción deshabilitada");
        await page.keyboard.press("ArrowUp");
        await focusedOption("Editor");
        await page.keyboard.press("ArrowUp");
        await focusedOption("Viewer");
        await page.keyboard.press("End");
        await focusedOption("Owner", "Fin va a la última opción");
        await page.keyboard.press("Enter");
        await gone(page, list);
        await expectText(page, value, "owner");
        await focusOn(page, trigger);
        // Escribir una letra con la lista abierta lleva a la opción que empieza por ella.
        await page.keyboard.press("ArrowDown");
        await visible(page, list);
        await page.keyboard.type("v");
        await focusedOption("Viewer", "búsqueda por letra");
        await page.keyboard.press("Escape");
        await gone(page, list);
        await expectText(page, value, "owner", "Escape no cambia el valor");
        // Clic fuera cierra.
        await page.click(trigger);
        await visible(page, list);
        const box = await page.locator(scope === "modal" ? ".z-modal__title" : ".z-pagehead__title").boundingBox();
        await clickOutside(page, box.x + 4, box.y + 4);
        await gone(page, list, "el clic fuera cierra la lista");
        await expectText(page, value, "owner");
      });
    },
  },
  {
    name: "Combobox: filtrar, teclado, puntero, limpiar y sin resultados, en la página y en un Modal",
    async run({ open, shot }) {
      const page = await open("forms");
      await inPageAndModal(page, async (scope) => {
        const input = `${t(`${scope}-combobox`)} input[role=combobox]`;
        const value = t(`${scope}-combobox-value`);
        const list = ".z-listbox [role=listbox]";
        const option = (label) => `${list} [role=option]:has-text("${label}")`;
        const active = () =>
          page.evaluate((s) => {
            const el = document.querySelector(s);
            const id = el.getAttribute("aria-activedescendant");
            return id ? (document.getElementById(id)?.textContent.trim() ?? null) : null;
          }, input);
        const expectActive = (label, message) => poll(async () => (await active()) === label, message ?? `opción activa: ${label}`);

        assert(
          (await page.locator(input).evaluate((el) => el.labels?.[0]?.textContent ?? "")).includes("Assignee"),
          "la etiqueta del Field nombra el campo",
        );
        // Puntero: el clic abre la lista y el foco se queda en el campo.
        await page.click(input);
        await visible(page, list);
        await expectAttr(page, input, "aria-expanded", "true");
        assert(
          (await page.getAttribute(input, "aria-controls")) === (await page.getAttribute(list, "id")),
          "aria-controls apunta a la lista",
        );
        await focusOn(page, input, "el foco no sale del campo al abrir");
        await expectOnTop(page, ".z-listbox");
        await expectInViewport(page, ".z-listbox");
        await expectCount(page, `${list} [role=option]`, 6);
        if (scope === "page") await shot(page, "forms-combobox-open");
        // Filtro sin acentos ni mayúsculas.
        await page.keyboard.type("ine");
        await expectCount(page, `${list} [role=option]`, 1, "el filtro ignora acentos");
        await expectActive("Inés Vidal", "la primera coincidencia queda activa");
        await page.keyboard.press("Enter");
        await gone(page, ".z-listbox");
        await expectText(page, value, "ines");
        assert((await page.inputValue(input)) === "Inés Vidal", "el campo muestra la etiqueta elegida");
        await focusOn(page, input, "tras elegir, el foco sigue en el campo");
        // Teclado: flecha abre en la selección, salta la deshabilitada y da la vuelta.
        await page.keyboard.press("ArrowDown");
        await visible(page, list);
        await expectActive("Inés Vidal", "al abrir con flecha la opción elegida queda activa");
        await expectAttr(page, option("Inés Vidal"), "aria-selected", "true");
        await page.keyboard.press("ArrowDown");
        await expectActive("Omar Haddad");
        await page.keyboard.press("ArrowDown");
        await expectActive("Noor Rahman", "salta la opción deshabilitada");
        await page.keyboard.press("ArrowDown");
        await expectActive("Marta Ruiz", "da la vuelta al principio");
        await page.keyboard.press("End");
        await expectActive("Noor Rahman");
        await page.keyboard.press("Home");
        await expectActive("Marta Ruiz");
        // Escape cierra solo la lista y no cambia el valor.
        await page.keyboard.press("Escape");
        await gone(page, ".z-listbox");
        await expectText(page, value, "ines");
        if (scope === "modal") assert(await page.isVisible(".z-modal"), "Escape en la lista no cierra el modal");
        // Sin resultados.
        await page.fill(input, "zzz");
        await visible(page, ".z-listbox__empty");
        await expectText(page, ".z-listbox__empty", "No results");
        await page.keyboard.press("Escape");
        await gone(page, ".z-listbox");
        assert((await page.inputValue(input)) === "Inés Vidal", "al cerrar sin elegir vuelve la etiqueta de la selección");
        // Botón de abrir y elección con puntero; la opción deshabilitada no se elige.
        await page.click(`${t(`${scope}-combobox`)} .z-combobox__toggle`);
        await visible(page, list);
        await focusOn(page, input, "el botón de abrir deja el foco en el campo");
        await page.locator(option("Lena Fischer")).click({ force: true });
        await page.waitForTimeout(150);
        await expectText(page, value, "ines", "la opción deshabilitada no cambia el valor");
        await visible(page, list);
        await page.click(option("Ken Adams"));
        await gone(page, ".z-listbox");
        await expectText(page, value, "ken");
        await focusOn(page, input, "elegir con el puntero no quita el foco del campo");
        // Limpiar.
        await page.click(`${t(`${scope}-combobox`)} button[aria-label="Clear selection"]`);
        await expectText(page, value, "none");
        assert((await page.inputValue(input)) === "", "limpiar vacía el campo");
        await focusOn(page, input, "limpiar devuelve el foco al campo");
        // Salir con Tab cierra la lista.
        await page.keyboard.press("ArrowDown");
        await visible(page, list);
        await page.keyboard.press("Tab");
        await gone(page, ".z-listbox", "al perder el foco la lista se cierra");
      });
    },
  },
  {
    name: "NativeSelect: etiqueta, puntero y teclado, en la página y en un Modal",
    async run({ open, shot, note, browserName }) {
      const page = await open("forms");
      await inPageAndModal(page, async (scope) => {
        const select = `select${t(`${scope}-native`)}`;
        const value = t(`${scope}-native-value`);
        assert(
          (await page.locator(select).evaluate((el) => el.labels?.[0]?.textContent ?? "")).includes("Priority"),
          "la etiqueta del Field nombra el control",
        );
        const look = await page.locator(select).evaluate((el) => {
          const cs = getComputedStyle(el);
          const chevron = el.parentElement.querySelector(".z-select__chevron").getBoundingClientRect();
          const box = el.getBoundingClientRect();
          return {
            appearance: cs.appearance || cs.webkitAppearance,
            chevronInside: chevron.width > 0 && chevron.left >= box.left && chevron.right <= box.right + 1,
            text: el.selectedOptions[0]?.textContent,
            height: Math.round(box.height),
          };
        });
        assert(look.appearance === "none", `el select conserva la apariencia del sistema: ${look.appearance}`);
        assert(look.chevronInside, "la flecha propia queda dentro del control");
        assert(look.text === "Choose a priority", `placeholder: ${look.text}`);
        const reference = Math.round((await page.locator(`${t(`${scope}-select`)} .z-select__control`).boundingBox()).height);
        assert(Math.abs(look.height - reference) <= 1, `el select nativo mide ${look.height} px y el Select propio ${reference} px`);
        if (scope === "page") await shot(page, "forms-native");
        // Puntero / API del control: elegir una opción dispara el cambio.
        await page.selectOption(select, "high");
        await expectText(page, value, "high");
        assert(
          await page.locator(`${select} option[value=blocked]`).evaluate((o) => o.disabled),
          "la opción deshabilitada lo está en el control",
        );
        // Teclado: con el foco en el control, las flechas cambian el valor sin abrir la lista del sistema.
        await page.focus(select);
        await page.keyboard.press("ArrowUp");
        const moved = await poll(async () => (await text(page, value)) === "medium", "flecha arriba elige la opción anterior", 2500).catch(
          () => false,
        );
        if (!moved) {
          // Hay motores que abren la lista del sistema con las flechas: no es observable sin interfaz.
          note(`${browserName}: las flechas abren la lista del sistema del select nativo; se comprueba la escritura por letra.`);
          await page.keyboard.press("Escape");
        }
        await page.focus(select);
        await page.keyboard.type("l");
        await poll(
          async () => ["low", "medium", "high"].includes(await text(page, value)),
          "el control sigue con un valor válido tras usar el teclado",
        );
        if (moved) await expectText(page, value, "low", "escribir una letra elige la opción que empieza por ella");
        if (scope === "modal") assert(await page.isVisible(".z-modal"), "el modal sigue abierto");
      });
    },
  },
  {
    name: "Calendar: puntero, teclado, límites, días deshabilitados y rango, en la página y en un Modal",
    async run({ open, shot }) {
      const page = await open("forms");
      await inPageAndModal(page, async (scope) => {
        const root = t(`${scope}-calendar`);
        const value = t(`${scope}-calendar-value`);
        const day = (date) => `${root} .z-calendar__day[data-date="${date}"]`;
        const title = `${root} .z-calendar__title`;
        const focusedDate = (date, message) => poll(async () => (await activeDate(page)) === date, message ?? `foco en ${date}`);

        await page.locator(root).scrollIntoViewIfNeeded();
        await expectText(page, title, "March 2026");
        assert(
          (await page
            .locator(`${root} [role=grid]`)
            .evaluate((g) => document.getElementById(g.getAttribute("aria-labelledby"))?.textContent)) === "March 2026",
          "la rejilla se nombra con el mes",
        );
        await expectCount(page, `${root} .z-calendar__day[tabindex="0"]`, 1, "un solo día en el orden de tabulación");
        await expectAttr(
          page,
          `${root} .z-calendar__day[tabindex="0"]`,
          "data-date",
          "2026-03-10",
          "el día elegido es el que recibe el tabulador",
        );
        assert(
          (await page.getAttribute(day("2026-03-10"), "aria-label")) === "Tuesday, March 10, 2026",
          "cada día se anuncia con la fecha completa",
        );
        const firstColumn = await page.locator(`${root} th`).first().getAttribute("abbr");
        assert(firstColumn === "Monday", `la semana empieza en ${firstColumn}`);
        if (scope === "page") await shot(page, "forms-calendar");
        // Puntero.
        await page.click(day("2026-03-12"));
        await expectText(page, value, "2026-03-12");
        await expectAttr(page, `${root} td:has(> [data-date="2026-03-12"])`, "aria-selected", "true");
        // Deshabilitados: por función, por mínimo y por máximo.
        for (const date of ["2026-03-17", "2026-03-02"]) {
          await expectAttr(page, day(date), "aria-disabled", "true", `${date} deshabilitado`);
          await page.locator(day(date)).click({ force: true });
        }
        await page.waitForTimeout(100);
        await expectText(page, value, "2026-03-12", "un día deshabilitado no se elige");
        assert(
          await page.isDisabled(`${root} .z-calendar__nav[aria-label="Previous month"]`),
          "no se puede retroceder más allá del mínimo",
        );
        // Teclado. El foco se pone a mano: WebKit no enfoca un botón al hacer clic en él.
        await page.focus(day("2026-03-12"));
        await page.keyboard.press("ArrowRight");
        await focusedDate("2026-03-13");
        await page.keyboard.press("ArrowDown");
        await focusedDate("2026-03-20");
        await page.keyboard.press("Home");
        await focusedDate("2026-03-16", "Inicio va al primer día de la semana");
        await page.keyboard.press("End");
        await focusedDate("2026-03-22", "Fin va al último día de la semana");
        await page.keyboard.press("Enter");
        await expectText(page, value, "2026-03-22", "Enter elige el día enfocado");
        await page.keyboard.press("PageDown");
        await focusedDate("2026-04-20", "AvPág cambia de mes y se queda en el máximo");
        await expectText(page, title, "April 2026");
        assert(await page.isDisabled(`${root} .z-calendar__nav[aria-label="Next month"]`), "no se puede avanzar más allá del máximo");
        await page.keyboard.press("Space");
        await expectText(page, value, "2026-04-20", "Espacio elige el día enfocado");
        await page.keyboard.press("PageUp");
        await focusedDate("2026-03-20");
        await expectText(page, title, "March 2026");
        for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowUp");
        await focusedDate("2026-03-03", "las flechas no pasan del mínimo");
        await expectCount(page, `${root} .z-calendar__day[tabindex="0"]`, 1, "sigue habiendo un solo día tabulable");
        // Botones de mes y día de un mes vecino.
        await page.click(`${root} .z-calendar__nav[aria-label="Next month"]`);
        await expectText(page, title, "April 2026");
        await page.click(`${root} .z-calendar__nav[aria-label="Previous month"]`);
        await expectText(page, title, "March 2026");
        await page.click(day("2026-04-02"));
        await expectText(page, value, "2026-04-02", "un día del mes vecino se puede elegir");
        await expectText(page, title, "April 2026", "y el calendario pasa a su mes");

        // ── Rango ──
        const range = t(`${scope}-calendar-range`);
        const rangeValue = t(`${scope}-calendar-range-value`);
        const rday = (date) => `${range} .z-calendar__day[data-date="${date}"]`;
        const part = (date) => page.locator(`${range} td:has(> [data-date="${date}"])`).getAttribute("data-range");
        await page.locator(range).scrollIntoViewIfNeeded();
        await expectAttr(page, `${range} [role=grid]`, "aria-multiselectable", "true");
        await page.click(rday("2026-03-05"));
        await expectText(page, rangeValue, "2026-03-05/");
        await page.hover(rday("2026-03-09"));
        await poll(
          async () => (await part("2026-03-07")) === "middle" && (await page.locator(`${range} td[data-preview]`).count()) === 5,
          "vista previa del rango bajo el puntero",
        );
        await page.click(rday("2026-03-09"));
        await expectText(page, rangeValue, "2026-03-05/2026-03-09");
        assert(
          (await part("2026-03-05")) === "start" && (await part("2026-03-09")) === "end" && (await part("2026-03-07")) === "middle",
          "extremos y días intermedios marcados",
        );
        await expectCount(page, `${range} td[aria-selected=true]`, 5, "los cinco días del rango quedan seleccionados");
        if (scope === "page") await shot(page, "forms-calendar-range");
        // Un tercer clic empieza otro rango; elegir antes del inicio lo invierte.
        await page.click(rday("2026-03-20"));
        await expectText(page, rangeValue, "2026-03-20/");
        await page.click(rday("2026-03-18"));
        await expectText(page, rangeValue, "2026-03-18/2026-03-20");
        // Teclado.
        await page.focus(rday("2026-03-18"));
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expectText(page, rangeValue, "2026-03-25/");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await poll(async () => (await part("2026-03-26")) === "middle", "el foco también previsualiza el rango");
        await page.keyboard.press("Enter");
        await expectText(page, rangeValue, "2026-03-25/2026-03-27");
      });
    },
  },
  {
    name: "DatePicker: fecha única y rango con puntero y teclado, en la página y en un Modal",
    async run({ open, shot }) {
      const page = await open("forms");
      const today = await page.evaluate(() => {
        const d = new Date();
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      });
      const month = today.slice(0, 7);
      const shift = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
      await inPageAndModal(page, async (scope) => {
        const trigger = `${t(`${scope}-date`)} .z-select__control`;
        const value = t(`${scope}-date-value`);
        const panel = ".z-datepicker__panel";
        const day = (date) => `${panel} .z-calendar__day[data-date="${date}"]`;

        assert(
          (await page.locator(trigger).evaluate((el) => el.labels?.[0]?.textContent ?? "")).includes("Due date"),
          "la etiqueta del Field nombra el control",
        );
        await expectText(page, trigger, "Select date");
        // Teclado: Enter abre, el foco entra en hoy, las flechas mueven y Enter elige y cierra.
        await page.focus(trigger);
        await page.keyboard.press("Enter");
        await visible(page, panel);
        await expectAttr(page, trigger, "aria-expanded", "true");
        await poll(async () => (await activeDate(page)) === today, "al abrir sin valor el foco va a hoy");
        await expectAttr(page, day(today), "aria-current", "date");
        await expectOnTop(page, panel);
        await expectInViewport(page, panel);
        await shot(page, scope === "page" ? "forms-datepicker-open" : "forms-modal-datepicker-open");
        await page.keyboard.press("ArrowDown");
        const next = shift(today, 7);
        await poll(async () => (await activeDate(page)) === next, "flecha abajo avanza una semana");
        await page.keyboard.press("Enter");
        await gone(page, panel);
        await expectText(page, value, next);
        await focusOn(page, trigger, "al elegir, el foco vuelve al control");
        assert((await text(page, trigger)) !== "Select date", "el control muestra la fecha elegida");
        // Reabrir: el foco va al día elegido. Escape cierra sin cambiar y devuelve el foco.
        await page.keyboard.press("Enter");
        await visible(page, panel);
        await poll(async () => (await activeDate(page)) === next, "al reabrir el foco va al día elegido");
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("Escape");
        await gone(page, panel);
        await expectText(page, value, next, "Escape no cambia el valor");
        await focusOn(page, trigger, "Escape devuelve el foco al control");
        if (scope === "modal") assert(await page.isVisible(".z-modal"), "Escape en el calendario no cierra el modal");
        // Puntero: abrir, cambiar de mes y elegir.
        await page.click(trigger);
        await visible(page, panel);
        await page.click(`${panel} .z-calendar__nav[aria-label="Next month"]`);
        const target = await page.locator(`${panel} .z-calendar__day:not([data-outside])`).nth(14).getAttribute("data-date");
        await page.click(day(target));
        await gone(page, panel);
        await expectText(page, value, target);
        // Clic fuera cierra sin cambiar.
        await page.click(trigger);
        await visible(page, panel);
        const box = await page.locator(scope === "modal" ? ".z-modal__title" : ".z-pagehead__title").boundingBox();
        await clickOutside(page, box.x + 4, box.y + 4);
        await gone(page, panel, "el clic fuera cierra el calendario");
        await expectText(page, value, target);

        // ── Rango ──
        const rangeTrigger = `${t(`${scope}-range`)} .z-select__control`;
        const rangeValue = t(`${scope}-range-value`);
        await expectText(page, rangeTrigger, "Select dates");
        await page.click(rangeTrigger);
        await visible(page, panel);
        const [from, to] = [`${month}-10`, `${month}-15`];
        await page.click(day(from));
        await expectText(page, rangeValue, `${from}/`);
        await page.waitForTimeout(150);
        assert(await page.isVisible(panel), "con solo el inicio elegido el calendario sigue abierto");
        await page.hover(day(to));
        await poll(async () => (await page.locator(`${panel} td[data-preview]`).count()) === 6, "vista previa del rango");
        if (scope === "page") await shot(page, "forms-datepicker-range");
        await page.click(day(to));
        await gone(page, panel, "al completar el rango el calendario se cierra");
        await expectText(page, rangeValue, `${from}/${to}`);
        assert((await text(page, rangeTrigger)).includes("–"), "el control muestra las dos fechas");
        // Teclado: reabrir, el foco va al inicio del rango; nuevo rango con flechas y Enter.
        await page.focus(rangeTrigger);
        await page.keyboard.press("Enter");
        await visible(page, panel);
        await poll(async () => (await activeDate(page)) === from, "al reabrir el foco va al inicio del rango");
        await expectCount(page, `${panel} td[aria-selected=true]`, 6, "el rango elegido se ve al reabrir");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
        await expectText(page, rangeValue, `${month}-11/`);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await gone(page, panel);
        await expectText(page, rangeValue, `${month}-11/${month}-18`);
        await focusOn(page, rangeTrigger, "al completar el rango con teclado el foco vuelve al control");
      });
    },
  },

  {
    name: "Familia de fecha: varios meses, múltiple, desplegables, preajustes, reservadas, vistas y RTL",
    async run({ open, shot }) {
      const page = await open("forms");
      const activeValue = () =>
        page.evaluate(() => document.activeElement?.dataset?.date ?? document.activeElement?.dataset?.value ?? null);
      const focusedOn = (value, message) => poll(async () => (await activeValue()) === value, message ?? `foco en ${value}`);
      const day = (root, date) => `${t(root)} .z-calendar__day[data-date="${date}"]:not([data-outside])`;

      // Varias fechas: alterna con clic y con teclado, respeta el máximo.
      await page.locator(t("family-multiple")).scrollIntoViewIfNeeded();
      await page.click(day("family-multiple", "2026-11-18"));
      await page.click(day("family-multiple", "2026-11-04"));
      await expectText(page, t("family-multiple-value"), "2026-11-11,2026-11-18");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press(" ");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      await expectText(
        page,
        t("family-multiple-value"),
        "2026-11-05,2026-11-06,2026-11-11,2026-11-18",
        "maxSelected=4 no deja añadir una quinta",
      );
      await expectAttr(page, `${t("family-multiple")} [role=grid]`, "aria-multiselectable", "true");

      // Dos meses: la rejilla es continua para el teclado y la vista solo se mueve al salir; rango con mínimo de 3 días.
      const months = "family-months";
      await page.locator(t(months)).scrollIntoViewIfNeeded();
      await expectCount(page, `${t(months)} [role=grid]`, 2, "dos rejillas");
      await expectCount(page, `${t(months)} .z-calendar__grid [tabindex="0"]`, 1, "una sola parada de tabulación entre los dos meses");
      await page.click(day(months, "2026-11-27"));
      await expectAttr(
        page,
        day(months, "2026-11-28"),
        "aria-disabled",
        "true",
        "con minRange=3 el día siguiente no puede cerrar el rango",
      );
      await expectText(page, t("family-months-value"), "2026-11-27/");
      await page.hover(day(months, "2026-12-02"));
      await expectAttr(
        page,
        `${t(months)} .z-calendar__cell:has([data-date="2026-11-30"]:not([data-outside]))`,
        "data-range",
        "middle",
        "la vista previa cruza de un mes a otro",
      );
      await page.click(day(months, "2026-12-02"));
      await expectText(page, t("family-months-value"), "2026-11-27/2026-12-02");
      await page.focus(day(months, "2026-11-30"));
      await page.keyboard.press("ArrowDown");
      await focusedOn("2026-12-07", "de noviembre a diciembre sin salir de la vista");
      await expectText(page, `${t(months)} .z-calendar__title`, "November – December 2026");
      await page.keyboard.press("PageDown");
      await focusedOn("2027-01-07");
      await expectText(page, `${t(months)} .z-calendar__title`, "December 2026 – January 2027", "la vista avanza un mes al salir");
      await shot(page, "forms-calendar-two-months");

      // Desplegables de mes y año, con límites.
      const caption = t("family-caption");
      await page.locator(caption).scrollIntoViewIfNeeded();
      await page.selectOption(`${caption} select[data-part="month"]`, "2026-03");
      await expectText(page, t("family-caption-value"), "2026-11-06@2026-03");
      await page.selectOption(`${caption} select[data-part="year"]`, "2027");
      await expectText(page, t("family-caption-value"), "2026-11-06@2027-03");
      assert(
        (await page.locator(`${caption} select[data-part="year"] option`).allTextContents()).join(",") === "2025,2026,2027",
        "el select de año se acota a min/max",
      );
      await expectAttr(page, `${caption} .z-calendar__title`, "data-hidden", "", "el título sigue para el lector pero no se ve");

      // Preajustes relativos a hoy.
      const presets = t("family-presets");
      await page.locator(presets).scrollIntoViewIfNeeded();
      await page.click(`${presets} .z-calendar__preset:has-text("Next 7 days")`);
      await expectText(page, t("family-presets-value"), "2026-11-19/2026-11-25");
      await expectAttr(page, `${presets} .z-calendar__preset:has-text("Next 7 days")`, "aria-pressed", "true");
      await page.click(`${presets} .z-calendar__preset:has-text("This month")`);
      await expectText(page, t("family-presets-value"), "2026-11-01/2026-11-30");

      // Reservadas: tachadas, con nombre «booked», no se eligen; las pasadas quedan fuera por min.
      const booked = "family-booked";
      await page.locator(t(booked)).scrollIntoViewIfNeeded();
      await expectAttr(page, day(booked, "2026-11-20"), "aria-label", "Friday, November 20, 2026, booked");
      await page.click(day(booked, "2026-11-20"), { force: true });
      await page.click(day(booked, "2026-11-10"), { force: true });
      await expectText(page, t("family-booked-value"), "none", "ni reservadas ni pasadas se eligen");
      await page.click(day(booked, "2026-11-27"));
      await expectText(page, t("family-booked-value"), "2026-11-27");
      assert(
        (await page.locator(day(booked, "2026-11-21")).evaluate((b) => getComputedStyle(b).textDecorationLine)) === "line-through",
        "la reservada va tachada (no solo color)",
      );
      await expectCount(page, `${t(booked)} .z-calendar__legend li`, 3, "leyenda");

      // Vistas: título → meses → años, con teclado; Escape vuelve a los días; botón Hoy.
      const views = t("family-views");
      await page.locator(views).scrollIntoViewIfNeeded();
      await expectCount(page, `${views} .z-calendar__week-number`, 6, "semanas fijas con número");
      await page.click(`${views} .z-calendar__view`);
      await expectAttr(page, `${views} [role=grid]`, "aria-label", "Choose month");
      await page.click(`${views} .z-calendar__view`);
      await expectAttr(page, `${views} [role=grid]`, "aria-label", "Choose year");
      await page.click(`${views} .z-calendar__unit[data-value="2027"]`);
      await focusedOn("2027-11");
      await page.keyboard.press("ArrowDown");
      await focusedOn("2028-02", "abajo salta 3 meses");
      await page.keyboard.press("Enter");
      await focusedOn("2028-02-01", "Intro baja a los días de ese mes");
      await page.click(`${views} .z-calendar__view`);
      await page.keyboard.press("Escape");
      await expectAttr(page, `${views} .z-calendar`, "data-view", "day", "Escape vuelve a los días");
      await page.click(`${views} .z-calendar__today`);
      await expectText(page, t("family-views-value"), "2026-11-19");
      await focusedOn("2026-11-19");

      // RTL: la flecha izquierda avanza.
      const rtl = "family-rtl";
      await page.locator(t(rtl)).scrollIntoViewIfNeeded();
      await page.focus(day(rtl, "2026-11-10"));
      await page.keyboard.press("ArrowLeft");
      await focusedOn("2026-11-11", "en RTL la izquierda es el día siguiente");
      await page.keyboard.press("ArrowRight");
      await focusedOn("2026-11-10");
    },
  },
  {
    name: "Selectores de rango con confirmación, mes, año, semana y múltiple",
    async run({ open, shot }) {
      const page = await open("forms");
      const panel = ".z-datepicker__panel";
      const activeValue = () =>
        page.evaluate(() => document.activeElement?.dataset?.date ?? document.activeElement?.dataset?.value ?? null);
      const focusedOn = (value, message) => poll(async () => (await activeValue()) === value, message ?? `foco en ${value}`);
      const trigger = (id) => `${t(id)} .z-select__control`;

      // Rango con dos meses, preajustes y confirmación: Cancelar y Escape descartan; Aplicar guarda.
      await page.locator(t("family-range-picker")).scrollIntoViewIfNeeded();
      await page.click(trigger("family-range-picker"));
      await visible(page, panel);
      await expectCount(page, `${panel} [role=grid]`, 2, "dos meses");
      await page.click(`${panel} .z-calendar__preset:has-text("Next 7 days")`);
      await expectText(
        page,
        `${panel} .z-calendar__summary`,
        await page.evaluate(() =>
          new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).formatRange(
            new Date(Date.UTC(2026, 10, 19)),
            new Date(Date.UTC(2026, 10, 25)),
          ),
        ),
      );
      await expectText(page, t("family-range-picker-value"), "none", "con confirm el valor no cambia hasta Aplicar");
      await shot(page, "forms-daterangepicker-confirm");
      await page.keyboard.press("Escape");
      await gone(page, panel);
      await expectText(page, t("family-range-picker-value"), "none", "Escape descarta");
      await page.click(trigger("family-range-picker"));
      await visible(page, panel);
      await page.click(`${panel} .z-calendar__day[data-date="2026-11-23"]:not([data-outside])`);
      await page.click(`${panel} .z-calendar__day[data-date="2026-12-02"]:not([data-outside])`);
      await page.click(`${panel} .z-calendar__apply`);
      await gone(page, panel);
      await expectText(page, t("family-range-picker-value"), "2026-11-23/2026-12-02");
      assert(
        (await page.locator(`${t("family-range-picker")} input[name="window"]`).inputValue()) === "2026-11-23/2026-12-02",
        "formulario desde/hasta",
      );
      await focusOn(page, trigger("family-range-picker"), "el foco vuelve al campo");

      // Mes: rejilla de meses con teclado; Escape en la vista de años vuelve a los meses sin cerrar.
      await page.click(trigger("family-month-picker"));
      await visible(page, panel);
      await focusedOn("2026-11", "el foco va al mes elegido");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowUp");
      await focusedOn("2026-07");
      await page.keyboard.press("Enter");
      await gone(page, panel);
      await expectText(page, t("family-month-picker-value"), "2026-07");
      await page.click(trigger("family-month-picker"));
      await visible(page, panel);
      await page.click(`${panel} .z-calendar__view`);
      await expectAttr(page, `${panel} [role=grid]`, "aria-label", "Choose year");
      await page.keyboard.press("Escape");
      await visible(page, panel, "Escape en la vista de años no cierra el selector");
      await expectAttr(page, `${panel} [role=grid]`, "aria-label", "Choose month");
      await expectAttr(page, `${panel} .z-calendar__unit[data-value="2026-02"]`, "aria-disabled", "true", "min=2026-03");
      await page.keyboard.press("Escape");
      await gone(page, panel);

      // Año: década con los años del borde atenuados.
      await page.click(trigger("family-year-picker"));
      await visible(page, panel);
      await focusedOn("2024");
      await expectAttr(page, `${panel} .z-calendar__unit[data-value="2019"]`, "data-outside", "");
      await page.keyboard.press("PageDown");
      await focusedOn("2034", "RePág/AvPág por década");
      await page.keyboard.press("Enter");
      await gone(page, panel);
      await expectText(page, t("family-year-picker-value"), "2034");

      // Semana ISO: el foco resalta la semana; el formulario recibe YYYY-Www.
      await page.click(trigger("family-week-picker"));
      await visible(page, panel);
      await expectCount(page, `${panel} td[aria-selected=true]`, 7, "la semana elegida entera");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await gone(page, panel);
      await expectText(page, t("family-week-picker-value"), "2026-W48");
      assert(
        (await page.locator(`${t("family-week-picker")} input[name="week"]`).inputValue()) === "2026-W48",
        "semana ISO en el formulario",
      );
      assert((await text(page, trigger("family-week-picker"))).includes("Week 48"), "texto del campo");

      // Múltiple: no cierra al elegir; el campo cuenta.
      await page.click(trigger("family-multiple-picker"));
      await visible(page, panel);
      for (const d of ["2026-11-02", "2026-11-03", "2026-11-04"])
        await page.click(`${panel} .z-calendar__day[data-date="${d}"]:not([data-outside])`);
      await visible(page, panel, "en múltiple el panel sigue abierto");
      await page.keyboard.press("Escape");
      await gone(page, panel);
      await expectText(page, t("family-multiple-picker-value"), "2026-11-02,2026-11-03,2026-11-04");
      assert((await text(page, trigger("family-multiple-picker"))).includes("3 shifts"), "texto con formatCount");

      // Fecha y hora: campo tecleable + panel con calendario y hora; Aplicar junta los dos.
      const dt = t("family-datetime");
      await page.locator(dt).scrollIntoViewIfNeeded();
      await page.focus(`${dt} [role="spinbutton"]`);
      await page.keyboard.press("Alt+ArrowDown");
      const dtPanel = ".z-datetimepicker__panel";
      await visible(page, dtPanel);
      await focusedOn("2026-11-24");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      await visible(page, dtPanel, "elegir día no cierra con hora");
      await page.focus(`${dtPanel} .z-timefield [data-segment="hour"]`);
      await page.keyboard.type("0945");
      await page.click(`${dtPanel} .z-calendar__apply`);
      await gone(page, dtPanel);
      await expectText(page, t("family-datetime-value"), "2026-11-25T09:45");
      // Teclear en el campo cambia el valor sin abrir nada.
      await page.focus(`${t("family-date-input")} [data-segment="day"]`);
      await page.keyboard.press("ArrowUp");
      await expectText(page, t("family-date-input-value"), "2026-11-25");
      await page.click(`${t("family-date-input")} .z-datetimepicker__trigger`);
      await visible(page, dtPanel);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await gone(page, dtPanel);
      await expectText(page, t("family-date-input-value"), "2026-12-02");
    },
  },

  // ───────────────────────────── Accesibilidad y preferencias ─────────────────────────────
  {
    name: "Accesibilidad (axe): ninguna pantalla tiene violaciones graves en tema claro ni oscuro",
    async run({ open, axe, note }) {
      const failures = [];
      let minor = 0;
      const check = async (page, label, options) => {
        await settled(page);
        for (const v of await axe(page, options)) {
          if (v.impact === "serious" || v.impact === "critical")
            failures.push(
              `${label}: [${v.impact}] ${v.id} — ${v.help}\n      ${v.nodes
                .slice(0, 4)
                .map((n) => `${n.target} · ${n.summary}`)
                .join("\n      ")}`,
            );
          else minor += v.nodes.length;
        }
      };
      for (const theme of ["dark", "light"]) {
        for (const screen of SCREENS) {
          const page = await open(screen, { theme });
          await page.waitForTimeout(300);
          await check(page, `${screen} (${theme})`);
          if (screen === "overlays") {
            await page.click(t("open-menu"));
            await visible(page, ".z-menu[role=menu]");
            await check(page, `overlays con menú (${theme})`);
            await page.keyboard.press("Escape");
            await gone(page, ".z-menu[role=menu]");
            await page.click(t("open-modal"));
            await visible(page, ".z-modal");
            await check(page, `overlays con modal (${theme})`);
            await page.keyboard.press("Escape");
            await gone(page, ".z-modal");
            await page.click(t("open-palette"));
            await visible(page, ".z-palette");
            await check(page, `overlays con paleta (${theme})`);
          }
          if (screen === "forms") {
            await page.click(`${t("page-select")} .z-select__control`);
            await visible(page, ".z-listbox");
            await check(page, `forms con Select abierto (${theme})`);
            await page.keyboard.press("Escape");
            await gone(page, ".z-listbox");
            await page.click(`${t("page-date")} .z-select__control`);
            await visible(page, ".z-datepicker__panel");
            await check(page, `forms con DatePicker abierto (${theme})`);
          }
          await page.context().close();
        }
      }
      if (minor) note(`${minor} nodos con violaciones leves o moderadas (no hacen fallar el caso)`);
      assert(failures.length === 0, `violaciones de accesibilidad graves o críticas:\n  ${[...new Set(failures)].join("\n  ")}`);
    },
  },
  {
    name: "prefers-reduced-transparency: el cristal pasa a opaco y los velos no desenfocan",
    async run({ open, shot, Unverifiable, browserName }) {
      const page = await open("overlays", { reducedTransparency: true });
      if (!(await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches)))
        throw new Unverifiable(`${browserName} no aplica la emulación de prefers-reduced-transparency.`);
      // Todo lo que esté a la vista, con un modal y un menú abiertos.
      await page.click(t("open-modal"));
      await visible(page, ".z-modal");
      await page.focus(t("modal-role"));
      await page.keyboard.press("Enter");
      await visible(page, ".z-menu[role=menu]");
      await settled(page);
      const report = await page.evaluate(() => {
        const out = [];
        const blur = (cs) => [cs.backdropFilter, cs.webkitBackdropFilter].find((v) => v && v !== "none");
        const alpha = (color) => {
          const m = color.match(/rgba?\(([^)]+)\)/);
          if (!m) return color.startsWith("color(") && !color.includes("/") ? 1 : null;
          const p = m[1].split(/[,/ ]+/).filter(Boolean);
          return p.length > 3 ? Number(p[3]) : 1;
        };
        let liquid = 0;
        for (const el of document.querySelectorAll("*")) {
          const cs = getComputedStyle(el);
          const name = `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`;
          if (blur(cs)) out.push(`${name}: backdrop-filter ${blur(cs)}`);
          if (el.classList.contains("z-liquid")) {
            liquid++;
            const a = alpha(cs.backgroundColor);
            if (a !== 1) out.push(`${name}: fondo translúcido ${cs.backgroundColor}`);
          }
        }
        return { out: [...new Set(out)], liquid };
      });
      assert(report.liquid >= 3, `se esperaban varias superficies de cristal a la vista, hay ${report.liquid}`);
      assert(
        report.out.length === 0,
        `con transparencia reducida quedan superficies translúcidas o desenfoques:\n  ${report.out.join("\n  ")}`,
      );
      await shot(page, "reduced-transparency-modal");
      // Sin la preferencia, el mismo estado sí usa desenfoque: la comprobación anterior no pasa por omisión.
      const normal = await open("overlays");
      const blurred = await normal.evaluate(
        () =>
          [...document.querySelectorAll(".z-liquid")].filter((el) => {
            const cs = getComputedStyle(el);
            return [cs.backdropFilter, cs.webkitBackdropFilter].some((v) => v && v !== "none");
          }).length,
      );
      assert(blurred > 0, "sin la preferencia el cristal debería desenfocar el fondo");
    },
  },
  {
    name: "prefers-reduced-motion: capas y cajones aparecen sin animación",
    async run({ open }) {
      const page = await open("overlays", { reducedMotion: "reduce" });
      assert(
        await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
        "la emulación de prefers-reduced-motion no se aplicó",
      );
      /** Duración efectiva más larga (animaciones y transiciones) entre el elemento y sus descendientes, en ms. */
      const longest = (selector) =>
        page.evaluate((s) => {
          let max = 0;
          const root = document.querySelector(s);
          for (const el of [root, ...root.querySelectorAll("*")]) {
            // `::backdrop` es el velo de un <dialog> modal (antes, un elemento `.z-overlay-scrim` aparte).
            for (const pseudo of [null, "::before", "::after", ...(el === root && el.matches("dialog") ? ["::backdrop"] : [])]) {
              const cs = getComputedStyle(el, pseudo);
              const toMs = (list) => list.split(",").map((v) => (v.trim().endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000));
              if (cs.animationName !== "none") max = Math.max(max, ...toMs(cs.animationDuration));
              max = Math.max(max, ...toMs(cs.transitionDuration));
            }
          }
          return max;
        }, selector);
      const expectStill = async (selector) => {
        const ms = await longest(selector);
        assert(ms <= 1, `${selector} conserva animaciones o transiciones de ${ms} ms con movimiento reducido`);
      };

      await expectStill(".z-shell");
      await page.click(t("open-modal"));
      await visible(page, ".z-modal");
      await expectStill(".z-modal");
      assert(
        await page.evaluate(() => document.querySelector(".z-modal").matches("dialog:modal")),
        "el Modal no es un <dialog> modal: su velo (::backdrop) no se habría medido",
      );
      await page.focus(t("modal-role"));
      await page.keyboard.press("Enter");
      await visible(page, ".z-menu[role=menu]");
      await expectStill(".z-menu[role=menu]");
      await page.keyboard.press("Escape");
      await gone(page, ".z-menu[role=menu]");
      await page.keyboard.press("Escape");
      await gone(page, ".z-modal");
      await page.click(t("open-drawer"));
      await visible(page, ".z-drawer");
      await expectStill(".z-drawer");
      await page.keyboard.press("Escape");
      await gone(page, ".z-drawer");
      await page.click(t("open-popover"));
      await visible(page, ".z-popover");
      await expectStill(".z-popover");
      await page.keyboard.press("Escape");
      await page.hover(t("tooltip-trigger"));
      await visible(page, ".z-tooltip");
      await expectStill(".z-tooltip");
      await page.mouse.move(5, 5);
      await page.click(t("open-palette"));
      await visible(page, ".z-palette");
      await expectStill(".z-palette");
      await page.keyboard.press("Escape");
      await gone(page, ".z-palette");
      await page.locator(t("toast-success")).scrollIntoViewIfNeeded();
      await page.click(t("toast-success"));
      await visible(page, ".z-toast");
      await expectStill(".z-toast");
      // Popups de formulario y acordeón.
      const forms = await open("forms", { reducedMotion: "reduce" });
      await forms.click(`${t("page-select")} .z-select__control`);
      await visible(forms, ".z-listbox");
      const listMs = await forms.evaluate(() => {
        const cs = getComputedStyle(document.querySelector(".z-listbox"));
        return cs.animationName === "none" ? 0 : parseFloat(cs.animationDuration) * (cs.animationDuration.trim().endsWith("ms") ? 1 : 1000);
      });
      assert(listMs <= 1, `la lista del Select conserva una animación de ${listMs} ms con movimiento reducido`);
      // Cajón del shell en una ventana estrecha.
      const narrow = await open("overview", { width: 700, reducedMotion: "reduce" });
      await narrow.click(t("toggle-sidebar"));
      await visible(narrow, ".z-shell__side.z-shell__drawer");
      const drawerAnim = await narrow.evaluate(() =>
        [".z-shell__drawer", ".z-shell__scrim"]
          .map((s) => {
            const cs = getComputedStyle(document.querySelector(s));
            return cs.animationName === "none" || parseFloat(cs.animationDuration) === 0
              ? ""
              : `${s}: ${cs.animationName} ${cs.animationDuration}`;
          })
          .filter(Boolean),
      );
      assert(drawerAnim.length === 0, `el cajón del shell se anima con movimiento reducido: ${drawerAnim.join(", ")}`);
    },
  },

  // ───────────────────────────── Táctil emulado ─────────────────────────────
  // Contexto de teléfono (`touch: true`): puntero grueso, sin hover. Chromium hace gestos reales; Firefox y WebKit,
  // toques reales y arrastres con eventos de puntero sintéticos (tests/touch.mjs). No sustituye a un dispositivo.
  {
    name: "Táctil: objetivos de 40 px en los controles principales y sin hover pegajoso",
    async run({ open, shot, finger, note, Unverifiable }) {
      const page = await open("forms", { width: 390, height: 844, touch: true });
      if (!(await page.evaluate(() => matchMedia("(pointer: coarse)").matches && !matchMedia("(hover: hover)").matches)))
        throw new Unverifiable("el motor no emula (pointer: coarse) ni (hover: none).");
      const touch = await finger(page);
      const measure = (selectors) =>
        page.evaluate(async (list) => {
          const MIN = 40;
          const small = [];
          let count = 0;
          for (const selector of list) {
            const seen = new Set();
            for (const el of document.querySelectorAll(selector)) {
              if (el.closest("[hidden], [inert], [aria-hidden=true]") || el.matches(":disabled, [data-disabled], [aria-disabled=true]"))
                continue;
              let r = el.getBoundingClientRect();
              if (!r.width || !r.height) continue;
              const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
              if (seen.has(key)) continue;
              seen.add(key);
              count += 1;
              if (r.width >= MIN && r.height >= MIN) continue;
              el.scrollIntoView({ block: "center", inline: "nearest" });
              await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
              r = el.getBoundingClientRect();
              const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
              const reach = MIN / 2 - 1;
              const points = [];
              if (r.height < MIN) points.push([cx, cy - reach], [cx, cy + reach]);
              if (r.width < MIN) points.push([cx - reach, cy], [cx + reach, cy]);
              if (
                points.some(([x, y]) => {
                  const hit = document.elementFromPoint(x, y);
                  return !(hit && (el.contains(hit) || (hit.contains(el) && hit.matches("label"))));
                })
              )
                small.push(`${selector} ${key}`);
            }
          }
          return { count, small };
        }, selectors);
      const CONTROLS = [
        ".z-btn",
        ".z-toggle",
        ".z-segmented__item",
        ".z-input",
        ".z-textarea",
        ".z-select__control",
        ".z-tabs__tab",
        ".z-check",
        ".z-radio",
        ".z-switch",
        ".z-slider",
        ".z-accordion__trigger",
        ".z-pagination__btn",
        ".z-carousel__arrow",
        ".z-tree__row",
        ".z-navlink",
        ".z-rail__item",
        ".z-tabstrip__select",
        ".z-tabstrip__add",
        ".z-calendar__nav",
      ];
      let total = 0;
      for (const screen of ["forms", "projects", "overlays", "navigation", "gallery"]) {
        if (screen !== "forms") {
          await page.goto(page.url().replace(/screen=[a-z]+/, `screen=${screen}`));
          await visible(page, t(`screen-${screen}`));
        }
        const { count, small } = await measure(CONTROLS);
        total += count;
        assert(small.length === 0, `pantalla ${screen}: controles por debajo de 40 px: ${small.join(", ")}`);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(over <= 1, `pantalla ${screen}: desborda ${over} px con los controles a tamaño táctil`);
      }
      assert(total >= 25, `solo se midieron ${total} controles`);
      await shot(page, "touch-gallery");
      // Capas: menú y modal abiertos con un toque.
      await page.goto(page.url().replace(/screen=[a-z]+/, "screen=overlays"));
      await visible(page, t("screen-overlays"));
      await page.locator(t("open-modal")).scrollIntoViewIfNeeded();
      const opener = await center(page, t("open-modal"));
      await touch.tap(opener);
      await visible(page, ".z-modal");
      await settled(page);
      const modal = await measure([".z-modal .z-overlay-close", ".z-modal .z-btn", ".z-modal .z-input"]);
      assert(modal.count > 0 && modal.small.length === 0, `controles del modal: ${modal.small.join(", ")}`);
      await shot(page, "touch-modal");
      // El cierre dibuja 28 px: un toque 16 px por debajo de su centro también cierra.
      const close = await center(page, ".z-modal .z-modal__close");
      await touch.tap({ x: close.x, y: close.y + 16 });
      await gone(page, ".z-modal", "un toque en el borde de la zona ampliada cierra el modal");
      // Estático: cada regla :hover de la suite vive bajo @media (hover: hover) o repite un estado sin :hover.
      const loose = await page.evaluate(() => {
        const out = [];
        const walk = (rules, guarded) => {
          for (const rule of rules) {
            const inMedia = guarded || (rule instanceof CSSMediaRule && /hover:\s*hover/.test(rule.conditionText));
            if (rule instanceof CSSStyleRule && /(^|[\s,>+~(])\.z-[^,]*:hover/.test(rule.selectorText) && !inMedia) {
              const parts = rule.selectorText.split(/,\s*(?![^()]*\))/);
              const plain = parts.filter((p) => !p.includes(":hover")).map((p) => p.trim());
              const orphan = parts.filter((p) => p.includes(":hover") && !plain.some((q) => p.trim().startsWith(q)));
              if (orphan.length) out.push(orphan[0].trim());
            }
            if (rule.cssRules?.length) walk(rule.cssRules, inMedia);
          }
        };
        for (const sheet of document.styleSheets) {
          try {
            walk(sheet.cssRules, false);
          } catch {
            /* hoja de otro origen */
          }
        }
        return out;
      });
      assert(loose.length === 0, `reglas :hover de la suite fuera de @media (hover: hover): ${loose.slice(0, 6).join(" | ")}`);
      note(
        "no se exigen 40 px a controles secundarios densos (días de Calendar en contenedores estrechos: 33 px a 390; cierre de pestaña de TabStrip, quitar Chip, estrellas de Rating, copiar de CodeBlock, enlaces en línea)",
      );
    },
  },
  {
    name: "Táctil: Carousel con arrastre, inercia y desplazamiento vertical de la página",
    async run({ open, finger, note }) {
      const page = await open("gallery", { width: 390, height: 844, touch: true });
      const touch = await finger(page);
      const root = t("carousel-css");
      const index = t("carousel-css-index");
      await until(page, (s) => document.querySelector(s)?.dataset.mode === "css", "modo css", root);
      const viewport = `${root} .z-carousel__viewport`;
      assert(
        (await page.locator(viewport).evaluate((el) => getComputedStyle(el).touchAction)) === "pan-y",
        "el viewport del carrusel declara touch-action: pan-y",
      );
      const state = () =>
        page.evaluate(
          ([s, i]) => {
            const vp = document.querySelector(`${s} .z-carousel__viewport`);
            let scroll = scrollY;
            for (let el = vp.parentElement; el; el = el.parentElement) scroll += el.scrollTop;
            return {
              x: new DOMMatrix(getComputedStyle(document.querySelector(`${s} .z-carousel__track`)).transform).m41,
              index: Number(document.querySelector(i).textContent),
              scroll,
              dragging: vp.hasAttribute("data-dragging"),
            };
          },
          [root, index],
        );
      const rest = () => carouselAtRest(page, root);
      await page.locator(viewport).evaluate((el) => el.scrollIntoView({ block: "center" }));
      await rest();
      const box = await page.locator(viewport).boundingBox();
      // Fila superior del slide: lejos del botón, que no inicia arrastres.
      const y = box.y + 24;
      const from = { x: box.x + box.width * 0.85, y };
      const start = await state();
      await touch.swipe(from, { x: from.x - 200, y }, { steps: 12, stepMs: 30, hold: 200 });
      await rest();
      const slow = await state();
      assert(slow.index !== start.index, `el arrastre con el dedo no cambió de slide: ${JSON.stringify([start, slow])}`);
      assert(!slow.dragging, "data-dragging se limpia al levantar el dedo");
      assert(slow.scroll === start.scroll, "un arrastre horizontal no desplaza la página");
      assert((await text(page, t("carousel-css-opened"))) === "none", "el arrastre no activa el botón del slide");
      await touch.swipe(from, { x: from.x - 200, y }, { steps: 4, stepMs: 12 });
      await rest();
      const fling = await state();
      const steps = (a, b) => (((b - a) % 6) + 6) % 6;
      assert(
        steps(slow.index, fling.index) > steps(start.index, slow.index) || Math.abs(fling.x - slow.x) > Math.abs(slow.x - start.x) + 20,
        `el lanzamiento no añade inercia: lento ${steps(start.index, slow.index)} slides, rápido ${steps(slow.index, fling.index)}`,
      );
      // Un toque en el botón del slide activo lo activa. Chromium anula el toque que llega justo después de un
      // lanzamiento (lo toma por "parar la inercia"): se espera como lo haría una persona.
      await sleep(500);
      const button = await center(page, `${root} .z-carousel__slide[data-active] button`);
      await touch.tap(button);
      await until(
        page,
        (s) => document.querySelector(s)?.textContent !== "none",
        "un toque activa el botón del slide",
        t("carousel-css-opened"),
      );
      if (!touch.real) {
        note(
          "arrastre con eventos de puntero sintéticos; el desplazamiento vertical nativo sobre el carrusel no es verificable en este motor (touch-action calculado: pan-y)",
        );
        return;
      }
      const before = await state();
      const again = await page.locator(viewport).boundingBox();
      await touch.swipe(
        { x: again.x + again.width / 2, y: again.y + again.height / 2 },
        { x: again.x + again.width / 2 + 6, y: again.y + again.height / 2 - 220 },
        { steps: 10 },
      );
      await sleep(500);
      const scrolled = await state();
      assert(
        scrolled.scroll > before.scroll + 100,
        `el carrusel bloquea el desplazamiento vertical: ${before.scroll} → ${scrolled.scroll}`,
      );
      assert(scrolled.index === before.index && !scrolled.dragging, "un gesto vertical no mueve la tira");
    },
  },
  {
    name: "Táctil: Toast se descarta deslizando; un gesto corto lo conserva",
    async run({ open, finger, note }) {
      const page = await open("overlays", { width: 390, height: 844, touch: true });
      const touch = await finger(page);
      await page.locator(t("toast-danger")).scrollIntoViewIfNeeded();
      await touch.tap(await center(page, t("toast-danger")));
      await visible(page, ".z-toast[data-intent=danger]");
      await settled(page);
      // El contrato CSS declara `touch-action: pan-y` (`pan-x` en las posiciones centradas): reserva el gesto de descarte.
      assert(
        (await page.locator(".z-toast").evaluate((el) => getComputedStyle(el).touchAction)) !== "auto",
        "el aviso reserva el gesto horizontal (touch-action)",
      );
      const box = await page.locator(".z-toast").boundingBox();
      const from = { x: box.x + 80, y: box.y + box.height / 2 };
      await touch.swipe(from, { x: from.x + 30, y: from.y });
      await sleep(400);
      await expectCount(page, ".z-toast", 1, "30 px no descartan el aviso");
      await poll(
        async () => Math.abs((await page.locator(".z-toast").boundingBox()).x - box.x) < 1,
        "tras un gesto corto el aviso vuelve a su sitio",
      );
      await touch.down(from);
      for (const dx of [20, 40, 60, 80]) {
        await touch.move({ x: from.x + dx, y: from.y });
        await sleep(20);
      }
      const moved = await page
        .locator(".z-toast")
        .evaluate((el) => [el.dataset.swipe, Math.round(new DOMMatrix(getComputedStyle(el).transform).m41)]);
      assert(moved[0] === "move" && moved[1] >= 60, `el aviso sigue al dedo: ${moved}`);
      for (const dx of [110, 150]) {
        await touch.move({ x: from.x + dx, y: from.y });
        await sleep(20);
      }
      await touch.up();
      await gone(page, ".z-toast", "deslizar 150 px a la derecha descarta el aviso");
      if (!touch.real) note("arrastre con eventos de puntero sintéticos: el motor no ofrece gestos táctiles reales");
    },
  },
  {
    name: "Táctil: ContextMenu se abre con pulsación larga y sigue abierto al levantar el dedo",
    async run({ open, shot, finger, note }) {
      const page = await open("overlays", { width: 390, height: 844, touch: true });
      const touch = await finger(page);
      await page.locator(t("context-area")).evaluate((el) => el.scrollIntoView({ block: "center" }));
      const point = await center(page, t("context-area"));
      await touch.tap(point);
      await sleep(300);
      await expectCount(page, ".z-menu[role=menu]", 0, "un toque corto no abre el menú contextual");
      let during = false;
      await touch.press(point, 1000, async () => {
        during = await page.isVisible(".z-menu[role=menu]");
      });
      assert(during, "tras 1 s con el dedo quieto el menú contextual abre");
      await settled(page);
      await sleep(300);
      assert(await page.isVisible(".z-menu[role=menu]"), "el menú sigue abierto al levantar el dedo");
      await expectInViewport(page, ".z-menu[role=menu]");
      await shot(page, "touch-context-menu");
      const item = await center(page, '.z-menu[role=menu] [role=menuitem]:has-text("Duplicate")');
      assert(item.box.height >= 40, `elemento de menú de ${item.box.height} px`);
      await touch.tap(item);
      await gone(page, ".z-menu[role=menu]");
      await expectText(page, t("last-action"), "menu:duplicate");
      if (!touch.real) note("pulsación larga con eventos de puntero sintéticos; el `contextmenu` nativo de la plataforma no se emula");
    },
  },
  {
    name: "Táctil: Slider, SplitPane y ResizeHandle con el dedo",
    async run({ open, finger, note }) {
      // Slider: toque en la pista en los tres motores; el arrastre exige captura real del puntero (setPointerCapture).
      const page = await open("projects", { width: 390, height: 844, touch: true });
      const touch = await finger(page);
      const slider = '.z-slider:has([aria-label="Weekly budget"])';
      const thumb = `${slider} [role=slider]`;
      await page.locator(slider).evaluate((el) => el.scrollIntoView({ block: "center" }));
      assert(
        (await page.locator(slider).evaluate((el) => getComputedStyle(el).touchAction)) === "none",
        "el Slider declara touch-action: none",
      );
      const box = await page.locator(slider).boundingBox();
      assert(box.height >= 40, `franja táctil del Slider de ${box.height} px`);
      await touch.tap({ x: box.x + box.width * 0.75, y: box.y + 4 });
      await expectAttr(page, thumb, "aria-valuenow", "60", "un toque al 75 % de la pista (0-80, paso 5) deja 60");
      if (touch.real) {
        const scroll = () =>
          page.evaluate((s) => {
            let total = scrollY;
            for (let el = document.querySelector(s).parentElement; el; el = el.parentElement) total += el.scrollTop;
            return total;
          }, slider);
        const before = await scroll();
        const grip = await center(page, thumb);
        await touch.swipe(grip, { x: box.x + box.width * 0.25, y: grip.y + 40 }, { steps: 10 });
        await expectAttr(page, thumb, "aria-valuenow", "20", "arrastrar el tirador al 25 %");
        assert((await scroll()) === before, "arrastrar el Slider no desplaza la página");
      } else
        note(
          "arrastre del Slider no verificable: el Slider captura el puntero (setPointerCapture) y el motor no ofrece gestos táctiles (se comprobó el toque en la pista)",
        );

      // Divisores en una tableta apaisada: la sidebar está acoplada y el editor reparte paneles.
      const tablet = await open("editor", { width: 1180, height: 820, touch: true });
      const pad = await finger(tablet);
      const width = async (selector) => (await tablet.locator(selector).boundingBox()).width;
      const rowDivider = ".app-split-main > .z-split__divider";
      assert(
        (await tablet.locator(rowDivider).evaluate((el) => getComputedStyle(el).touchAction)) === "none",
        "el divisor declara touch-action: none",
      );
      const files = await width(t("pane-files"));
      const c = await center(tablet, rowDivider);
      // Agarrado 14 px a la derecha del divisor (8 px de ancho): la zona táctil ampliada también arrastra.
      await pad.swipe({ x: c.x + 14, y: c.y }, { x: c.x + 14 + 120, y: c.y + 30 }, { steps: 10 });
      await poll(
        async () => Math.abs((await width(t("pane-files"))) - files - 120) < 4,
        `arrastrar 120 px con el dedo ensancha el panel: ${files} → ${await width(t("pane-files"))}`,
      );
      assert(
        !(await tablet.evaluate((s) => document.querySelector(s).hasAttribute("data-dragging"), rowDivider)),
        "data-dragging se limpia al levantar el dedo",
      );
      const handle = ".z-shell__side > .z-resize";
      await visible(tablet, handle);
      const side = await width(".z-shell__side");
      const h = await center(tablet, handle);
      // Agarrado 12 px hacia dentro del panel: hacia fuera, la zona ampliada acaba donde empieza el área principal.
      await pad.swipe({ x: h.x - 12, y: h.y }, { x: h.x - 12 + 60, y: h.y - 20 }, { steps: 10 });
      await poll(
        async () => Math.round(await width(".z-shell__side")) === Math.round(side) + 60,
        `el tirador de la sidebar sigue al dedo: ${side} → ${await width(".z-shell__side")}`,
      );
      if (!pad.real) note("arrastre de divisores con eventos de puntero sintéticos: el motor no ofrece gestos táctiles reales");
    },
  },
  {
    name: "Táctil: cajones del Shell con toques; el velo cierra",
    async run({ open, shot, finger }) {
      const page = await open("overview", { width: 390, height: 844, touch: true });
      const touch = await finger(page);
      await expectCount(page, ".z-shell__side, .z-shell__inspector", 0, "a 390 px los paneles empiezan cerrados");
      const toggle = await center(page, t("toggle-sidebar"));
      assert(toggle.box.width >= 40 && toggle.box.height >= 40, `botón de la barra de título de ${toggle.box.width}×${toggle.box.height}`);
      await touch.tap(toggle);
      await visible(page, ".z-shell__side.z-shell__drawer[data-mode=overlay]");
      await visible(page, ".z-shell__scrim");
      await settled(page);
      await expectInViewport(page, ".z-shell__side");
      await shot(page, "touch-shell-sidebar");
      const drawer = await page.locator(".z-shell__side").boundingBox();
      // Desplazar con el dedo dentro del cajón no lo cierra.
      await touch.swipe(
        { x: drawer.x + drawer.width / 2, y: drawer.y + drawer.height * 0.6 },
        { x: drawer.x + drawer.width / 2, y: drawer.y + drawer.height * 0.3 },
      );
      await sleep(400);
      await expectCount(page, ".z-shell__side.z-shell__drawer", 1, "desplazar dentro del cajón no lo cierra");
      const size = page.viewportSize();
      assert(drawer.x + drawer.width < size.width - 24, `el cajón deja velo que tocar: ${JSON.stringify(drawer)}`);
      await touch.tap({ x: size.width - 12, y: size.height / 2 });
      await gone(page, ".z-shell__drawer", "tocar el velo cierra el cajón");
      await touch.tap(await center(page, t("toggle-inspector")));
      await visible(page, ".z-shell__inspector.z-shell__drawer");
      await settled(page);
      await expectInViewport(page, ".z-shell__inspector");
      // Elegir un destino con un toque navega y cierra el cajón.
      await touch.tap({ x: 12, y: size.height / 2 }).catch(() => {});
      await sleep(300);
      if (await page.isVisible(".z-shell__drawer")) await page.keyboard.press("Escape");
      await gone(page, ".z-shell__drawer");
      await touch.tap(await center(page, t("toggle-sidebar")));
      await visible(page, ".z-shell__side.z-shell__drawer");
      await settled(page);
      await touch.tap(await center(page, '.z-shell__side .z-navlink:has-text("Navigation")'));
      await visible(page, t("screen-navigation"));
      await gone(page, ".z-shell__side", "navegar con un toque desde el cajón lo cierra");
    },
  },
  // Auditoría previa a la 0.2.0: cada archivo recibe los ayudantes de este módulo y devuelve sus casos.
  ...[auditReact, auditCss, layers, wave3, wave4Zout].flatMap((build) => build(helpers())),

  // ───────────────────────────── DateField, TimeField y TimePicker ─────────────────────────────
  {
    name: "DateField: teclado de spinbutton, pegar fecha ISO y del locale, inválido al salir y RTL",
    async run({ open, shot }) {
      const page = await open("forms");
      const seg = (id, type) => `${t(id)} [data-segment="${type}"]`;
      const activeSegment = () => page.evaluate(() => document.activeElement?.getAttribute("data-segment"));
      const texts = (id) => page.locator(`${t(id)} [data-segment]`).allTextContents();
      await page.locator(t("df")).scrollIntoViewIfNeeded();
      assert((await texts("df")).join("/") === "11/13/2026", `orden en-US: ${await texts("df")}`);
      assert(
        (await page.locator(`${t("df")} [role=group]`).getAttribute("aria-labelledby")) !== null,
        "el grupo se nombra con la etiqueta del Field",
      );
      await page.click(seg("df", "month"));
      await page.keyboard.press("ArrowUp");
      await expectText(page, t("df-value"), "2026-12-13");
      await page.keyboard.press("ArrowUp");
      await expectText(page, t("df-value"), "2026-01-13", "ciclo 12 → 1");
      await page.keyboard.type("02");
      await poll(async () => (await activeSegment()) === "day", "dos cifras avanzan al día");
      await page.keyboard.type("31");
      await expectText(page, t("df-value"), "none", "31 de febrero: sin valor");
      assert(!(await page.locator(`${t("df")} .z-datefield`).getAttribute("data-invalid")), "no se marca mientras se teclea");
      await page.keyboard.press("Tab");
      await expectAttr(page, `${t("df")} .z-datefield`, "data-invalid", "true", "inválido al salir");
      await expectAttr(page, seg("df", "day"), "aria-invalid", "true");
      await page.click(seg("df", "day"));
      await page.keyboard.type("28");
      await expectText(page, t("df-value"), "2026-02-28");
      await poll(async () => (await page.locator(`${t("df")} .z-datefield`).getAttribute("data-invalid")) === null, "corregido: sin marca");
      await page.keyboard.press("Backspace");
      await expectText(page, t("df-value"), "none");
      await page.keyboard.press("Backspace");
      await poll(async () => (await activeSegment()) === "day", "Retroceso en un segmento vacío vuelve al anterior");
      const paste = (selector, data) =>
        page.locator(selector).evaluate((el, text) => {
          el.focus();
          const transfer = new DataTransfer();
          transfer.setData("text", text);
          // Firefox no acepta clipboardData al construir el evento: usa dataType y data.
          el.dispatchEvent(
            new ClipboardEvent("paste", { clipboardData: transfer, dataType: "text/plain", data: text, bubbles: true, cancelable: true }),
          );
        }, data);
      await paste(seg("df", "year"), "2030-01-02");
      await expectText(page, t("df-value"), "2030-01-02", "pegar ISO");
      await paste(seg("df", "day"), "12/25/2031");
      await expectText(page, t("df-value"), "2031-12-25", "pegar en formato en-US");
      await page.click(`${t("df")} .z-datefield__clear`);
      await expectText(page, t("df-value"), "none", "borrar");
      // Fecha y hora en 24 h, en-GB.
      assert((await texts("dtf")).join(" ") === "dd mm yyyy –– ––", `en-GB con hora: ${await texts("dtf")}`);
      await page.click(seg("dtf", "day"));
      await page.keyboard.type("13112026");
      await page.keyboard.type("2105");
      await expectText(page, t("dtf-value"), "2026-11-13T21:05");
      await shot(page, "forms-datefield");
      // RTL: la flecha izquierda va al segmento siguiente, que queda a la izquierda.
      await page.click(seg("rtl-df", "month"));
      await page.keyboard.press("ArrowLeft");
      await poll(async () => (await activeSegment()) === "day", "RTL: flecha izquierda al siguiente");
      const [month, day] = [
        await page.locator(seg("rtl-df", "month")).boundingBox(),
        await page.locator(seg("rtl-df", "day")).boundingBox(),
      ];
      assert(day.x < month.x, "RTL: el día queda a la izquierda del mes");
    },
  },
  {
    name: "TimeField: 12 h y AM/PM, pasos de minuto y franja que cruza la medianoche",
    async run({ open }) {
      const page = await open("forms");
      const seg = (id, type) => `${t(id)} [data-segment="${type}"]`;
      await page.locator(t("tf")).scrollIntoViewIfNeeded();
      await page.click(seg("tf", "minute"));
      await page.keyboard.press("ArrowUp");
      await expectText(page, t("tf-value"), "07:45", "paso de 15 minutos");
      await page.keyboard.press("ArrowUp");
      await expectText(page, t("tf-value"), "07:00", "ciclo 45 → 00");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.type("p");
      await expectText(page, t("tf-value"), "19:00");
      await page.click(seg("tf", "hour"));
      await page.keyboard.type("12");
      await expectText(page, t("tf-value"), "12:00", "12 PM es mediodía");
      await page.click(seg("tf", "dayPeriod"));
      await page.keyboard.type("a");
      await expectText(page, t("tf-value"), "00:00", "12 AM es medianoche");
      // 22:00–02:00.
      await page.click(seg("night", "hour"));
      await page.keyboard.type("2330");
      await expectText(page, t("night-value"), "23:30");
      await page.keyboard.press("Tab");
      await sleep(100);
      assert((await page.locator(`${t("night")} .z-datefield`).getAttribute("data-invalid")) === null, "23:30 está en la franja");
      await page.click(seg("night", "hour"));
      await page.keyboard.type("12");
      await page.keyboard.press("Tab");
      await expectAttr(page, `${t("night")} .z-datefield`, "data-invalid", "true", "12:30 queda fuera");
      await page.click(seg("night", "hour"));
      await page.keyboard.type("01");
      await expectText(page, t("night-value"), "01:30");
      await poll(
        async () => (await page.locator(`${t("night")} .z-datefield`).getAttribute("data-invalid")) === null,
        "01:30 vuelve a la franja",
      );
    },
  },
  {
    name: "TimePicker: columnas y lista de franjas con teclado; Escape y foco",
    async run({ open, shot }) {
      const page = await open("forms");
      const panel = ".z-timepicker__panel";
      const activeOption = () =>
        page.evaluate(() => {
          const el = document.activeElement;
          return el?.getAttribute("role") === "option"
            ? `${el.closest("[data-column]")?.dataset.column ?? "list"}:${el.textContent}`
            : null;
        });
      await page.locator(t("tp")).scrollIntoViewIfNeeded();
      const trigger = `${t("tp")} .z-timepicker__trigger`;
      await page.click(trigger);
      await visible(page, panel);
      await expectAttr(page, trigger, "aria-expanded", "true");
      await poll(async () => (await activeOption()) === "hour:09", "foco inicial en la hora elegida");
      await expectOnTop(page, panel);
      await shot(page, "forms-timepicker-columns");
      await page.keyboard.press("ArrowDown");
      await expectText(page, t("tp-value"), "10:30", "la selección sigue al foco");
      await page.keyboard.press("Tab");
      await poll(async () => (await activeOption()) === "minute:30", "Tab a los minutos");
      await page.keyboard.press("ArrowDown");
      await expectText(page, t("tp-value"), "10:35", "minutos de 5 en 5");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowDown");
      await expectText(page, t("tp-value"), "22:35", "PM");
      await page.keyboard.press("Enter");
      await gone(page, panel);
      await focusOn(page, trigger, "Intro cierra y el foco vuelve al botón");
      // Alt+Flecha abajo desde un segmento; Escape cierra sin cambiar.
      await page.click(`${t("tp")} [data-segment="minute"]`);
      await page.keyboard.press("Alt+ArrowDown");
      await visible(page, panel);
      await page.keyboard.press("Escape");
      await gone(page, panel);
      await expectText(page, t("tp-value"), "22:35");
      await focusOn(page, trigger, "Escape devuelve el foco al botón");
      // Lista de franjas.
      const listTrigger = `${t("tpl")} .z-timepicker__trigger`;
      await page.click(listTrigger);
      await visible(page, panel);
      await expectCount(page, `${panel} [role=option]`, 17, "franjas de 09:00 a 17:00");
      await expectAttr(page, `${panel} [data-value="12:00"]`, "aria-disabled", "true");
      await poll(async () => (await activeOption()) === "list:09:00", "foco inicial en la primera franja");
      await page.keyboard.press("ArrowDown");
      await poll(async () => (await activeOption()) === "list:09:30", "flecha abajo");
      await expectText(page, t("tpl-value"), "none", "mover no elige");
      await page.keyboard.type("15");
      await expectCount(page, `${panel} [role=option]`, 2, "el filtro deja 15:00 y 15:30");
      await poll(async () => (await activeOption()) === "list:15:00", "el foco va a la primera que coincide");
      await shot(page, "forms-timepicker-list");
      await page.keyboard.press("Escape");
      await expectCount(page, `${panel} [role=option]`, 17, "Escape limpia el filtro");
      assert(await page.isVisible(panel), "el primer Escape no cierra");
      await page.keyboard.type("1530");
      await page.keyboard.press("Enter");
      await gone(page, panel);
      await expectText(page, t("tpl-value"), "15:30");
      await focusOn(page, listTrigger);
    },
  },
  {
    name: "DateField y TimeField en un formulario: name, required, envío inválido y form.reset()",
    async run({ open }) {
      const page = await open("forms");
      const form = t("dt-form");
      await page.locator(form).scrollIntoViewIfNeeded();
      await page.click(t("dt-submit"));
      await poll(
        () =>
          page.evaluate(
            (s) => document.activeElement?.closest(s) !== null && document.activeElement?.getAttribute("data-segment") === "month",
            form,
          ),
        "un envío con el campo obligatorio vacío lleva el foco a su primer segmento",
      );
      await expectText(page, t("dt-sent"), "none", "no se envía");
      await expectAttr(page, `${form} .z-datefield:not(.z-timefield)`, "data-invalid", "true");
      await page.keyboard.type("0315");
      assert(
        await page.evaluate(
          (s) =>
            document.querySelector(`${s} .z-datefield:not(.z-timefield) .z-native-input`).validationMessage === "Enter a complete date.",
          form,
        ),
        "incompleto: mensaje propio",
      );
      await page.keyboard.type("2026");
      await page.click(t("dt-submit"));
      await expectText(page, t("dt-sent"), '{"date":"2026-03-15","time":"08:00"}');
      await page.click(`${form} .z-timefield [data-segment="hour"]`);
      await page.keyboard.press("ArrowUp");
      await page.click(t("dt-reset"));
      await expectText(page, t("dt-sent"), "reset");
      await poll(
        async () => (await page.locator(`${form} [data-segment]`).allTextContents()).join(" ") === "mm dd yyyy 08 00",
        "form.reset() vuelve a los valores iniciales",
      );
    },
  },

  // ───────────────────────────── Familia de fecha: cierre ─────────────────────────────
  {
    name: "WeekPicker de rango, número de semana pulsable, horas del día límite, hoja inferior y Timer",
    async run({ open, shot }) {
      const page = await open("forms");
      // Rango de semanas: dos pulsaciones eligen de una semana a otra.
      await page.click(`${t("week-range")} button.z-select__control`);
      const panel = ".z-datepicker__panel:popover-open";
      await visible(page, panel);
      await page.click(`${panel} .z-calendar__day[data-date="2026-11-03"]:not([data-outside])`);
      await page.click(`${panel} .z-calendar__day[data-date="2026-11-24"]:not([data-outside])`);
      await gone(page, panel);
      await expectText(page, t("week-range-value"), "2026-W45/2026-W48");
      assert((await text(page, `${t("week-range")} .z-select__value`)).includes("Week 45–48"), "texto del rango de semanas");

      // Número de semana: un botón que elige la semana entera.
      const weekButton = `${t("week-number-calendar")} .z-calendar__week-button`;
      await expectCount(page, weekButton, 6, "un botón por semana");
      await page.locator(weekButton).nth(3).click();
      await expectText(page, t("week-number-value"), "47:2026-11-16 2026-11-16/2026-11-22");

      // DateTimePicker: el día de `min` empieza a las 09:30.
      await page.click(`${t("bounded-dt")} .z-datetimepicker__trigger`);
      const dtPanel = ".z-datetimepicker__panel:popover-open";
      await visible(page, dtPanel);
      await page.click(`${dtPanel} .z-calendar__day[data-date="2026-11-19"]:not([data-outside])`);
      await page.locator(`${dtPanel} .z-timefield [data-segment="hour"]`).click();
      await page.keyboard.type("0800");
      await page.click(`${dtPanel} .z-calendar__apply`);
      await gone(page, dtPanel);
      await expectText(page, t("bounded-dt-value"), "2026-11-19T09:30", "la hora antes de min se encaja en min");

      // Hoja inferior: Drawer modal con el calendario; elegir cierra.
      await page.click(`${t("sheet-picker")} button.z-select__control`);
      await visible(page, "dialog.z-datepicker__drawer:modal");
      await focusInside(page, "dialog.z-datepicker__drawer");
      await shot(page, "datepicker-drawer");
      await page.click(`dialog.z-datepicker__drawer .z-calendar__day[data-date="2026-11-20"]:not([data-outside])`);
      await gone(page, "dialog.z-datepicker__drawer:modal");
      await expectText(page, t("sheet-picker-value"), "2026-11-20");

      // Preajustes encima.
      await expectAttr(page, `${t("presets-top")}`, "data-testid", "presets-top");
      await page.click(`${t("presets-top")} button.z-select__control`);
      await visible(page, `${panel} .z-calendar[data-presets-placement="top"]`);
      await page.keyboard.press("Escape");
      await gone(page, panel);

      // Timer: corre, pausa, reanuda y termina; los hitos van a la región status.
      const timer = t("timer");
      await page.click(`${timer} .z-timer__toggle`);
      await expectText(page, t("timer-state"), "running");
      await page.click(`${timer} .z-timer__toggle`);
      await expectText(page, t("timer-state"), "paused");
      await poll(async () => (await text(page, `${timer} .z-timer__status`)).startsWith("Paused"), "anuncio de pausa");
      await page.click(`${timer} .z-timer__toggle`);
      await poll(async () => (await page.locator(t("timer-state")).textContent()) === "done", "la cuenta atrás termina", 6000);
      await poll(async () => (await text(page, `${timer} .z-timer__status`)) === "Time's up", "anuncio de fin");
      assert((await page.locator(`${timer} [role="timer"]`).textContent()) === "00:00", "pantalla a cero");
    },
  },

  // ───────────────────────────── Agenda ─────────────────────────────
  {
    name: "Agenda: semana con roles, una parada de Tab, vistas y navegación",
    async run({ open, shot }) {
      const page = await open("agenda");
      const root = "#app-agenda";
      await visible(page, `${root} .z-timegrid[role="grid"]`);
      await expectCount(page, `${root} .z-timegrid__dayhead[role="columnheader"]`, 7, "siete días");
      await expectAttr(page, `${root} .z-timegrid__dayhead[data-date="2026-11-19"]`, "aria-current", "date");
      const tabbable = await page.locator(`${root} .z-agenda__view [tabindex="0"]`).count();
      assert(tabbable === 1, `una sola parada de Tab en la vista: ${tabbable}`);
      const label = await page.locator(`${root} .z-event[data-key="interview-frontend-2026-11-19-10-30"]`).evaluate((el) => el.textContent);
      assert(
        label?.includes("Interview: frontend") && label.includes("Room Kepler") && label.includes("Team"),
        `nombre del evento: ${label}`,
      );
      const title = () => text(page, `${root} .z-agenda__title`);
      assert(/16\s*–\s*22 November 2026 · W47/.test(await title()), `título: ${await title()}`);
      await page.click(`${root} .z-agenda__nav [data-nav="next"]`);
      await poll(async () => /23\s*–\s*29 November 2026 · W48/.test(await title()), "semana siguiente");
      await page.click(`${root} .z-agenda__today`);
      await page.click(`${root} .z-agenda__views [data-view="month"]`);
      await visible(page, `${root} .z-monthgrid[role="grid"]`);
      await page.click(`${root} .z-agenda__views [data-view="agenda"]`);
      await visible(page, `${root} .z-agendalist[role="list"]`);
      await page.click(`${root} .z-agenda__views [data-view="day"]`);
      await expectCount(page, `${root} .z-timegrid__dayhead`, 1, "un día");
      await visible(page, `${root} .z-timegrid__gutter--second`, "segunda zona en el día");
      await shot(page, "agenda-day");
    },
  },
  {
    name: "Agenda: agarrar con teclado, mover, soltar y anunciar; Escape cancela",
    async run({ open }) {
      const page = await open("agenda");
      const root = "#app-agenda";
      const key = "lunch-2026-11-19-13-00";
      const ev = `${root} .z-agenda__view .z-event[data-key="${key}"]`;
      await page.locator(ev).focus();
      await page.keyboard.press("Enter");
      await visible(page, `${root} .z-agenda__detail:popover-open`, "Intro abre el detalle");
      await page.keyboard.press("Escape");
      await gone(page, `${root} .z-agenda__detail`);
      await focusOn(page, ev, "el foco vuelve al evento");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      await page.locator(ev).focus();
      await page.keyboard.press("Enter");
      await expectAttr(page, ev, "aria-pressed", "true", "la segunda Intro agarra");
      await visible(page, `${root} .z-agenda__hint`);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowRight");
      await focusOn(page, ev, "el foco sigue en el evento al cambiar de día");
      await page.keyboard.press("Enter");
      await expectText(page, t("agenda-log"), "Lunch: 2026-11-20T13:30 → 2026-11-20T14:15");
      await poll(async () => (await text(page, `${root} .z-agenda__live`)).startsWith("Moved Lunch"), "anuncio en la región viva");
      // Escape cancela sin cambios.
      const moved = `${root} .z-agenda__view .z-event[data-key="${key}"]`;
      await page.locator(moved).focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      await page.locator(moved).focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("Escape");
      await poll(async () => (await text(page, `${root} .z-agenda__live`)) === "Move cancelled", "anuncio de cancelación");
      await expectText(page, t("agenda-log"), "Lunch: 2026-11-20T13:30 → 2026-11-20T14:15");
    },
  },
  {
    name: "Agenda: arrastrar, redimensionar y crear con puntero; «Move to…» sin arrastre",
    async run({ open }) {
      const page = await open("agenda");
      const root = "#app-agenda";
      const ev = `${root} .z-agenda__view .z-event[data-key="release-review-2026-11-19-15-00"]`;
      const from = await center(page, ev);
      // Una hora más abajo (48 px por hora en la semana) y un día a la derecha.
      const col = await page.locator(`${root} .z-timegrid__col[data-date="2026-11-20"]`).boundingBox();
      await drag(page, { x: from.x, y: from.box.y + 6 }, { x: col.x + col.width / 2, y: from.box.y + 6 + 48 });
      await expectText(page, t("agenda-log"), "Release review: 2026-11-20T16:00 → 2026-11-20T17:00");
      // Redimensionar desde el asa: 30 min más.
      const moved = `${root} .z-agenda__view .z-event[data-key="release-review-2026-11-19-15-00"]`;
      // Lejos del borde del contenedor: cerca de él, el arrastre desplaza solo (y alarga más).
      await page.locator(moved).evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.hover(moved);
      const box = await page.locator(moved).boundingBox();
      await drag(
        page,
        { x: box.x + box.width / 2, y: box.y + box.height - 3 },
        { x: box.x + box.width / 2, y: box.y + box.height - 3 + 24 },
      );
      await poll(
        async () => (await text(page, t("agenda-log"))) === "Release review: 2026-11-20T16:00 → 2026-11-20T17:30",
        "redimensionar 30 min",
      ).catch(async (e) => {
        throw new Error(`${e.message}: ${await text(page, t("agenda-log"))}`);
      });
      // Crear arrastrando sobre una franja vacía del sábado (08:00 → 09:30), lejos del borde del contenedor.
      await page.locator(`${root} .z-timegrid__scroll`).evaluate((el) => {
        el.scrollTop = 0;
      });
      const sat = await page.locator(`${root} .z-timegrid__col[data-date="2026-11-21"]`).boundingBox();
      await drag(page, { x: sat.x + sat.width / 2, y: sat.y + 48 + 4 }, { x: sat.x + sat.width / 2, y: sat.y + 48 * 2 + 20 });
      await poll(
        async () => (await text(page, t("agenda-log"))) === "New event: 2026-11-21T08:00 → 2026-11-21T09:30",
        "selección de franja",
      ).catch(async (e) => {
        throw new Error(`${e.message}: ${await text(page, t("agenda-log"))}`);
      });
      // «Move to…»: detalle → diálogo con fecha y horas.
      const lunch = `${root} .z-agenda__view .z-event[data-key="lunch-2026-11-19-13-00"]`;
      await page.click(lunch);
      await page.click(`${root} .z-agenda__move-open`);
      await visible(page, `${root} dialog.z-agenda__move:modal`);
      await page.fill(`${root} dialog.z-agenda__move input[name="start"]`, "14:00");
      await page.fill(`${root} dialog.z-agenda__move input[name="end"]`, "14:45");
      await page.click(`${root} .z-agenda__move-apply`);
      await gone(page, `${root} dialog.z-agenda__move`);
      await expectText(page, t("agenda-log"), "Lunch: 2026-11-19T14:00 → 2026-11-19T14:45");
    },
  },
  {
    name: "Agenda: mes con «+N más», teclado por días y lista del día en estrecho",
    async run({ open, shot }) {
      const page = await open("agenda", { query: "agenda-view=month" });
      const root = "#app-agenda";
      await visible(page, `${root} .z-monthgrid`);
      const more = `${root} .z-monthgrid__more[data-more="2026-11-19"]`;
      await page.click(more);
      await visible(page, `${root} .z-agenda__pop[data-pop="more"]:popover-open`);
      await focusInside(page, `${root} .z-agenda__pop[data-pop="more"]`);
      await page.keyboard.press("Escape");
      await gone(page, `${root} .z-agenda__pop[data-pop="more"]`);
      await page.locator(`${root} .z-monthgrid__cell[data-date="2026-11-19"]`).focus();
      await page.keyboard.press("ArrowRight");
      await focusOn(page, `${root} .z-monthgrid__cell[data-date="2026-11-20"]`);
      await page.keyboard.press("ArrowDown");
      await focusOn(page, `${root} .z-monthgrid__cell[data-date="2026-11-27"]`);
      await page.keyboard.press("Enter");
      await focusInside(page, `${root} .z-monthgrid__cell[data-date="2026-11-27"] .z-event`);
      await page.keyboard.press("Escape");
      await focusOn(page, `${root} .z-monthgrid__cell[data-date="2026-11-27"]`);
      const narrow = await open("agenda", { query: "agenda-view=month", width: 390, height: 844 });
      await visible(narrow, `${root} .z-monthgrid__daylist`);
      await shot(narrow, "agenda-month-390");
    },
  },
];

/** Ayudantes compartidos con los archivos cases-audit-*.mjs. */
function helpers() {
  return {
    t,
    assert,
    TIMEOUT,
    sleep,
    poll,
    until,
    visible,
    gone,
    settled,
    focusInside,
    focusOn,
    expectAttr,
    expectText,
    expectCount,
    expectFocusTrap,
    SCREENS,
  };
}
