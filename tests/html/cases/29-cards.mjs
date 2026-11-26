// Tarjetas de la 0.5 sin framework: portadas con semilla (la tesela viene en el marcado; setBackdropPattern la cambia
// y hydrate la escribe si falta), enlace extendido de FeatureCard y ModelPicker sobre el Menu de `zui/dom`
// (interruptor con Espacio sin cerrar, opción elegida con la marca al final).

export default async function ({ page, test, ok, card, settle }) {
  await test("Backdrop sin React: tesela de la semilla, hydrate la escribe si falta y setBackdropPattern la cambia", async () => {
    const result = await page.evaluate(async () => {
      const dom = await import("/zui/dist/zui.dom.js");
      const box = document.createElement("div");
      box.setAttribute("data-z-dom", "");
      box.innerHTML =
        '<div class="z-backdrop" data-pattern="stars" data-seed="7"><div class="z-backdrop__layer" aria-hidden="true"></div><div class="z-backdrop__content"></div></div>';
      document.body.append(box);
      dom.hydrate(box);
      const el = box.firstElementChild;
      const first = el.style.getPropertyValue("--z-pattern-tile");
      dom.setBackdropPattern(el, "contours", 3);
      const second = el.style.getPropertyValue("--z-pattern-tile");
      dom.setBackdropPattern(el, "mesh", 3);
      const mesh = [el.style.getPropertyValue("--z-mesh-x1"), el.style.getPropertyValue("--z-pattern-tile")];
      dom.setBackdropPattern(el, "grid");
      const cleared = el.style.getPropertyValue("--z-mesh-x1") + el.style.getPropertyValue("--z-pattern-tile");
      box.remove();
      return { first, second, mesh, cleared, pattern: el.dataset.pattern, seed: el.dataset.seed ?? null };
    });
    ok(result.first.includes("data:image/svg+xml"), "hydrate escribe la tesela de la semilla");
    ok(result.second && result.second !== result.first, "otro patrón, otra tesela");
    ok(/%$/.test(result.mesh[0]) && !result.mesh[1], `malla: manchas sin tesela (${result.mesh})`);
    ok(result.cleared === "" && result.pattern === "grid" && result.seed === null, "sin semilla vuelve a la hoja");
    const stars = card("FeatureCard").locator(".z-backdrop").first();
    const inline = await stars.evaluate((el) => el.style.getPropertyValue("--z-pattern-tile"));
    ok(inline.includes("data:image/svg+xml"), "el contrato trae la tesela en el marcado");
  });

  await test("FeatureCard sin React: un solo enlace cuya zona de clic cubre la tarjeta", async () => {
    const feature = card("FeatureCard").locator(".z-feature-card").first();
    await feature.scrollIntoViewIfNeeded();
    ok((await feature.locator("a").count()) === 1, "un solo enlace");
    const box = await feature.boundingBox();
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.className ?? "",
      [box.x + box.width * 0.8, box.y + 12],
    );
    ok(hit.includes("z-card__link"), `la portada pertenece al enlace (${hit})`);
  });

  await test("ModelPicker sin React: Espacio cambia un interruptor sin cerrar y la opción elegida lleva la marca al final", async () => {
    await page.reload();
    await page.waitForFunction(() => customElements.get("z-icon") && document.querySelector('[data-component="ModelPicker"]'));
    await settle();
    const trigger = card("ModelPicker").locator("button.z-model-picker");
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.waitForFunction(() => document.querySelector("#models")?.matches(":popover-open"), null, { timeout: 3000 });
    const auto = page.locator('#models [role="menuitemcheckbox"]', { hasText: "Auto" });
    ok((await auto.getAttribute("aria-checked")) === "false", "Auto apagado");
    await auto.focus();
    await page.keyboard.press(" ");
    await page.waitForFunction(
      () => document.querySelector('#models [role="menuitemcheckbox"]')?.getAttribute("aria-checked") === "true",
      null,
      {
        timeout: 3000,
      },
    );
    ok(await page.locator("#models").evaluate((el) => el.matches(":popover-open")), "el menú sigue abierto");
    const chosen = page.locator('#models [role="menuitemradio"][aria-checked="true"]');
    ok((await chosen.locator(".z-menu__check[data-end]").count()) === 1, "marca al final del elegido");
    await page.keyboard.press("Escape");
  });
}
