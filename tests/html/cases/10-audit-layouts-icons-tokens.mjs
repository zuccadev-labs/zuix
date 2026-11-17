// Auditoría previa a 0.1.1 de zout, zicon y tokens, sin framework: lo que no cubrían los casos anteriores.
// Iconos: los 346 × 2 se dibujan, atributos hostiles, `hidden`, registro tardío, sprite. Tokens: preferencias de
// contraste y colores forzados. Layouts: regiones y enlace de salto, RTL, patrón «window splitter» completo,
// tiradores verticales, shells anidados, estado previo a la medida, selectores inválidos y dispose().
export default async function ({ page, test, ok, card, settle, browserName, Unverifiable }) {
  const until = async (fn, message, arg) => {
    try {
      await page.waitForFunction(fn, arg, { timeout: 3000 });
    } catch {
      throw new Error(message);
    }
  };
  const box = (selector) => page.locator(selector).boundingBox();
  const center = async (selector) => {
    const b = await box(selector);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
  };
  const size = (w, h = 900) => page.setViewportSize({ width: w, height: h });
  const index = page.url();
  /** Si una consulta de medios se aplica de verdad a las hojas de la página. */
  const applies = (query) =>
    page.evaluate((q) => {
      const style = document.createElement("style");
      style.textContent = `@media ${q} { html { --a3-probe: 1; } }`;
      document.head.append(style);
      const on = getComputedStyle(document.documentElement).getPropertyValue("--a3-probe").trim() === "1";
      style.remove();
      return on;
    }, query);

  /* ───────────── zicon ───────────── */

  await test("auditoría · zicon: los 346 iconos se dibujan en las dos variantes, dentro de la caja", async () => {
    const result = await page.evaluate(async () => {
      const { icons } = await (await fetch("../../zicon/manifest.json")).json();
      const host = document.createElement("div");
      document.body.append(host);
      const bad = [];
      for (const icon of icons)
        for (const variant of ["outline", "solid"]) {
          const el = document.createElement("z-icon");
          el.setAttribute("name", icon.name);
          el.setAttribute("variant", variant);
          el.setAttribute("size", "24");
          host.append(el);
          const svg = el.querySelector("svg.z-icon");
          const paths = svg ? [...svg.querySelectorAll("path")] : [];
          if (!paths.length) {
            bad.push(`${icon.name}/${variant}: sin trazados`);
            continue;
          }
          const b = svg.getBBox();
          if (!(b.width > 1 || b.height > 1)) bad.push(`${icon.name}/${variant}: vacío`);
          if (b.x < -0.01 || b.y < -0.01 || b.x + b.width > 24.01 || b.y + b.height > 24.01)
            bad.push(`${icon.name}/${variant}: se sale de la caja (${[b.x, b.y, b.width, b.height].map((n) => n.toFixed(2))})`);
          if (
            svg.getAttribute("fill") !== "currentColor" ||
            svg.getAttribute("viewBox") !== "0 0 24 24" ||
            svg.getAttribute("aria-hidden") !== "true"
          )
            bad.push(`${icon.name}/${variant}: atributos`);
        }
      host.remove();
      return { count: icons.length, bad };
    });
    ok(result.count === 346, `el manifiesto declara ${result.count} iconos`);
    ok(result.bad.length === 0, `${result.bad.length} iconos con problemas: ${result.bad.slice(0, 6).join("; ")}`);
  });

  await test("auditoría · zicon: <z-icon> con atributos hostiles no inyecta marcado ni ejecuta nada", async () => {
    const result = await page.evaluate(async () => {
      window.__a3 = 0;
      const evil = '"><img src=x onerror="window.__a3=1"><svg onload="window.__a3=1"';
      const host = document.createElement("div");
      host.innerHTML = "<z-icon></z-icon>";
      const el = host.firstElementChild;
      document.body.append(host);
      for (const attr of ["name", "size", "label", "variant"]) el.setAttribute(attr, evil);
      await new Promise((r) => setTimeout(r, 150));
      const out = {
        ran: window.__a3,
        children: el.children.length,
        inner: [...el.querySelectorAll("*")].map((n) => n.localName).join(","),
        label: el.querySelector("svg").getAttribute("aria-label") === evil,
        name: el.querySelector("svg").getAttribute("data-icon") === evil,
        variant: el.querySelector("svg").getAttribute("data-variant"),
        size: el.querySelector("svg").getAttribute("width"),
      };
      host.remove();
      return out;
    });
    ok(result.ran === 0, "se ejecutó código de un atributo");
    ok(result.children === 1 && result.inner === "svg", `el marcado se rompió: ${result.inner}`);
    ok(result.label && result.name, "los valores no se conservaron como texto de atributo");
    ok(result.variant === "outline", `variante no normalizada: ${result.variant}`);
    ok(result.size === "16", `un tamaño que no es una longitud debe quedar en 16: ${result.size}`);
  });

  await test("auditoría · zicon: decorativo o informativo, `hidden`, cambio de atributos y registro tardío", async () => {
    const result = await page.evaluate(async () => {
      const zicon = await import("../../zicon/dist/zicon.element.js");
      const host = document.createElement("div");
      host.innerHTML =
        '<z-icon name="plus"></z-icon><z-icon name="trash" label="Delete"></z-icon><z-icon name="plus" hidden></z-icon><z-icon name="a3-late-icon"></z-icon>';
      document.body.append(host);
      const [plain, labelled, hidden, late] = host.children;
      const out = {
        decorative: plain.querySelector("svg").getAttribute("aria-hidden") === "true" && !plain.querySelector("svg").hasAttribute("role"),
        informative:
          labelled.querySelector("svg").getAttribute("role") === "img" &&
          labelled.querySelector("svg").getAttribute("aria-label") === "Delete" &&
          !labelled.querySelector("svg").hasAttribute("aria-hidden"),
        noShadow: plain.shadowRoot === null,
        contents: getComputedStyle(plain).display,
        hidden: getComputedStyle(hidden).display,
        lateBefore: late.querySelectorAll("path").length,
      };
      hidden.removeAttribute("hidden");
      out.shown = getComputedStyle(hidden).display;
      plain.setAttribute("name", "trash");
      plain.setAttribute("variant", "solid");
      out.changed =
        plain.querySelector("svg").getAttribute("data-icon") === "trash" &&
        plain.querySelector("svg").getAttribute("data-variant") === "solid";
      zicon.registerIcons([{ name: "a3-late-icon", o: ["M4 4L20 4L20 20L4 20Z"], s: ["M4 4L20 4L20 20L4 20Z"] }]);
      out.lateAfter = late.querySelectorAll("path").length;
      zicon.defineIconElement();
      zicon.defineIconElement("z-icon");
      out.idempotent = customElements.get("z-icon") === plain.constructor;
      host.remove();
      return out;
    });
    ok(result.decorative, "sin label el icono debe ser decorativo");
    ok(result.informative, "con label debe ser role=img con nombre");
    ok(result.noShadow && result.contents === "contents", `sin shadow DOM y display: contents (${result.contents})`);
    ok(result.hidden === "none" && result.shown === "contents", `hidden no oculta el icono: ${result.hidden} → ${result.shown}`);
    ok(result.changed, "cambiar name o variant no redibujó");
    ok(
      result.lateBefore === 0 && result.lateAfter === 1,
      `un icono registrado después no se dibujó (${result.lateBefore} → ${result.lateAfter})`,
    );
    ok(result.idempotent, "definir el elemento dos veces no es idempotente");
  });

  await test("auditoría · zicon: sprite.svg con ids únicos y <use> del mismo origen", async () => {
    const result = await page.evaluate(async () => {
      const text = await (await fetch("../../zicon/sprite.svg")).text();
      const ids = [...text.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
      const host = document.createElement("div");
      host.innerHTML =
        '<svg class="z-icon" width="24" height="24"><use href="../../zicon/sprite.svg#plus"></use></svg><svg class="z-icon" width="24" height="24"><use href="../../zicon/sprite.svg#trash-solid"></use></svg>';
      document.body.append(host);
      const boxes = async () => {
        for (let i = 0; i < 40; i++) {
          const b = [...host.querySelectorAll("svg")].map((s) => s.getBBox().width);
          if (b.every((w) => w > 1)) return b;
          await new Promise((r) => setTimeout(r, 50));
        }
        return [...host.querySelectorAll("svg")].map((s) => s.getBBox().width);
      };
      const widths = await boxes();
      host.remove();
      return { count: ids.length, unique: new Set(ids).size, widths, inlineStyle: /<svg[^>]*\sstyle=/.test(text) };
    });
    ok(result.count === 692 && result.unique === 692, `símbolos: ${result.count}, únicos: ${result.unique}`);
    ok(!result.inlineStyle, "la raíz del sprite usa style en línea");
    ok(
      result.widths.every((w) => w > 1),
      `<use> no dibujó el símbolo: ${result.widths}`,
    );
  });

  /* ───────────── tokens ───────────── */

  await test("auditoría · tokens: prefers-contrast: more sube el contraste y forced-colors retira el degradado", async () => {
    const read = () =>
      page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const probe = document.createElement("div");
        document.body.append(probe);
        const color = (token) => {
          probe.style.color = `var(--z-${token})`;
          return getComputedStyle(probe).color;
        };
        const out = {
          muted: color("fg-muted"),
          fg: color("fg"),
          gradient: cs.getPropertyValue("--z-canvas-gradient").trim(),
          border: color("control-border"),
        };
        probe.remove();
        return out;
      });
    await page.emulateMedia({ contrast: "no-preference", forcedColors: "none" });
    const normal = await read();
    // Firefox con Playwright puede arrastrar una emulación anterior sin que las hojas lo reflejen de forma fiable.
    if (normal.muted === normal.fg || normal.gradient === "none")
      throw new Unverifiable(`${browserName} llega con una preferencia de contraste ya aplicada que la emulación no retira`);
    // Se pregunta a una hoja de estilos, no a matchMedia: en Firefox la emulación de Playwright cambia matchMedia
    // pero no vuelve a evaluar las hojas, y entonces el caso no es verificable en ese motor.
    const matches = applies;
    if ((await matches("(prefers-contrast: more)")) || (await matches("(forced-colors: active)")))
      throw new Unverifiable("el entorno ya pide más contraste o colores forzados");
    ok(normal.muted !== normal.fg && normal.gradient !== "none", `estado de partida inesperado: ${JSON.stringify(normal).slice(0, 200)}`);
    await page.emulateMedia({ contrast: "more" });
    try {
      if (!(await matches("(prefers-contrast: more)"))) throw new Unverifiable(`${browserName} no emula prefers-contrast con Playwright`);
      const more = await read();
      ok(more.muted === more.fg, `fg-muted no pasó a fg: ${more.muted} / ${more.fg}`);
      ok(more.gradient === "none", "el degradado sigue con más contraste");
      ok(more.border === more.fg, `el borde de control no pasó a fg: ${more.border}`);
    } finally {
      await page.emulateMedia({ contrast: "no-preference" });
    }
    await page.emulateMedia({ forcedColors: "active" });
    try {
      if (!(await matches("(forced-colors: active)"))) throw new Unverifiable(`${browserName} no emula forced-colors con Playwright`);
      ok((await read()).gradient === "none", "el degradado sigue con colores forzados");
    } finally {
      await page.emulateMedia({ forcedColors: "none" });
    }
  });

  await test("auditoría · tokens: los tokens de texto y de fondo sólido derivados existen en las tres marcas y temas", async () => {
    const result = await page.evaluate(() => {
      const html = document.documentElement;
      const before = { brand: html.dataset.brand, theme: html.dataset.theme };
      const probe = document.createElement("div");
      document.body.append(probe);
      const lum = (rgb) => {
        const [r, g, b] = rgb
          .match(/[\d.]+/g)
          .map(Number)
          .map((x) => {
            x /= 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const srgb = (token, prop) => {
        probe.style[prop] = `color-mix(in srgb, var(--z-${token}) 100%, transparent)`;
        return getComputedStyle(probe)[prop];
      };
      const bad = [];
      for (const brand of ["dazlabs", "zutool", "zenith"])
        for (const theme of ["dark", "light"]) {
          html.dataset.brand = brand;
          html.dataset.theme = theme;
          const solid = srgb("surface-solid", "backgroundColor");
          for (const token of ["fg", "fg-muted", "fg-subtle", "accent-text", "success-text", "warning-text", "danger-text", "info-text"]) {
            const value = getComputedStyle(html).getPropertyValue(`--z-${token}`).trim();
            if (!value) {
              bad.push(`${brand}/${theme}: falta --z-${token}`);
              continue;
            }
            // Texto sobre la superficie opaca, medido con los colores que calcula el navegador.
            probe.style.backgroundColor = solid;
            probe.style.color = `var(--z-${token})`;
            const fg = getComputedStyle(probe).color;
            const m = fg.match(/[\d.]+/g).map(Number);
            const a = m.length > 3 && /rgba|\/|color\(/.test(fg) ? m[3] : 1;
            const s = solid.match(/[\d.]+/g).map(Number);
            const scale = /color\(/.test(fg) ? 255 : 1;
            const flat = `rgb(${[0, 1, 2].map((i) => m[i] * scale * a + s[i] * (/color\(/.test(solid) ? 255 : 1) * (1 - a)).join(",")})`;
            const base = `rgb(${[0, 1, 2].map((i) => s[i] * (/color\(/.test(solid) ? 255 : 1)).join(",")})`;
            const r = ratio(flat, base);
            if (r < 4.5) bad.push(`${brand}/${theme}: --z-${token} sobre surface-solid ${r.toFixed(2)}`);
          }
          for (const token of ["success-solid", "warning-solid", "danger-solid", "info-solid", "accent-solid"])
            if (!getComputedStyle(html).getPropertyValue(`--z-${token}`).trim()) bad.push(`${brand}/${theme}: falta --z-${token}`);
        }
      html.dataset.brand = before.brand;
      html.dataset.theme = before.theme;
      probe.remove();
      return bad;
    });
    ok(result.length === 0, result.slice(0, 6).join("; "));
  });

  /* ───────────── layouts: catálogo ───────────── */

  await test("auditoría · layouts: el cierre de pestaña mide 24 px y el foco sigue visible con colores forzados", async () => {
    const strip = card("TabStrip").locator(".z-tabstrip");
    await strip.scrollIntoViewIfNeeded();
    const b = await strip.locator(".z-tabstrip__close").first().boundingBox();
    ok(b.width >= 24 && b.height >= 24, `cierre de ${b.width} × ${b.height}`);
    await page.emulateMedia({ forcedColors: "active" });
    try {
      if (!(await applies("(forced-colors: active)"))) throw new Unverifiable(`${browserName} no emula forced-colors con Playwright`);
      await strip.locator('.z-tabstrip__select[tabindex="0"]').focus();
      await page.keyboard.press("ArrowRight");
      const outline = await page.evaluate(() => {
        const cs = getComputedStyle(document.activeElement);
        return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
      });
      ok(outline.style !== "none" && outline.width >= 2, `sin contorno de foco con colores forzados: ${JSON.stringify(outline)}`);
    } finally {
      await page.emulateMedia({ forcedColors: "none" });
    }
  });

  await test("auditoría · layouts: SplitPane con Inicio, Fin, doble clic y aria-controls", async () => {
    const row = "#split-demo > .z-split__divider";
    await page.locator("#split-demo").scrollIntoViewIfNeeded();
    const divider = page.locator(row).first();
    await divider.focus();
    const min = Number(await divider.getAttribute("aria-valuemin"));
    await page.keyboard.press("Home");
    ok(
      Number(await divider.getAttribute("aria-valuenow")) === min,
      `Inicio no llevó al mínimo (${await divider.getAttribute("aria-valuenow")} / ${min})`,
    );
    await page.keyboard.press("End");
    const atEnd = await page.evaluate(() => {
      const s = document.querySelector("#split-demo");
      const panes = [...s.children].filter((c) => c.classList.contains("z-split__pane"));
      return [parseFloat(panes[0].style.flexGrow), parseFloat(panes[1].style.flexGrow)];
    });
    ok(atEnd[0] > atEnd[1], `Fin no llevó al máximo: ${atEnd}`);
    const c = await center(row);
    await page.mouse.dblclick(c.x, c.y);
    const even = await page.evaluate(() => {
      const s = document.querySelector("#split-demo");
      const panes = [...s.children].filter((c) => c.classList.contains("z-split__pane"));
      return [parseFloat(panes[0].style.flexGrow), parseFloat(panes[1].style.flexGrow)];
    });
    ok(Math.abs(even[0] - even[1]) < 0.001, `el doble clic no igualó los paneles: ${even}`);
  });

  await test("auditoría · layouts: tiradores top y bottom, tirador sin atributos y selector inválido", async () => {
    const result = await page.evaluate(async () => {
      const zout = await import("../../zout/dist/zout.dom.js");
      const errors = [];
      const onError = (e) => errors.push(e.message);
      window.addEventListener("error", onError);
      const host = document.createElement("div");
      host.setAttribute("data-z-dom", "");
      host.style.cssText = "position:fixed;left:40px;top:40px;z-index:999";
      host.innerHTML = `
      <div id="a3-bottom" style="position:relative;width:200px;height:120px"><div class="z-resize" data-side="bottom" aria-valuemin="60" aria-valuemax="300" data-default-size="120"></div></div>
      <div id="a3-top" style="position:relative;width:200px;height:120px;margin-top:40px"><div class="z-resize" data-side="top" aria-valuemin="60" aria-valuemax="300"></div></div>
      <div id="a3-bad" style="position:relative;width:200px;height:40px;margin-top:40px"><div class="z-resize" data-side="right" data-z-resize="[[[not a selector"></div></div>
      <button type="button" id="a3-toggle" data-z-shell-toggle="sidebar" data-z-shell="]]]bad">x</button>`;
      document.body.append(host);
      zout.hydrate(host);
      const bottom = host.querySelector("#a3-bottom > .z-resize"),
        top = host.querySelector("#a3-top > .z-resize");
      const out = {
        role: bottom.getAttribute("role"),
        tab: bottom.tabIndex,
        orientation: bottom.getAttribute("aria-orientation"),
        now: bottom.getAttribute("aria-valuenow"),
      };
      const key = (el, k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
      key(bottom, "ArrowDown");
      out.bottomDown = host.querySelector("#a3-bottom").getBoundingClientRect().height;
      key(bottom, "ArrowUp");
      key(bottom, "ArrowUp");
      out.bottomUp = host.querySelector("#a3-bottom").getBoundingClientRect().height;
      key(bottom, "Home");
      out.bottomHome = host.querySelector("#a3-bottom").getBoundingClientRect().height;
      key(top, "ArrowUp");
      out.topUp = host.querySelector("#a3-top").getBoundingClientRect().height;
      key(top, "ArrowDown");
      key(top, "ArrowDown");
      out.topDown = host.querySelector("#a3-top").getBoundingClientRect().height;
      key(host.querySelector("#a3-bad > .z-resize"), "ArrowRight");
      host.querySelector("#a3-toggle").click();
      await new Promise((r) => setTimeout(r, 50));
      window.removeEventListener("error", onError);
      host.remove();
      return { ...out, errors };
    });
    ok(
      result.role === "separator" && result.tab === 0 && result.orientation === "horizontal" && result.now === "120",
      `hydrate no completó el tirador: ${JSON.stringify(result)}`,
    );
    ok(
      result.bottomDown === 136 && result.bottomUp === 104 && result.bottomHome === 120,
      `tirador inferior: ${result.bottomDown}, ${result.bottomUp}, ${result.bottomHome}`,
    );
    ok(result.topUp === 136 && result.topDown === 104, `tirador superior: ${result.topUp}, ${result.topDown}`);
    ok(result.errors.length === 0, `un selector inválido lanzó una excepción: ${result.errors.join(" | ")}`);
  });

  await test("auditoría · layouts: antes de medirse, un panel auto que no cabe no se muestra acoplado", async () => {
    const result = await page.evaluate(() => {
      // Marcado de un shell fuera de [data-z-dom]: el comportamiento no lo toca, como el HTML de servidor antes de hidratar.
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:0;top:0;height:300px;z-index:999";
      host.innerHTML = `<div class="z-shell z-root"><div class="z-shell__body">
      <aside class="z-shell__side" aria-label="Nav" data-side="left">nav</aside>
      <aside class="z-shell__side" id="a3-forced" aria-label="Nav" data-side="left" data-panel-mode="docked">nav</aside>
      <main class="z-shell__main">main</main>
      <aside class="z-shell__inspector" aria-label="Details" data-side="right">details</aside></div></div>`;
      document.body.append(host);
      const show = (sel) => getComputedStyle(host.querySelector(sel)).display !== "none";
      const at = (w) => {
        host.style.width = `${w}px`;
        return { side: show(".z-shell__side:not(#a3-forced)"), forced: show("#a3-forced"), inspector: show(".z-shell__inspector") };
      };
      const out = { narrow: at(700), mid: at(1000), wide: at(1300) };
      host.querySelector(".z-shell").setAttribute("data-measured", "");
      out.measured = at(700);
      host.remove();
      return out;
    });
    ok(!result.narrow.side && !result.narrow.inspector && result.narrow.forced, `700 px: ${JSON.stringify(result.narrow)}`);
    ok(result.mid.side && !result.mid.inspector, `1000 px: ${JSON.stringify(result.mid)}`);
    ok(result.wide.side && result.wide.inspector, `1300 px: ${JSON.stringify(result.wide)}`);
    ok(result.measured.side && result.measured.inspector, "una vez medido manda el comportamiento, no la hoja");
  });

  /* ───────────── layouts: aplicación completa (shell.html) ───────────── */

  await page.goto(new URL("shell.html", index).href);
  await page.waitForFunction(() => customElements.get("z-icon"));
  try {
    await test("auditoría · Shell: regiones banner, navigation, main y complementary, y enlace de salto", async () => {
      await size(1440);
      await until(() => !document.querySelector(".z-shell__side").hidden, "la sidebar no está abierta");
      const regions = await page.evaluate(() => {
        const landmark = (el) => !el.closest("main, article, aside, nav, section");
        return {
          banner: [...document.querySelectorAll("header")].filter(landmark).map((h) => h.className),
          main: document.querySelectorAll("main").length,
          nav: [...document.querySelectorAll(".z-shell__rail nav")].map((n) => n.getAttribute("aria-label")),
          asides: [...document.querySelectorAll(".z-shell__body > aside")].map((a) => a.getAttribute("aria-label")),
        };
      });
      ok(regions.banner.length === 1 && regions.banner[0] === "z-titlebar", `banner: ${JSON.stringify(regions.banner)}`);
      ok(regions.main === 1, `${regions.main} elementos main`);
      ok(regions.nav.length === 1 && Boolean(regions.nav[0]), "el rail no es una navegación con nombre");
      ok(regions.asides.length === 2 && regions.asides.every(Boolean), `paneles sin nombre: ${JSON.stringify(regions.asides)}`);
      // El enlace de salto es la primera parada de tabulación, solo se ve con el foco y lleva al área principal.
      await page.evaluate(() => {
        document.activeElement?.blur();
        window.getSelection()?.removeAllRanges();
      });
      const hiddenBefore = await page.locator(".z-shell__skip").evaluate((el) => el.getBoundingClientRect().bottom <= 0);
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const a = document.activeElement;
        const r = a.getBoundingClientRect();
        return { skip: a.classList.contains("z-shell__skip"), visible: r.top >= 0 && r.height > 0 };
      });
      if (browserName === "webkit" && !focused.skip)
        throw new Unverifiable("WebKit no lleva el foco a los enlaces con Tab salvo que el sistema lo tenga activado");
      ok(hiddenBefore, "el enlace de salto se ve sin foco");
      ok(focused.skip && focused.visible, `Tab no llegó al enlace de salto o no se ve: ${JSON.stringify(focused)}`);
      await page.keyboard.press("Enter");
      ok(await page.evaluate(() => document.activeElement?.id === "app-main"), "el enlace de salto no llevó el foco al área principal");
    });

    await test("auditoría · Shell en RTL: paneles, cajón, tirador y flechas siguen la dirección de escritura", async () => {
      await size(1440);
      await page.evaluate(() => {
        document.documentElement.dir = "rtl";
      });
      try {
        await until(
          () => !document.querySelector(".z-shell__side").hidden && !document.querySelector(".z-shell__inspector").hidden,
          "los paneles no están acoplados",
        );
        const b = await page.evaluate(() =>
          Object.fromEntries(
            [".z-shell__rail", ".z-shell__side", ".z-shell__main", ".z-shell__inspector", ".z-shell__side > .z-resize"].map((s) => {
              const r = document.querySelector(s).getBoundingClientRect();
              return [s, { l: Math.round(r.left), r: Math.round(r.right) }];
            }),
          ),
        );
        ok(
          b[".z-shell__inspector"].r <= b[".z-shell__main"].l &&
            b[".z-shell__main"].r <= b[".z-shell__side"].l &&
            b[".z-shell__side"].r <= b[".z-shell__rail"].l,
          `orden en RTL: ${JSON.stringify(b)}`,
        );
        const handle = ".z-shell__side > .z-resize";
        ok(
          Math.abs((b[handle].l + b[handle].r) / 2 - b[".z-shell__side"].l) <= 8,
          `el tirador no está en el borde izquierdo de la sidebar: ${JSON.stringify(b)}`,
        );
        const w = async () => Math.round((await box(".z-shell__side")).width);
        const before = await w();
        const c = await center(handle);
        await drag(c, { x: c.x - 40, y: c.y });
        ok((await w()) === before + 40, `arrastrar 40 px a la izquierda: ${before} → ${await w()}`);
        await page.locator(handle).focus();
        await page.keyboard.press("ArrowLeft");
        ok((await w()) === before + 56, `flecha izquierda: ${await w()}`);
        await page.keyboard.press("Home");
        ok((await w()) === 224, "Inicio no restableció");
        // Pestañas: en RTL la flecha izquierda avanza.
        await page.locator('#tabs [data-tab-id="overview"]').click();
        await page.keyboard.press("ArrowLeft");
        ok((await page.locator('#tabs [data-tab-id="editor"]').getAttribute("aria-selected")) === "true", "ArrowLeft no avanzó en RTL");
        // Divisor de fila: el primer panel está a la derecha; la flecha derecha lo encoge.
        const row = "#split-main > .z-split__divider";
        await page.locator(row).focus();
        const now = Number(await page.locator(row).getAttribute("aria-valuenow"));
        const files = await box("#pane-files"),
          rest = await box("#split-inner");
        ok(files.x > rest.x, "en RTL el primer panel debería estar a la derecha");
        await page.keyboard.press("ArrowRight");
        ok(Number(await page.locator(row).getAttribute("aria-valuenow")) === now - 2, "la flecha derecha no encogió el primer panel");
        const d = await center(row);
        const fw = (await box("#pane-files")).width;
        await drag(d, { x: d.x - 60, y: d.y });
        ok(
          Math.abs((await box("#pane-files")).width - fw - 60) < 4,
          `arrastrar a la izquierda no agrandó el primer panel: ${fw} → ${(await box("#pane-files")).width}`,
        );
        await page.locator('#tabs [data-tab-id="overview"]').click();
        // Cajón: la sidebar entra por la derecha.
        await size(700);
        await until(() => document.querySelector(".z-shell__side").hidden, "no pasó a cajón");
        await page.locator("#toggle-sidebar").click();
        await settle();
        const drawer = await box(".z-shell__side");
        ok(Math.abs(drawer.x + drawer.width - (700 - 12)) < 2, `el cajón de la sidebar no está a la derecha: ${JSON.stringify(drawer)}`);
        await page.keyboard.press("Escape");
      } finally {
        await page.evaluate(() => {
          document.documentElement.removeAttribute("dir");
        });
        await size(1440);
      }
    });

    await test("auditoría · Shell anidado, dos shells y dispose()", async () => {
      await size(1440);
      await until(() => !document.querySelector(".z-shell__side").hidden, "la sidebar no volvió a acoplarse");
      const result = await page.evaluate(async () => {
        const zout = await import("../../zout/dist/zout.dom.js");
        const inner = document.createElement("div");
        inner.style.cssText = "position:fixed;left:300px;top:100px;width:500px;height:300px;z-index:999";
        inner.innerHTML = `<div class="z-shell z-root" id="a3-inner"><div class="z-shell__body">
      <aside class="z-shell__side" aria-label="Inner navigation" data-side="left"><button type="button" id="a3-inside">in</button></aside>
      <div class="z-shell__main"><button type="button" id="a3-inner-toggle" data-z-shell-toggle="sidebar">toggle</button></div></div></div>`;
        document.querySelector("#app-main .z-shell__content").append(inner);
        zout.hydrate(inner);
        const outerSide = document.querySelector("#app > .z-shell__body > .z-shell__side");
        const innerShell = inner.querySelector("#a3-inner"),
          innerSide = innerShell.querySelector(".z-shell__side");
        const out = { modes: zout.getShellModes(innerShell), startsClosed: innerSide.hidden };
        inner.querySelector("#a3-inner-toggle").click();
        out.innerOpen = !innerSide.hidden && innerSide.classList.contains("z-shell__drawer");
        out.outerUntouched = !outerSide.hidden && !outerSide.classList.contains("z-shell__drawer");
        out.outerMainInert = document.querySelector("#app-main").inert;
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        out.escapeClosed = innerSide.hidden;
        zout.dispose(inner);
        out.disposed = zout.getShellModes(innerShell) === null && zout.getShellModes(document.querySelector("#app")) !== null;
        inner.remove();
        return out;
      });
      ok(
        result.modes?.sidebar === "overlay" && result.startsClosed,
        `el shell interior (500 px) debería empezar en cajón cerrado: ${JSON.stringify(result)}`,
      );
      ok(
        result.innerOpen && result.outerUntouched && !result.outerMainInert,
        `el botón del shell interior afectó al exterior: ${JSON.stringify(result)}`,
      );
      ok(result.escapeClosed, "Escape no cerró el cajón del shell interior");
      ok(result.disposed, "dispose() no soltó el shell interior o soltó el exterior");
    });
  } finally {
    await page
      .evaluate(() => {
        document.documentElement.removeAttribute("dir");
      })
      .catch(() => {});
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(index);
    await page.waitForFunction(() => customElements.get("z-icon"));
  }
}
