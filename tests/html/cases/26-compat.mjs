// Modo compat (docs/users/10-compatibilidad.md#modo-compat): la misma página con tokens.compat.css, zui.compat.css y
// zout.compat.css en lugar de las hojas normales. El motor de la prueba entiende las dos, así que se comparan: cada
// elemento debe salir con los mismos colores. Y el modo sin framework en un navegador sin Popover API: se le quita la
// API a la página antes de cargarla y abrir un menú, un popover o un selector no debe lanzar.
// Cada caso abre sus propias páginas; la compartida no se toca.

const VIEWPORT = { width: 1440, height: 1000 };
// Diferencias conocidas entre la hoja normal y la compat, con su motivo. Hoy ninguna.
const KNOWN = [];

export default async function ({ page, test, ok, note }) {
  const url = page.url();
  // La página compartida vive en el contexto por defecto, que no admite otra: cada página propia trae el suyo.
  const browser = page.context().browser();

  async function open({ compat = false, theme = "dark", brand = "dazlabs", noPopover = false } = {}) {
    const p = await browser.newPage({ viewport: VIEWPORT });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`);
    });
    if (compat)
      await p.route(/\/(tokens|zui|zout)\.css$/, (route) =>
        route.continue({
          url: route
            .request()
            .url()
            .replace(/\.css$/, ".compat.css"),
        }),
      );
    if (noPopover)
      await p.addInitScript(() => {
        // Como un navegador anterior a la Popover API: sin métodos y con `:popover-open` como selector no válido.
        for (const name of ["showPopover", "hidePopover", "togglePopover", "popover"]) delete HTMLElement.prototype[name];
        const invalid = (s) => typeof s === "string" && /(^|[^\\]):popover-open/.test(s);
        for (const [proto, names] of [
          [Element.prototype, ["matches", "closest", "querySelector", "querySelectorAll"]],
          [Document.prototype, ["querySelector", "querySelectorAll"]],
          [DocumentFragment.prototype, ["querySelector", "querySelectorAll"]],
        ])
          for (const name of names) {
            const native = proto[name];
            proto[name] = function (selector, ...rest) {
              if (invalid(selector)) throw new DOMException(`'${selector}' is not a valid selector`, "SyntaxError");
              return native.call(this, selector, ...rest);
            };
          }
      });
    await p.goto(url);
    await p.waitForFunction(() => customElements.get("z-icon"));
    await p.evaluate(
      ([t, b]) => {
        document.documentElement.dataset.theme = t;
        document.documentElement.dataset.brand = b;
      },
      [theme, brand],
    );
    await p.mouse.move(5, 5);
    await p.waitForTimeout(300);
    return { p, errors };
  }

  /** Color de fondo, de texto, de borde, de contorno y de sombra de cada elemento, normalizados a rgba. */
  const snapshot = (p) =>
    p.evaluate((known) => {
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
      // Chrome da `color(srgb …)` u `oklab(…)` para un color mezclado y `rgb(…)` para uno estático: se pintan en un
      // canvas y se leen los cuatro canales.
      const rgba = (value) =>
        value.replace(/(?:rgba?|color|oklab|oklch|lab|lch)\([^)]*\)/g, (c) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#010203";
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
          return `rgba(${[...ctx.getImageData(0, 0, 1, 1).data].join(",")})`;
        });
      const props = ["color", "background-color", "border-top-color", "outline-color", "box-shadow", "background-image"];
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        // Lo que se está animando (progreso, grabación) cambia entre una lectura y otra.
        const animated = el.getAnimations().some((a) => a.playState === "running");
        const skip = animated || known.some((s) => el.matches(s));
        const s = getComputedStyle(el);
        out.push({
          name: `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(" ")[0]}`,
          skip,
          values: props.map((x) => rgba(s.getPropertyValue(x))),
        });
      }
      return { props, out };
    }, KNOWN);

  // Dos lecturas iguales salvo redondeo (el canvas premultiplica el alfa): cada número a 3 o menos.
  const close = (a, b) => {
    if (a === b) return true;
    const [x, y] = [a.match(/-?[\d.]+/g), b.match(/-?[\d.]+/g)];
    return (
      !!x &&
      !!y &&
      x.length === y.length &&
      a.replace(/-?[\d.]+/g, "") === b.replace(/-?[\d.]+/g, "") &&
      x.every((v, i) => Math.abs(v - y[i]) <= 3)
    );
  };

  await test("compat: se cargan las hojas compat, sin @layer ni color-mix()", async () => {
    const { p, errors } = await open({ compat: true });
    try {
      const report = await p.evaluate(() => {
        // La ruta desvía la petición: la hoja conserva el nombre normal y trae el contenido compat.
        const sheets = [...document.styleSheets].filter((s) => /\/(tokens|zui|zout)\.css$/.test(s.href ?? ""));
        const walk = (rules) => [...rules].flatMap((r) => [r, ...(r.cssRules ? walk(r.cssRules) : [])]);
        const rules = sheets.flatMap((s) => walk(s.cssRules));
        return {
          sheets: sheets.length,
          rules: rules.length,
          layers: rules.filter((r) => r.constructor.name.startsWith("CSSLayer")).length,
          mixes: rules.filter((r) => /color-mix\(/i.test(r.cssText)).length,
          compat: rules.filter((r) => r.cssText.includes("--z-compat-")).length,
        };
      });
      ok(report.sheets === 3, `${report.sheets} hojas compat (se esperaban 3)`);
      ok(report.rules > 5000, `solo ${report.rules} reglas`);
      ok(report.layers === 0, `${report.layers} reglas @layer`);
      ok(report.mixes === 0, `${report.mixes} reglas con color-mix()`);
      ok(report.compat > 100, `${report.compat} reglas con --z-compat-*: ¿es la hoja compat?`);
      ok(errors.length === 0, errors.slice(0, 3).join(" | "));
    } finally {
      await p.context().close();
    }
  });

  await test("compat: fondo, botones y diálogo con los colores de la hoja normal", async () => {
    const pages = [await open(), await open({ compat: true })];
    try {
      const read = ({ p }) =>
        p.evaluate(async () => {
          const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
          const rgba = (value) =>
            value.replace(/(?:rgba?|color|oklab|oklch|lab|lch)\([^)]*\)/g, (c) => {
              ctx.clearRect(0, 0, 1, 1);
              ctx.fillStyle = "#010203";
              ctx.fillStyle = c;
              ctx.fillRect(0, 0, 1, 1);
              return `rgba(${[...ctx.getImageData(0, 0, 1, 1).data].join(",")})`;
            });
          const style = (el, pseudo) => {
            const s = getComputedStyle(el, pseudo);
            return rgba([s.backgroundColor, s.backgroundImage, s.color, s.borderTopColor].join(" | "));
          };
          const out = {
            body: style(document.body),
            canvas: style(document.body, "::before"),
            primary: style(document.querySelector(".z-btn--primary")),
            secondary: style(document.querySelector(".z-btn--secondary")),
            danger: style(document.querySelector(".z-btn--danger")),
          };
          document.querySelector('[data-z-open="#edit-profile"]').click();
          const dialog = document.querySelector("#edit-profile");
          await new Promise((r) => setTimeout(r, 400));
          out.open = dialog.open && dialog.matches(":modal");
          out.dialog = style(dialog);
          out.backdrop = style(dialog, "::backdrop");
          out.title = style(dialog.querySelector(".z-modal__title"));
          return out;
        });
      const [normal, compat] = [await read(pages[0]), await read(pages[1])];
      ok(compat.open, "el diálogo no se abrió con la hoja compat");
      for (const key of Object.keys(normal))
        ok(key === "open" || close(String(normal[key]), String(compat[key])), `${key}: ${normal[key]} → ${compat[key]}`);
      ok(!/^rgba\(0,0,0,0\) \| none/.test(compat.body), `fondo de la página vacío: ${compat.body}`);
      ok(!compat.primary.startsWith("rgba(0,0,0,0)"), `botón primario sin fondo: ${compat.primary}`);
      ok(!compat.dialog.startsWith("rgba(0,0,0,0)"), `diálogo sin fondo: ${compat.dialog}`);
      for (const { errors } of pages) ok(errors.length === 0, errors.slice(0, 3).join(" | "));
    } finally {
      for (const { p } of pages) await p.context().close();
    }
  });

  for (const [theme, brand] of [
    ["dark", "dazlabs"],
    ["light", "zutool"],
    ["light", "zenith"],
  ])
    await test(`compat: cada elemento con los colores de la hoja normal (${brand}, ${theme})`, async () => {
      const pages = [await open({ theme, brand }), await open({ compat: true, theme, brand })];
      try {
        const [a, b] = [await snapshot(pages[0].p), await snapshot(pages[1].p)];
        ok(a.out.length === b.out.length && a.out.length > 5000, `elementos: ${a.out.length} y ${b.out.length}`);
        const diffs = [];
        let skipped = 0;
        for (const [i, el] of a.out.entries()) {
          if (el.skip || b.out[i].skip) {
            skipped += 1;
            continue;
          }
          for (const [j, prop] of a.props.entries())
            if (!close(el.values[j], b.out[i].values[j])) diffs.push(`${el.name} ${prop}: ${el.values[j]} → ${b.out[i].values[j]}`);
        }
        note(`${a.out.length} elementos comparados, ${skipped} fuera (animándose o en KNOWN)`);
        ok(diffs.length === 0, `${diffs.length} diferencias: ${diffs.slice(0, 4).join(" | ")}`);
      } finally {
        for (const { p } of pages) await p.context().close();
      }
    });

  await test("compat sin Popover API: abrir un menú, un popover y un selector no lanza; el diálogo sigue abriendo", async () => {
    const { p, errors } = await open({ compat: true, noPopover: true });
    try {
      ok((await p.evaluate(() => typeof HTMLElement.prototype.showPopover)) === "undefined", "la página aún tiene showPopover");
      const invalid = await p.evaluate(() => {
        try {
          document.body.matches(":popover-open");
          return false;
        } catch {
          return true;
        }
      });
      ok(invalid, "`:popover-open` sigue siendo un selector válido en la página");
      for (const selector of ['[data-z-open="#actions"]', '[data-z-open="#usage"]', '[data-z-open="#filters"]', "#mb-file-trigger"]) {
        await p.locator(selector).first().click();
        await p.keyboard.press("Escape");
      }
      await p.locator('[data-component="Select"] [role="combobox"]').first().click();
      await p.keyboard.press("Escape");
      await p.locator('[data-z-open="#edit-profile"]').click();
      ok(await p.locator("#edit-profile").evaluate((d) => d.open), "el diálogo no se abrió");
      await p.keyboard.press("Escape");
      ok(errors.length === 0, errors.slice(0, 3).join(" | "));
    } finally {
      await p.context().close();
    }
  });
}
