// Binding de React (pantallas `dashboard`, `profile`, `settings`, `kanban` y `login` de examples/app): DashboardGrid
// con teclado y puntero y la disposición guardada por callback, Tracker, KanbanBoard, MemberList, AccountMenu,
// AvatarGroup con lista, ProfileEditor y la página de acceso.
export default function ({ t, assert, poll }) {
  const text = (page, id) => page.locator(t(id)).first().textContent();
  const focused = (page) => page.evaluate(() => document.activeElement?.closest("[data-id]")?.getAttribute("data-id") ?? null);

  return [
    {
      name: "DashboardGrid (React): en edición, Espacio coge, flechas mueven, Intro suelta y onLayoutChange guarda la disposición",
      async run({ open }) {
        const page = await open("dashboard");
        await page.evaluate(() => localStorage.removeItem("zuix-example-dashboard"));
        await page.reload();
        await page.locator(t("dash-edit")).click();
        const handle = page.locator(`${t("dash-grid")} .z-dashboard-grid__item[data-id="revenue"] .z-dashboard-grid__handle`);
        await handle.scrollIntoViewIfNeeded();
        await handle.focus();
        await page.keyboard.press("Space");
        assert((await handle.getAttribute("aria-pressed")) === "true", "aria-pressed al coger");
        for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await poll(async () => /revenue:0,4,8,4/.test((await text(page, "dash-saved")) ?? ""), "onLayoutChange con la pieza abajo");
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("zuix-example-dashboard") ?? "[]"));
        assert(
          saved.some((i) => i.id === "revenue" && i.y === 4),
          "la disposición se guarda",
        );
        const order = await page.locator(`${t("dash-grid")} .z-dashboard-grid__item`).evaluateAll((els) => els.map((e) => e.dataset.id));
        assert(order.indexOf("revenue") > order.indexOf("sources"), `el DOM sigue el orden de lectura: ${order}`);
        await poll(async () => (await focused(page)) === "revenue", "el foco vuelve al asa de la pieza");
        // Mayús + flechas redimensionan; Escape cancela sin avisar.
        await page.keyboard.press("Space");
        await page.keyboard.press("Shift+ArrowLeft");
        await page.keyboard.press("Escape");
        assert(
          (await page.locator(`${t("dash-grid")} .z-dashboard-grid__item[data-id="revenue"]`).getAttribute("data-w")) === "8",
          "Escape devuelve el ancho",
        );
        await page.locator(t("dash-reset")).click();
      },
    },
    {
      name: "DashboardGrid (React): arrastrar el asa con el puntero mueve la pieza y avisa al soltar",
      async run({ open }) {
        const page = await open("dashboard");
        await page.evaluate(() => localStorage.removeItem("zuix-example-dashboard"));
        await page.reload();
        await page.locator(t("dash-edit")).click();
        const item = (id) => page.locator(`${t("dash-grid")} .z-dashboard-grid__item[data-id="${id}"]`);
        await item("goal").scrollIntoViewIfNeeded();
        const handle = item("goal").locator(".z-dashboard-grid__handle");
        const a = await handle.boundingBox();
        const from = await item("goal").boundingBox();
        const to = await item("uptime").boundingBox();
        const x = a.x + a.width / 2;
        const y = a.y + a.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + 20, { steps: 3 });
        await page.mouse.move(x, y + (to.y - from.y) + 10, { steps: 10 });
        assert((await page.locator(`${t("dash-grid")} .z-dashboard-grid[data-dragging]`).count()) === 1, "estado de arrastre");
        await page.mouse.up();
        await poll(async () => /goal:8,6/.test((await text(page, "dash-saved")) ?? ""), "la meta baja bajo el estado de la API");
        assert(/uptime:8,4/.test((await text(page, "dash-saved")) ?? ""), "el estado de la API sube");
        await page.locator(t("dash-reset")).click();
      },
    },
    {
      name: "Tracker (React): una parada, flechas entre días y etiqueta del día activo",
      async run({ open }) {
        const page = await open("dashboard");
        const bars = page.locator(`${t("dash-tracker")} .z-tracker__bar`);
        await bars.last().scrollIntoViewIfNeeded();
        assert((await page.locator(`${t("dash-tracker")} .z-tracker__bar[tabindex="0"]`).count()) === 1, "una sola parada");
        await bars.last().focus();
        for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowLeft");
        await poll(
          async () => (await page.locator(`${t("dash-tracker")} .z-tracker__tip-text`).textContent()) === "Nov 7: Degraded, 12 min",
          "día degradado",
        );
        const sr = await bars.nth(29).locator(".z-sr-only").textContent();
        assert(sr === "Nov 7: Degraded, 12 min", `texto del día: ${sr}`);
      },
    },
    {
      name: "KanbanBoard (React): mover con el teclado a otra columna avisa con onMove y conserva el foco",
      async run({ open }) {
        const page = await open("kanban");
        const card = page.locator(`${t("kb-board")} .z-kanban__card[data-id="k1"]`);
        await card.focus();
        await page.keyboard.press("Space");
        await poll(async () => (await card.getAttribute("data-grabbed")) === "key", "cogida");
        await page.keyboard.press("ArrowRight");
        await poll(
          async () => (await page.locator(`${t("kb-board")} [data-column="doing"] .z-kanban__card[data-id="k1"]`).count()) === 1,
          "pasa a In progress",
        );
        await poll(async () => (await focused(page)) === "k1", "el foco sigue en la tarjeta");
        await page.keyboard.press("Enter");
        await poll(async () => (await text(page, "kb-last")) === "k1 → doing #1", "onMove");
        await page.keyboard.press("Enter");
        await poll(async () => (await text(page, "kb-last")) === "Opened k1", "Intro sin coger abre la tarjeta");
        const count = await page.locator(`${t("kb-board")} [data-column="doing"] .z-kanban__count`).getAttribute("aria-label");
        assert(/3 of 3/.test(count ?? "") === false || count === null, "sin aviso de límite con 3 de 3");
      },
    },
    {
      name: "KanbanBoard (React): arrastrar una tarjeta con el puntero a otra columna",
      async run({ open }) {
        const page = await open("kanban");
        const card = page.locator(`${t("kb-board")} .z-kanban__card[data-id="k2"]`);
        const target = page.locator(`${t("kb-board")} .z-kanban__column[data-column="doing"]`);
        const a = await card.boundingBox();
        const b = await target.boundingBox();
        await page.mouse.move(a.x + 30, a.y + 12);
        await page.mouse.down();
        await page.mouse.move(a.x + 50, a.y + 30, { steps: 3 });
        await page.mouse.move(b.x + b.width / 2, b.y + 70, { steps: 10 });
        await poll(
          async () => (await page.locator(`${t("kb-board")} [data-column="doing"] .z-kanban__placeholder`).count()) === 1,
          "hueco en el destino",
        );
        await page.mouse.up();
        await poll(async () => /^k2 → doing #/.test((await text(page, "kb-last")) ?? ""), "onMove al soltar");
        await poll(
          async () => (await page.locator(`${t("kb-board")} [data-column="doing"] .z-kanban__card[data-id="k2"]`).count()) === 1,
          "la tarjeta queda en la columna",
        );
      },
    },
    {
      name: "MemberList (React): buscar, cambiar de rol y quitar avisan a la aplicación",
      async run({ open }) {
        const page = await open("profile");
        const list = page.locator(t("pp-members"));
        await list.locator("[data-search]").fill("yuki");
        await poll(async () => (await list.locator(".z-member-list__row").count()) === 1, "filtra");
        await list.locator("[data-search]").fill("");
        await list.locator('select[data-member="m3"]').selectOption("admin");
        await poll(async () => (await text(page, "pp-log")) === "Role of m3: admin", "onRoleChange");
        await poll(
          async () => (await list.locator('.z-member-list__group-title:has-text("Admin") + ul .z-member-list__row').count()) === 2,
          "Yuki pasa a Admin",
        );
        await list.locator('[data-remove="m5"]').click();
        await poll(async () => (await text(page, "pp-log")) === "Removed m5", "onRemove");
        await poll(async () => (await list.locator('[data-id="m5"]').count()) === 0, "la fila desaparece");
      },
    },
    {
      name: "AccountMenu y AvatarGroup (React): menú de cuenta con tema y lista de sobrantes",
      async run({ open }) {
        const page = await open("profile");
        const trigger = page.locator(".z-account-menu");
        assert((await trigger.locator(".z-sr-only").textContent()) === "Account of Ana López", "nombre del botón");
        await trigger.click();
        await poll(async () => (await page.locator(".z-account-menu__menu[role=menu]").count()) === 1, "abre el menú");
        await page.locator('.z-account-menu__menu [role=menuitemradio]:has-text("Light")').click();
        await poll(async () => (await page.locator(".z-account-menu__menu").count()) === 0, "elegir cierra");
        await trigger.click();
        await poll(
          async () => (await page.locator('.z-account-menu__menu [role=menuitemradio][aria-checked=true]:has-text("Light")').count()) === 1,
          "tema marcado",
        );
        await page.keyboard.press("Escape");
        await poll(
          () => page.evaluate(() => document.activeElement?.classList.contains("z-account-menu")),
          "Escape devuelve el foco al botón",
        );
        const more = page.locator(`${t("pp-group")} .z-avatar-group__more`);
        await more.scrollIntoViewIfNeeded();
        assert((await more.locator(".z-sr-only").textContent()) === "Show 2 more people", "nombre del +N");
        await more.click();
        await poll(async () => (await page.locator(".z-avatar-group__popover .z-persona").count()) === 2, "lista de sobrantes");
        await page.keyboard.press("Escape");
        await poll(async () => (await page.locator(".z-avatar-group__popover").count()) === 0, "Escape la cierra");
      },
    },
    {
      name: "ProfileEditor (React): error al salir, foco al primero al guardar y onSubmit con todo válido",
      async run({ open }) {
        const page = await open("settings");
        const form = page.locator(t("st-editor"));
        const handle = form.locator('input[name="handle"]');
        await handle.fill("admin");
        await handle.blur();
        await poll(async () => (await handle.getAttribute("aria-invalid")) === "true", "usuario ocupado");
        assert((await form.locator(".z-profile-editor__error").textContent())?.includes("That username is taken"), "mensaje del error");
        const name = form.locator('input[name="name"]');
        await name.fill("");
        await form.locator('button[type="submit"]').click();
        await poll(() => page.evaluate(() => document.activeElement?.getAttribute("name") === "name"), "el foco va al primero con error");
        await name.fill("Ana López");
        await handle.fill("ana_lopez");
        await form.locator('button[type="submit"]').click();
        await poll(async () => (await text(page, "st-submitted")) === "Saved @ana_lopez", "onSubmit");
      },
    },
    {
      name: "SettingRow y AuthLayout (React): estado guardado anunciado y acceso con passkey o contraseña",
      async run({ open }) {
        const page = await open("settings");
        await page.locator(t("st-mentions")).click();
        await poll(async () => (await page.locator('.z-setting-row__status[data-status="saved"]').count()) === 1, "Saved");
        assert((await page.locator('label[for="st-mentions"]').count()) === 1, "etiqueta unida al control");
        const login = await open("login");
        assert((await login.locator(`${t("auth")} h1`).textContent()) === "Welcome back", "un h1");
        await login.locator(t("auth-email")).fill("ana@acme.dev");
        await login.locator('input[name="password"]').fill("hunter22");
        await login.locator(t("auth-submit")).click();
        await poll(async () => (await text(login, "auth-sent")) === "Signing in as ana@acme.dev", "envío");
        await login.locator(t("auth-variant")).click();
        await poll(async () => (await login.locator('.z-auth-layout[data-variant="split"]').count()) === 1, "variante dividida");
      },
    },
  ];
}
