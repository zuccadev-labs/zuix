// Auditoría previa a la 0.2.0 · CSS sobre el binding de React: colores forzados, RTL y tamaño de objetivo.
// Exporta una función que recibe los ayudantes de cases.mjs y devuelve la lista de casos ({ name, run(ctx) }).
export default function ({ t, assert, visible, settled, SCREENS }) {
  const emulate = async (page, features, Unverifiable, browserName) => {
    try {
      await page.emulateMedia(features);
    } catch {
      throw new Unverifiable(`${browserName} no emula ${Object.keys(features).join(", ")}`);
    }
  };
  return [
    {
      name: "Auditoría CSS · forced-colors en React: foco visible en cada pantalla y capas (Modal, Menu, Select) con borde y foco",
      async run({ open, browserName, Unverifiable, note }) {
        let checked = 0;
        for (const screen of [...SCREENS, "audit"]) {
          const page = await open(screen);
          await emulate(page, { forcedColors: "active" }, Unverifiable, browserName);
          if (!(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)))
            throw new Unverifiable(`${browserName} no aplica forced-colors emulado`);
          const report = await page.evaluate(() => {
            const visible = (el) => {
              const r = el.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.height > 0 &&
                getComputedStyle(el).visibility !== "hidden" &&
                !el.closest("[hidden], [inert], [aria-hidden='true']")
              );
            };
            const list = [
              ...document.querySelectorAll(".z-root :is(button, a[href], input:not([type=hidden]), select, textarea, [tabindex='0'])"),
            ].filter((el) => !el.disabled && visible(el) && !el.classList.contains("z-sr-only"));
            const missing = [];
            let checked = 0;
            for (const el of list) {
              el.focus({ preventScroll: true, focusVisible: true });
              if (document.activeElement !== el || !el.matches(":focus-visible")) continue;
              checked += 1;
              const ring = [el, el.closest(".z-input, .z-select, .z-upload, label")].filter(Boolean).some((node) => {
                const s = getComputedStyle(node);
                return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
              });
              if (!ring) missing.push(`<${el.tagName.toLowerCase()} class="${el.className}">`);
            }
            document.activeElement?.blur();
            return { checked, missing: [...new Set(missing)] };
          });
          checked += report.checked;
          assert(
            report.missing.length === 0,
            `${screen}: ${report.missing.length} controles sin anillo de foco en colores forzados: ${report.missing.slice(0, 12).join(" ")}`,
          );
        }
        if (checked < 80)
          throw new Unverifiable(`${browserName} no deja forzar :focus-visible por código: ${checked} controles comprobados`);
        note(`${checked} controles comprobados en ${SCREENS.length + 1} pantallas`);
        const page = await open("overlays");
        await emulate(page, { forcedColors: "active" }, Unverifiable, browserName);
        await page.click(t("open-modal"));
        await visible(page, ".z-modal");
        await settled(page);
        const border = await page.locator(".z-modal").evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
        assert(border >= 1, "en colores forzados el Modal necesita un borde para separarse del fondo");
      },
    },
    {
      name: "Auditoría CSS · WCAG 2.5.8 en React: objetivos de 24 px o con espacio suficiente en todas las pantallas",
      async run({ open, note }) {
        const failing = [];
        let total = 0;
        for (const screen of [...SCREENS, "audit"]) {
          const page = await open(screen);
          const report = await page.evaluate(() => {
            const visible = (el) => {
              const r = el.getBoundingClientRect();
              return (
                r.width > 0 &&
                r.height > 0 &&
                getComputedStyle(el).visibility !== "hidden" &&
                !el.closest("[hidden], [inert], [aria-hidden='true']")
              );
            };
            const targets = [
              ...document.querySelectorAll(
                ".z-root :is(button, a[href], input:not([type=hidden]), select, textarea, [role='slider'], label.z-check, label.z-radio, label.z-switch, label.z-upload)",
              ),
            ].filter(
              (el) =>
                visible(el) &&
                !el.classList.contains("z-sr-only") &&
                !el.disabled &&
                !/z-(tabstrip|shell|sidebar|titlebar|split|resize|statusbar|toolbar)/.test(el.className),
            );
            const box = (el) => (el.closest("label.z-check, label.z-radio, label.z-switch") ?? el).getBoundingClientRect();
            const out = [];
            for (const el of targets) {
              const r = box(el);
              if (r.width >= 23.5 && r.height >= 23.5) continue;
              if (
                el.matches("a") &&
                getComputedStyle(el).display.startsWith("inline") &&
                el.parentElement.textContent.trim() !== el.textContent.trim()
              )
                continue;
              const cx = r.left + r.width / 2,
                cy = r.top + r.height / 2;
              const clash = targets.some((other) => {
                if (other === el || other.contains(el) || el.contains(other)) return false;
                const o = box(other);
                if (o.left === r.left && o.top === r.top && o.width === r.width) return false;
                if (o.width < 24 || o.height < 24) return Math.hypot(cx - (o.left + o.width / 2), cy - (o.top + o.height / 2)) < 24;
                return Math.hypot(Math.max(o.left - cx, 0, cx - o.right), Math.max(o.top - cy, 0, cy - o.bottom)) < 12;
              });
              if (clash) out.push(`<${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(r.width)}×${Math.round(r.height)}`);
            }
            return { total: targets.length, out: [...new Set(out)] };
          });
          total += report.total;
          for (const line of report.out) failing.push(`${screen}: ${line}`);
        }
        note(`${total} objetivos medidos`);
        assert(
          failing.length === 0,
          `${failing.length} objetivos menores de 24 px sin espacio suficiente:\n  ${failing.slice(0, 25).join("\n  ")}`,
        );
      },
    },
  ];
}
