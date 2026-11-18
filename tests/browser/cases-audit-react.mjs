// Auditoría previa a 0.1.1 · componentes de zui sin caso propio en React (cobertura).
// Recorre la pantalla `?screen=audit` de examples/app (examples/app/src/screens/audit): un ejemplar de cada
// componente interactivo con `data-testid` estables. Exporta una función que recibe los ayudantes de cases.mjs.
export default function ({ t, assert, poll, until, visible, gone, settled, focusOn, expectAttr, expectText, expectCount, sleep }) {
  const out = (page, id, value, message) => expectText(page, t(id), String(value), message ?? `${id} = ${value}`);
  // La tecla se mantiene un instante y hay una pausa entre pulsaciones, como las de una persona: el foco itinerante y
  // la búsqueda por tecleo se asientan entre una y otra.
  const press = async (page, ...keys) => {
    for (const key of keys) {
      await page.keyboard.press(key, { delay: 50 });
      await sleep(50);
    }
  };
  const inside = (page, selector) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.left >= -0.5 && r.top >= -0.5 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5;
      });
  const audit = (open, options) => open("audit", options);

  return [
    {
      name: "Auditoría · acciones: Button con carga, IconButton, Link deshabilitado y externo, SegmentedControl y Toggle",
      async run({ open }) {
        const page = await audit(open);
        await page.click(t("a-btn"));
        await page.click(t("a-iconbtn"));
        await out(page, "a-btn-clicks", 2);
        await page.click(t("a-btn-toggle-loading"));
        await expectAttr(page, t("a-btn"), "aria-busy", "true");
        assert(await page.locator(t("a-btn")).isDisabled(), "un botón en carga queda deshabilitado");
        assert((await page.locator(`${t("a-btn")} .z-btn__spinner`).count()) === 1, "el anillo sustituye al icono");
        // 0.2.0: en carga lleva aria-disabled (no `disabled`): no actúa, pero conserva el foco del teclado.
        assert(
          (await page.locator(t("a-btn")).getAttribute("aria-disabled")) === "true" &&
            (await page.locator(t("a-btn")).getAttribute("disabled")) === null,
          "en carga: aria-disabled, sin el atributo disabled",
        );
        await page.locator(t("a-btn")).focus();
        await focusOn(page, t("a-btn"), "un botón en carga conserva el foco");
        await press(page, "Enter", "Space");
        await page.locator(t("a-btn")).click({ force: true });
        await out(page, "a-btn-clicks", 2, "un botón en carga no ejecuta onClick");
        assert((await page.locator(t("a-iconbtn")).getAttribute("aria-label")) === "Favorite", "IconButton sin nombre accesible");
        await page.click(t("a-link"));
        await out(page, "a-link-clicks", 1);
        const off = page.locator(t("a-link-disabled"));
        assert(
          (await off.getAttribute("href")) === null &&
            (await off.getAttribute("aria-disabled")) === "true" &&
            (await off.getAttribute("role")) === "link",
          "enlace deshabilitado: sin href, aria-disabled y role=link",
        );
        await off.click({ force: true });
        await out(page, "a-link-clicks", 1, "un enlace deshabilitado no ejecuta onClick");
        const ext = page.locator(t("a-link-external"));
        assert(
          (await ext.getAttribute("target")) === "_blank" && /noopener/.test(await ext.getAttribute("rel")),
          "enlace externo sin target o rel",
        );
        assert(/opens in a new tab/.test(await ext.textContent()), "enlace externo sin texto para lectores de pantalla");
        // SegmentedControl: siempre queda una opción; la deshabilitada no se elige; flechas.
        const seg = `${t("a-seg")} .z-segmented__item`;
        await page.locator(seg).nth(1).click();
        await out(page, "a-seg-value", "board");
        await page.locator(seg).nth(1).click();
        await out(page, "a-seg-value", "board", "volver a pulsar la opción elegida no la quita");
        await page.locator(seg).nth(2).click({ force: true });
        await out(page, "a-seg-value", "board", "la opción deshabilitada no se elige");
        await page.locator(seg).nth(1).focus();
        await press(page, "ArrowRight", "Enter");
        await out(page, "a-seg-value", "table", "las flechas saltan la opción deshabilitada");
        await page.click(t("a-toggle"));
        await out(page, "a-toggle-value", "on");
        await expectAttr(page, t("a-toggle"), "aria-pressed", "true");
        await page.locator(t("a-toggle")).press("Space");
        await out(page, "a-toggle-value", "off");
        assert((await page.locator(t("a-toggle-icon")).getAttribute("aria-label")) === "Favorite", "Toggle de solo icono sin nombre");
      },
    },
    {
      name: "Auditoría · formularios: Checkbox indeterminado, RadioGroup, Switch, Slider con teclado y dos tiradores",
      async run({ open }) {
        const page = await audit(open);
        await expectAttr(page, t("a-check"), "aria-checked", "mixed");
        await page.click(t("a-check"));
        await out(page, "a-check-value", "true");
        await page.locator(t("a-check")).press("Enter");
        await out(page, "a-check-value", "true", "Intro no cambia una casilla");
        await page.locator(t("a-check")).press("Space");
        await out(page, "a-check-value", "false");
        assert(await page.locator(t("a-check-disabled")).isDisabled(), "casilla deshabilitada");
        const radios = `${t("a-radio")} [role="radio"]`;
        await page.locator(radios).first().focus();
        await press(page, "ArrowDown");
        await out(page, "a-radio-value", "phone");
        await press(page, "ArrowDown");
        await out(page, "a-radio-value", "post", "las flechas saltan el radio deshabilitado");
        await press(page, "ArrowDown");
        await out(page, "a-radio-value", "email", "las flechas dan la vuelta");
        assert((await page.locator(`${radios}[tabindex="0"]`).count()) === 1, "foco itinerante: un solo radio tabulable");
        await page.click(t("a-switch"));
        await out(page, "a-switch-value", "on");
        await expectAttr(page, t("a-switch"), "role", "switch");
        await page.locator(t("a-switch")).press("Space");
        await out(page, "a-switch-value", "off");
        assert(await page.locator(t("a-switch-disabled")).isDisabled(), "interruptor deshabilitado");
        const thumb = page.locator(`${t("a-slider")} [role="slider"]`);
        assert((await thumb.getAttribute("aria-label")) === "Volume", "tirador sin nombre");
        await thumb.focus();
        await press(page, "ArrowRight");
        await out(page, "a-slider-value", 45);
        await press(page, "PageUp");
        await out(page, "a-slider-value", 95);
        await press(page, "End");
        await out(page, "a-slider-value", 100);
        await press(page, "Home", "ArrowUp");
        await out(page, "a-slider-value", 5);
        const range = page.locator(`${t("a-slider-range")} [role="slider"]`);
        assert(
          (await range.nth(0).getAttribute("aria-label")) === "Minimum" && (await range.nth(1).getAttribute("aria-label")) === "Maximum",
          "thumbLabels no nombra cada tirador",
        );
        await range.nth(0).focus();
        await press(page, "End");
        const [low, high] = (await page.locator(t("a-range-value")).textContent()).split(",").map(Number);
        assert(low <= high && high <= 100 && low >= 0, `los tiradores no se cruzan ni salen del rango (${low},${high})`);
        assert(
          (await page.locator(`${t("a-slider-disabled")} .z-slider`).getAttribute("data-disabled")) !== null,
          "slider deshabilitado sin data-disabled",
        );
      },
    },
    {
      name: "Auditoría · formularios: OTPInput, SearchInput, Input, Textarea autoRows, DateInput y NativeSelect",
      async run({ open, note, browserName }) {
        const page = await audit(open);
        const cells = page.locator(`${t("a-otp")} .z-otp__cell`);
        await cells.first().click();
        await page.keyboard.type("12a3");
        await out(page, "a-otp-value", "123", "numeric descarta letras");
        await cells.nth(1).focus();
        await press(page, "Delete");
        await out(page, "a-otp-value", "13", "Supr borra la casilla");
        await press(page, "End");
        await cells.nth(2).focus();
        await press(page, "Backspace");
        await page.evaluate(() => navigator.clipboard?.writeText?.("9876").catch(() => {}));
        await cells.first().evaluate((el) => {
          const data = new DataTransfer();
          data.setData("text", "98 76");
          el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
        });
        // Firefox no entrega `clipboardData` en un evento de pegado sintético: allí el código entero entra como lo
        // escribe el autocompletado del sistema (todo el texto en la primera casilla), que usa el mismo reparto.
        await sleep(300);
        if ((await page.locator(t("a-otp-value")).textContent()).trim() !== "9876") {
          note(`OTPInput: ${browserName} no admite pegado sintético; verificado con el código completo escrito en la primera casilla`);
          await cells.first().fill("9876");
        }
        await out(page, "a-otp-value", "9876", "pegar rellena todas las casillas");
        await out(page, "a-otp-complete", "9876");
        assert((await page.locator(`${t("a-otp")} input[type="hidden"]`).inputValue()) === "9876", "campo oculto con el código");
        assert(
          (await page.locator(`${t("a-otp")} [role="group"]`).getAttribute("aria-label")) === "Verification code" &&
            (await page.locator(`${t("a-otp-text")} [role="group"]`).getAttribute("aria-label")) === "Invite code",
          "nombre del grupo OTP",
        );
        assert((await cells.first().getAttribute("autocomplete")) === "one-time-code", "autocomplete one-time-code");
        // SearchInput
        const search = page.locator(t("a-search"));
        await search.fill("atlas");
        await out(page, "a-search-value", "atlas");
        await search.press("Enter");
        await out(page, "a-search-submitted", "atlas");
        await search.press("Escape");
        await out(page, "a-search-value", "empty", "Escape limpia");
        await out(page, "a-search-cleared", 1);
        await search.fill("x");
        await page
          .locator(`${t("a-search-cell")} .z-input__action`)
          .first()
          .click();
        await out(page, "a-search-cleared", 2);
        await focusOn(page, t("a-search"), "limpiar devuelve el foco al campo");
        await search.fill("y");
        await page.click(t("a-search-loading"));
        assert(
          (await page
            .locator(`${t("a-search-cell")} .z-input--search`)
            .first()
            .locator(".z-input__spinner")
            .count()) === 1,
          "loading muestra el anillo en lugar del botón",
        );
        assert((await page.locator(t("a-search-unc")).inputValue()) === "draft", "defaultValue sin controlar");
        // Input
        const input = page.locator(t("a-input"));
        await input.fill("ab");
        await expectAttr(page, t("a-input"), "aria-invalid", "true");
        await input.fill("abc");
        assert((await input.getAttribute("aria-invalid")) === null, "aria-invalid se retira");
        // Textarea
        for (const id of ["a-ta-ctl", "a-ta-unc"]) {
          const area = page.locator(t(id));
          assert((await area.getAttribute("rows")) === "2", `${id}: filas iniciales`);
          await area.fill("1\n2\n3\n4");
          await expectAttr(page, t(id), "rows", "4", `${id}: autoRows crece con el contenido`);
          await area.fill("1\n2\n3\n4\n5\n6\n7");
          await expectAttr(page, t(id), "rows", "5", `${id}: autoRows respeta maxRows`);
        }
        // DateInput
        const date = page.locator(`${t("a-dateinput")} input`);
        assert((await date.getAttribute("type")) === "date" && (await date.inputValue()) === "2026-03-10", "DateInput: tipo y valor ISO");
        assert(
          (await page.locator(`${t("a-dateinput")} .z-input__action`).getAttribute("aria-label")) === "Open picker",
          "botón del selector sin nombre",
        );
        await page.locator(`${t("a-dateinput")} .z-input__action`).click();
        assert(await page.locator(`${t("a-dateinput-disabled")} .z-input__action`).isDisabled(), "selector deshabilitado");
        // NativeSelect
        const native = page.locator(t("a-native"));
        assert(
          (await native.inputValue()) === "" && (await native.evaluate((el) => el.selectedOptions[0]?.textContent)) === "Choose a letter",
          "NativeSelect debe mostrar el placeholder sin defaultValue",
        );
        await native.selectOption("beta");
        await out(page, "a-native-value", "beta");
      },
    },
    {
      name: "Auditoría · FileUpload real: accept, maxSize, multiple, rechazo, arrastrar y soltar, envío en formulario y deshabilitado",
      async run({ open }) {
        const page = await audit(open);
        const file = (name, size = 10, mimeType = "text/plain") => ({ name, mimeType, buffer: Buffer.alloc(size, 97) });
        await page
          .locator(`${t("a-upload")} input[type="file"]`)
          .setInputFiles([
            file("a.txt"),
            file("big.txt", 2000),
            file("pic.png", 20, "image/png"),
            file("app.exe", 5, "application/octet-stream"),
          ]);
        await out(page, "a-upload-accepted", "a.txt,pic.png");
        await out(page, "a-upload-rejected", "big.txt,app.exe");
        await page.click(t("a-upload-submit"));
        await out(page, "a-upload-submitted", "a.txt,pic.png", "con `name`, el formulario envía los archivos aceptados");
        // Arrastrar y soltar.
        const zone = page.locator(`${t("a-upload")} .z-upload`);
        const transfer = await page.evaluateHandle(() => {
          const data = new DataTransfer();
          data.items.add(new File(["hello"], "drop.txt", { type: "text/plain" }));
          return data;
        });
        await zone.dispatchEvent("dragover", { dataTransfer: transfer });
        await expectAttr(page, `${t("a-upload")} .z-upload`, "data-dragging", "true");
        await zone.evaluate((el) =>
          el.dispatchEvent(
            new DragEvent("dragleave", { bubbles: true, relatedTarget: el.querySelector('[data-testid="a-upload-child"]') }),
          ),
        );
        assert((await zone.getAttribute("data-dragging")) === "true", "pasar sobre un hijo no quita data-dragging");
        await zone.dispatchEvent("drop", { dataTransfer: transfer });
        await out(page, "a-upload-accepted", "drop.txt");
        assert((await zone.getAttribute("data-dragging")) === null, "soltar quita data-dragging");
        await page.locator(`${t("a-upload-single")} input[type="file"]`).setInputFiles([file("one.txt")]);
        await out(page, "a-upload-single-value", "one.txt");
        assert(
          (await page.locator(`${t("a-upload-single")} input[type="file"]`).evaluate((el) => el.files.length)) === 0,
          "sin `name` el campo se vacía para poder repetir el archivo",
        );
        const off = page.locator(`${t("a-upload-disabled")} .z-upload`);
        await off.dispatchEvent("drop", { dataTransfer: transfer });
        await out(page, "a-upload-disabled-count", 0, "una zona deshabilitada no entrega archivos");
        assert(await page.locator(`${t("a-upload-disabled")} input`).isDisabled(), "input deshabilitado");
      },
    },
    {
      name: "Auditoría · Field: etiqueta, ayuda y error enlazados con cada tipo de control (incluidos los no etiquetables)",
      async run({ open }) {
        const page = await audit(open);
        const report = await page.evaluate(() => {
          const bad = [];
          for (const wrap of document.querySelectorAll("[data-field]")) {
            const id = wrap.dataset.testid;
            const label = wrap.querySelector(".z-field__label");
            const hint = wrap.querySelector(".z-field__hint");
            const error = wrap.querySelector(".z-field__error");
            const control = document.getElementById(label.htmlFor);
            const text = label.firstChild.textContent.trim();
            // Controles etiquetables: <label for>. Los demás: aria-labelledby a la etiqueta.
            const labelled = [...wrap.querySelectorAll(`[aria-labelledby~="${CSS.escape(label.id)}"]`)];
            const named = control?.matches("input, select, textarea, button") || labelled.length > 0 || wrap.querySelector("[aria-label]");
            if (!named) bad.push(`${id}: nada queda nombrado por la etiqueta "${text}"`);
            const described = [...wrap.querySelectorAll("[aria-describedby]")].filter((el) =>
              el.getAttribute("aria-describedby").split(" ").includes(hint.id),
            );
            if (!described.length) bad.push(`${id}: la ayuda no está en aria-describedby de ningún control`);
            if (error) {
              if (error.getAttribute("role") !== "alert") bad.push(`${id}: el error no es role=alert`);
              if (!described.some((el) => el.getAttribute("aria-describedby").split(" ").includes(error.id)))
                bad.push(`${id}: el error no está en aria-describedby`);
              if (!wrap.querySelector('[aria-invalid="true"], [data-invalid]'))
                bad.push(`${id}: el control no queda marcado como inválido`);
            }
          }
          const radio = document.querySelector('[data-testid="f-radio"] [role="radiogroup"]');
          const otp = document.querySelector('[data-testid="f-otp"] [role="group"]');
          const thumb = document.querySelector('[data-testid="f-slider"] [role="slider"]');
          const name = (el) =>
            (el?.getAttribute("aria-labelledby") ?? "")
              .split(" ")
              .map((id) => document.getElementById(id)?.firstChild?.textContent.trim())
              .join(" ");
          if (name(radio) !== "Plan") bad.push(`radiogroup sin nombre de la etiqueta (${name(radio)})`);
          if (name(otp) !== "Code") bad.push(`grupo OTP sin nombre de la etiqueta (${name(otp)})`);
          if (name(thumb) !== "Volume") bad.push(`tirador de Slider sin nombre de la etiqueta (${name(thumb)})`);
          if (!document.querySelector('[data-testid="f-input"] input').required) bad.push("required no llega al input");
          return bad;
        });
        assert(report.length === 0, report.join(" | "));
        // Pulsar la etiqueta enfoca el control.
        await page.locator(`${t("f-input")} .z-field__label`).click();
        await focusOn(page, `${t("f-input")} input`);
        // En un Select la etiqueta activa el disparador: se abre la lista.
        await page.locator(`${t("f-select")} .z-field__label`).click();
        await visible(page, '[role="listbox"]', "pulsar la etiqueta de un Field abre su Select");
        await page.keyboard.press("Escape");
      },
    },
    {
      name: "Auditoría · datos: Rating (lectura, clic, teclado, fuera de rango, deshabilitado), Chip, Avatar y fila clicable de DataTable",
      async run({ open }) {
        const page = await audit(open);
        const read = page.locator(`${t("a-rating-read")} .z-rating__stars`);
        assert(
          (await read.getAttribute("role")) === "img" && (await read.getAttribute("aria-label")) === "Rating: 3.5 out of 5",
          "Rating en lectura: role=img con valor",
        );
        assert(
          (await page.locator(`${t("a-rating-read")} .z-rating__layer--filled`).evaluate((el) => el.style.width)) === "70%",
          "capa rellena al 70 %",
        );
        const star = (n, scope = "a-rating") => page.locator(`${t(scope)} [data-star="${n}"]`);
        await star(4).click();
        await out(page, "a-rating-value", 4);
        await expectAttr(page, `${t("a-rating")} [data-star="4"]`, "aria-checked", "true");
        assert((await page.locator(`${t("a-rating")} [data-filled]`).count()) === 4, "cuatro estrellas rellenas");
        await press(page, "ArrowRight");
        await out(page, "a-rating-value", 5);
        await press(page, "ArrowRight");
        await out(page, "a-rating-value", 5, "no pasa del máximo");
        await press(page, "Home");
        await out(page, "a-rating-value", 1, "Inicio lleva al mínimo");
        await press(page, "End");
        await out(page, "a-rating-value", 5, "Fin lleva al máximo");
        await press(page, "ArrowLeft", "ArrowDown");
        await out(page, "a-rating-value", 3);
        await focusOn(page, `${t("a-rating")} [data-star="3"]`, "el foco sigue a la estrella elegida");
        assert(
          (await page.locator(`${t("a-rating-over")} [tabindex="0"]`).count()) === 1,
          "con un valor mayor que max sigue habiendo una estrella tabulable",
        );
        assert(await star(1, "a-rating-disabled").isDisabled(), "Rating deshabilitado");
        // Chip
        const chip = page.locator(`${t("a-chip")} .z-chip__main`);
        await expectAttr(page, `${t("a-chip")} .z-chip__main`, "aria-pressed", "false");
        await chip.click();
        await out(page, "a-chip-value", "selected");
        await expectAttr(page, `${t("a-chip")} .z-chip__main`, "aria-pressed", "true");
        await chip.press("Enter");
        await out(page, "a-chip-value", "idle");
        const remove = page.locator(`${t("a-chip-remove")} .z-chip__remove`);
        assert((await remove.getAttribute("aria-label")) === "Remove tag", "botón de quitar sin nombre");
        await remove.click();
        await out(page, "a-chip-removed", 1);
        assert(
          (await page.locator(`${t("a-chip-disabled")} .z-chip__main`).isDisabled()) &&
            (await page.locator(`${t("a-chip-disabled")} .z-chip__remove`).isDisabled()),
          "chip deshabilitado",
        );
        // Avatar
        await until(page, () => !document.querySelector('[data-testid="a-avatar-broken"] img'), "la imagen rota deja paso a las iniciales");
        const broken = page.locator(t("a-avatar-broken"));
        assert(
          (await broken.locator(".z-avatar__initials").textContent()) === "MR" &&
            (await broken.getAttribute("role")) === "img" &&
            (await broken.getAttribute("aria-label")) === "Marta Ruiz",
          "respaldo con iniciales y nombre accesible",
        );
        assert(
          (await page.locator(`${t("a-avatar-initials")} .z-avatar__status`).getAttribute("aria-label")) === "Busy",
          "estado con nombre",
        );
        assert(
          (await page.locator(`${t("a-avatar-group")} .z-avatar--overflow`).getAttribute("aria-label")) === "2 more" &&
            (await page.locator(`${t("a-avatar-group")} > .z-avatar`).count()) === 3,
          "AvatarGroup resume los sobrantes",
        );
        // DataTable
        const rows = `${t("a-table")} tbody tr`;
        await page.locator(rows).nth(1).focus();
        await press(page, "Enter");
        await out(page, "a-table-row", "r2");
        await expectAttr(page, `${rows} >> nth=1`, "data-selected", "true");
        await page.locator(rows).nth(2).focus();
        await press(page, "Space");
        await out(page, "a-table-row", "r3");
        await page
          .locator(`${t("a-table")} .z-table__sort`)
          .nth(1)
          .click();
        await expectAttr(page, `${t("a-table")} th >> nth=1`, "aria-sort", "ascending");
        assert((await page.locator(rows).first().locator("td").first().textContent()) === "Borealis", "orden por número");
        await page
          .locator(`${t("a-table")} .z-table__sort`)
          .nth(2)
          .click();
        assert((await page.locator(rows).first().locator("td").first().textContent()) === "Borealis", "orden por fecha");
      },
    },
    {
      name: "Auditoría · estado: Alert, ErrorBoundary (vista por defecto, reintento, resetKey, fallback, onError), LoadingOverlay y CodeBlock",
      async run({ open, browserName, note }) {
        const page = await audit(open);
        await expectAttr(page, t("a-alert-info"), "role", "status");
        await expectAttr(page, t("a-alert-danger"), "role", "alert");
        await page.locator(`${t("a-alert-danger")} .z-alert__dismiss`).click();
        await gone(page, t("a-alert-danger"));
        await out(page, "a-alert-count", 1);
        assert((await page.locator(`${t("a-alert-static")} .z-alert__dismiss`).count()) === 0, "sin onDismiss no hay botón de cierre");
        // LoadingOverlay
        assert((await page.locator(t("a-loading")).count()) === 0, "visible=false no monta la capa");
        await page.click(t("a-loading-toggle"));
        await expectAttr(page, t("a-loading"), "role", "status");
        assert(/Saving changes/.test(await page.locator(t("a-loading")).textContent()), "mensaje visible");
        await expectAttr(page, t("a-loading-label"), "aria-label", "Fetching");
        const cover = await page.evaluate(() => {
          const host = document.querySelector('[data-testid="a-loading-host"]').getBoundingClientRect();
          const layer = document.querySelector('[data-testid="a-loading"]').getBoundingClientRect();
          return Math.abs(host.width - layer.width) < 2 && Math.abs(host.height - layer.height) < 2;
        });
        assert(cover, "la capa cubre su contenedor");
        await page.click(t("a-loading-toggle"));
        await gone(page, t("a-loading"));
        // CodeBlock
        const pre = page.locator(`${t("a-code")} pre`);
        assert(
          (await pre.getAttribute("tabindex")) === "0" &&
            (await pre.getAttribute("role")) === "region" &&
            (await pre.getAttribute("aria-label")) === "Code",
          "región de código enfocable y con nombre",
        );
        if (browserName === "chromium") {
          await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
          await page.locator(`${t("a-code")} .z-code__copy`).click();
          await out(page, "a-code-copied", "copied:43");
          await expectAttr(page, `${t("a-code")} .z-code__copy`, "data-copied", "true");
          assert(
            (await page.evaluate(() => navigator.clipboard.readText())) === "pnpm add @zuccadev-labs/zuix-zui\npnpm check",
            "el portapapeles recibe el código",
          );
        } else
          note(`CodeBlock copiar: ${browserName} no deja conceder el permiso de portapapeles en Playwright; verificado solo en chromium`);
      },
    },
    {
      // React escribe en consola el error capturado por un límite de errores: es lo esperado en este caso y solo aquí.
      name: "Auditoría · ErrorBoundary: captura, vista por defecto, reintento, resetKey, fallback y onError",
      expectConsole: /audit bomb|The above error occurred|ErrorBoundary|error boundary/i,
      async run({ open }) {
        const page = await audit(open);
        await visible(page, `${t("a-eb")} ${t("a-eb-ok")}`);
        await page.click(t("a-eb-arm"));
        await visible(page, `${t("a-eb")} .z-empty--error`);
        await expectAttr(page, `${t("a-eb")} .z-empty--error`, "role", "alert");
        await out(page, "a-eb-errors", 1, "onError recibe el error");
        const retry = page.locator(`${t("a-eb")} .z-empty--error button`);
        assert((await retry.textContent()).trim() === "Retry now", "retryLabel");
        await retry.click();
        await visible(page, `${t("a-eb")} .z-empty--error`, "reintentar con el fallo presente vuelve a mostrar el error");
        await page.click(t("a-eb-disarm"));
        await page.locator(`${t("a-eb")} .z-empty--error button`).click();
        await visible(page, `${t("a-eb")} ${t("a-eb-ok")}`, "reintentar tras reparar recupera el contenido");
        await page.click(t("a-eb-arm"));
        await visible(page, `${t("a-eb")} .z-empty--error`);
        await page.click(t("a-eb-disarm"));
        await page.click(t("a-eb-key"));
        await visible(page, `${t("a-eb")} ${t("a-eb-ok")}`, "cambiar resetKey descarta el error");
        await page.click(t("a-eb-custom-arm"));
        await visible(page, t("a-eb-custom-fallback"));
        assert(/Custom: audit bomb/.test(await page.locator(t("a-eb-custom-fallback")).textContent()), "fallback recibe el error");
        await page.click(t("a-eb-custom-disarm"));
        await page.click(t("a-eb-custom-reset"));
        await visible(page, `${t("a-eb-custom")} ${t("a-eb-ok")}`, "reset del fallback recupera el contenido");
      },
    },
    {
      name: "Auditoría · navegación: Stepper, NavList/NavLink, Breadcrumb y Pagination de React",
      async run({ open }) {
        const page = await audit(open);
        const steps = `${t("a-stepper")} .z-stepper__step`;
        assert(
          (await page.locator(`${steps}[data-state="complete"]`).count()) === 2 &&
            (await page.locator(`${steps}[aria-current="step"]`).count()) === 1,
          "estados de los pasos",
        );
        assert((await page.locator(`${steps} button`).count()) === 2, "solo los pasos completos son botones");
        assert(
          /Completed/.test(await page.locator(steps).first().textContent()) &&
            /Current/.test(await page.locator(steps).nth(2).textContent()),
          "texto de estado para lectores de pantalla",
        );
        await page.locator(`${steps} button`).first().click();
        await out(page, "a-stepper-value", 0);
        for (let i = 0; i < 4; i++) await page.click(t("a-stepper-next"));
        await out(page, "a-stepper-value", 4);
        assert((await page.locator(`${steps}[data-state="complete"]`).count()) === 4, "current = steps.length deja todos completos");
        assert(
          (await page.locator(`${t("a-stepper-static")} button`).count()) === 0 &&
            (await page.locator(`${t("a-stepper-static")} .z-stepper`).getAttribute("data-orientation")) === "vertical",
          "sin onStepSelect no hay botones",
        );
        // NavList
        assert((await page.locator(t("a-navlist")).getAttribute("aria-label")) === "Audit navigation", "nav con nombre");
        await expectAttr(page, t("a-nav-link"), "aria-current", "page");
        await page.click(t("a-nav-button"));
        await out(page, "a-nav-value", "files");
        assert(
          (await page.locator(t("a-nav-button")).evaluate((el) => el.tagName)) === "BUTTON" &&
            (await page.locator(t("a-nav-link")).evaluate((el) => el.tagName)) === "A",
          "href → enlace; sin href → botón",
        );
        const offLink = page.locator(t("a-nav-link-disabled"));
        assert(
          (await offLink.getAttribute("href")) === null &&
            (await offLink.getAttribute("aria-disabled")) === "true" &&
            (await offLink.getAttribute("role")) === "link",
          "NavLink deshabilitado con href: sin href, aria-disabled, role=link",
        );
        await offLink.click({ force: true });
        assert(await page.locator(t("a-nav-button-disabled")).isDisabled(), "NavLink botón deshabilitado");
        await out(page, "a-nav-value", "files", "un NavLink deshabilitado no ejecuta onClick");
        const child = page.locator(t("a-nav-child"));
        assert(
          (await child.getAttribute("class")).includes("z-navlink") && (await child.locator(".z-navlink__icon").count()) === 1,
          "asChild fusiona clase e icono con el hijo",
        );
        await child.click();
        await out(page, "a-nav-value", "child");
        // Breadcrumb
        const crumb = `${t("a-breadcrumb")}`;
        assert((await page.locator(`${crumb} nav`).getAttribute("aria-label")) === "Breadcrumb", "nav con nombre");
        assert((await page.locator(`${crumb} [aria-current="page"]`).textContent()).trim() === "Atlas", "el último es la página actual");
        assert(
          (await page.locator(`${crumb} a.z-breadcrumb__link`).count()) === 1 &&
            (await page.locator(`${crumb} button.z-breadcrumb__link`).count()) === 1 &&
            (await page.locator(`${crumb} .z-breadcrumb__text`).count()) === 1,
          "enlace, botón y texto según el elemento",
        );
        assert((await page.locator(`${crumb} .z-breadcrumb__separator[aria-hidden="true"]`).count()) === 3, "separadores decorativos");
        await page.locator(`${crumb} button.z-breadcrumb__link`).click();
        await out(page, "a-breadcrumb-value", "projects");
        // Pagination
        const nav = `${t("a-pagination")} .z-pagination`;
        const pages = () =>
          page
            .locator(`${nav} > *`)
            .allTextContents()
            .then((list) =>
              list
                .map((s) => s.trim())
                .filter(Boolean)
                .join(" "),
            );
        assert((await pages()) === "1 2 3 4 5 … 20", `rango inicial: ${await pages()}`);
        assert(await page.locator(`${nav} > button`).first().isDisabled(), "anterior deshabilitado en la primera");
        await page.locator(`${nav} > button`).last().click();
        await out(page, "a-pagination-value", 2);
        await page.locator(`${nav} > button`, { hasText: /^20$/ }).click();
        await out(page, "a-pagination-value", 20);
        assert((await pages()) === "1 … 16 17 18 19 20", `rango final: ${await pages()}`);
        assert(await page.locator(`${nav} > button`).last().isDisabled(), "siguiente deshabilitado en la última");
        await page.locator(`${nav} > button`, { hasText: /^16$/ }).focus();
        await press(page, "Enter");
        await out(page, "a-pagination-value", 16);
        await page.locator(`${nav} > button`).first().click();
        await page.locator(`${nav} > button`).first().click();
        await out(page, "a-pagination-value", 14);
        assert((await pages()) === "1 … 13 14 15 … 20", `rango con dos huecos: ${await pages()}`);
        assert((await page.locator(`${nav} [aria-current="page"]`).getAttribute("aria-label")) === "Page 14", "nombre de la página actual");
        const short = `${t("a-pagination-short")} .z-pagination > button`;
        assert(
          (await page.locator(short).count()) === 3 &&
            (await page.locator(short).first().isDisabled()) &&
            (await page.locator(short).last().isDisabled()),
          "una sola página: anterior y siguiente deshabilitados",
        );
      },
    },
    {
      name: "Auditoría · navegación: Accordion múltiple, Tabs vertical con keepMounted, Tree con búsqueda por letra y Carousel onIndexChange",
      async run({ open }) {
        const page = await audit(open);
        const triggers = `${t("a-accordion")} .z-accordion__trigger`;
        await page.locator(triggers).nth(1).click();
        await out(page, "a-accordion-value", "a,b", "multiple: dos secciones abiertas a la vez");
        await page.locator(triggers).nth(0).click();
        await out(page, "a-accordion-value", "b");
        assert(await page.locator(triggers).nth(2).isDisabled(), "sección deshabilitada");
        await page.locator(triggers).nth(0).focus();
        await press(page, "ArrowDown");
        await focusOn(page, `${triggers} >> nth=1`, "flecha abajo mueve el foco entre cabeceras");
        // Tabs vertical
        const tabs = `${t("a-tabs")} [role="tab"]`;
        await expectAttr(page, `${t("a-tabs")} [role="tablist"]`, "aria-orientation", "vertical");
        await page.locator(tabs).first().focus();
        await press(page, "ArrowDown");
        await out(page, "a-tabs-value", "two");
        await page.locator(t("a-tabs-kept")).fill("kept");
        await page.locator(tabs).nth(1).focus();
        await press(page, "ArrowDown");
        await out(page, "a-tabs-value", "four", "salta la pestaña deshabilitada");
        assert(
          (await page.locator(t("a-tabs-kept")).count()) === 1 && (await page.locator(t("a-tabs-kept")).inputValue()) === "kept",
          "keepMounted conserva el panel y su estado",
        );
        await press(page, "ArrowRight");
        await out(page, "a-tabs-value", "four", "en vertical las flechas horizontales no cambian de pestaña");
        // Tree
        const item = (name) =>
          page.locator(`${t("a-tree")} [role="treeitem"]`, {
            has: page.locator(`:scope > .z-tree__row .z-tree__label:text-is("${name}")`),
          });
        await item("src").focus();
        await press(page, "l");
        await focusOn(
          page,
          `${t("a-tree")} [role="treeitem"]:has(> .z-tree__row .z-tree__label:text-is("LICENSE"))`,
          "la letra salta al nodo cuyo nombre empieza por ella",
        );
        await press(page, "m");
        await focusOn(
          page,
          `${t("a-tree")} [role="treeitem"]:has(> .z-tree__row .z-tree__label:text-is("main.tsx"))`,
          "la búsqueda da la vuelta",
        );
        await press(page, "Enter");
        await out(page, "a-tree-value", "main");
        await press(page, "ArrowLeft");
        await focusOn(
          page,
          `${t("a-tree")} [role="treeitem"]:has(> .z-tree__row .z-tree__label:text-is("src"))`,
          "flecha izquierda en una hoja va al padre",
        );
        await press(page, "ArrowLeft");
        await expectAttr(page, `${t("a-tree")} [role="treeitem"] >> nth=0`, "aria-expanded", "false");
        assert((await page.locator(`${t("a-tree")} [role="treeitem"][tabindex="0"]`).count()) === 1, "un solo nodo tabulable");
        // Carousel
        await out(page, "a-carousel-value", 1);
        await page
          .locator(`${t("a-carousel")} .z-carousel__arrow`)
          .last()
          .click();
        await out(page, "a-carousel-value", 2);
        await page
          .locator(`${t("a-carousel")} .z-carousel__arrow`)
          .last()
          .click();
        await out(page, "a-carousel-value", 3);
        assert(
          await page
            .locator(`${t("a-carousel")} .z-carousel__arrow`)
            .last()
            .isDisabled(),
          "sin bucle, la flecha se deshabilita en el último",
        );
        assert(/Slide 4 of 4/.test(await page.locator(`${t("a-carousel")} .z-carousel__live`).textContent()), "anuncio del slide");
      },
    },
    {
      name: "Auditoría · Menu con submenús de tres niveles (teclado y puntero), keepOpen, deshabilitado y búsqueda por letra",
      async run({ open }) {
        const page = await audit(open);
        const item = (name) => page.locator('[role="menuitem"]', { hasText: new RegExp(`^${name}`) }).last();
        await page.locator(t("a-menu")).focus();
        await press(page, "Enter");
        await visible(page, '[role="menu"]');
        // keepOpen: elegir no cierra.
        await press(page, "ArrowDown");
        await press(page, "Enter");
        await out(page, "a-menu-pinned", "pinned");
        assert((await page.locator('[role="menu"]').count()) === 1, "keepOpen deja el menú abierto");
        // Deshabilitado: las flechas lo saltan.
        await press(page, "ArrowDown");
        await poll(
          () => page.evaluate(() => document.activeElement?.textContent.trim().startsWith("Share")),
          "la flecha salta la entrada deshabilitada",
        );
        await press(page, "ArrowRight");
        await expectCount(page, '[role="menu"]', 2);
        await press(page, "ArrowDown", "ArrowRight");
        await expectCount(page, '[role="menu"]', 3);
        await press(page, "ArrowDown", "ArrowRight");
        await expectCount(page, '[role="menu"]', 4, "cuarto nivel abierto con teclado");
        await poll(
          () => page.evaluate(() => document.activeElement?.textContent.trim() === "Frontend"),
          "el foco entra en el último submenú",
        );
        await press(page, "ArrowLeft");
        await expectCount(page, '[role="menu"]', 3, "flecha izquierda cierra solo el último nivel");
        await press(page, "ArrowRight", "ArrowDown", "Enter");
        await out(page, "a-menu-value", "page:backend");
        await expectCount(page, '[role="menu"]', 0, "elegir cierra toda la cadena");
        await focusOn(page, t("a-menu"), "el foco vuelve al disparador");
        // Puntero.
        await page.click(t("a-menu"));
        await item("Share").hover();
        await expectCount(page, '[role="menu"]', 2);
        await item("Team").hover();
        await expectCount(page, '[role="menu"]', 3);
        await item("Design").click();
        await out(page, "a-menu-value", "page:design");
        await expectCount(page, '[role="menu"]', 0);
        // Búsqueda por letra y Escape.
        await page.click(t("a-menu"));
        await press(page, "d");
        await poll(() => page.evaluate(() => document.activeElement?.textContent.trim() === "Delete"), "búsqueda por letra");
        await press(page, "Escape");
        await expectCount(page, '[role="menu"]', 0);
      },
    },
    {
      name: "Auditoría · composición: Menu, ContextMenu, Select, Combobox, DatePicker y Calendar dentro de un Popover y de un Drawer",
      async run({ open }) {
        const page = await audit(open);
        for (const [scope, trigger, layer] of [
          ["pop", "a-compose-popover", ".z-popover"],
          ["drawer", "a-compose-drawer", ".z-drawer"],
        ]) {
          const id = (name) => t(`${scope}-${name}`);
          await page.click(t(trigger));
          await visible(page, id("content"));
          await settled(page);
          const stillOpen = (message) => poll(() => page.locator(id("content")).isVisible(), `${scope}: ${message}`);
          // Menu
          await page.click(id("menu"));
          await page.locator('[role="menuitem"]', { hasText: /^New file/ }).click();
          await out(page, `${scope}-menu-value`, `${scope}:new`);
          await stillOpen("elegir en el menú no cierra la capa que lo contiene");
          // ContextMenu
          await page.locator(id("zone")).click({ button: "right" });
          await visible(page, '[role="menu"]');
          await press(page, "Escape");
          await expectCount(page, '[role="menu"]', 0);
          await stillOpen("Escape en el menú contextual cierra solo el menú");
          // Select
          await page.locator(`${id("select")} .z-select__control`).click();
          await page.locator('[role="option"]', { hasText: "Beta" }).click();
          await out(page, `${scope}-select-value`, "beta");
          await page.locator(`${id("select")} .z-select__control`).press("ArrowDown");
          await visible(page, '[role="listbox"]');
          await press(page, "Escape");
          await stillOpen("Escape en la lista del Select cierra solo la lista");
          // Combobox
          const combo = page.locator(`${id("combobox")} input[role="combobox"]`);
          await combo.click();
          await combo.fill("del");
          await press(page, "Enter");
          await out(page, `${scope}-combobox-value`, "delta");
          await combo.press("ArrowDown");
          await press(page, "Escape");
          await stillOpen("Escape en la lista del Combobox cierra solo la lista");
          // DatePicker
          await page.locator(`${id("datepicker")} .z-select__control`).click();
          await visible(page, ".z-datepicker__panel .z-calendar__day");
          await poll(
            () => page.evaluate(() => document.activeElement?.classList.contains("z-calendar__day")),
            `${scope}: el DatePicker enfoca un día`,
          );
          await press(page, "ArrowRight", "Enter");
          await poll(
            async () => /^\d{4}-\d{2}-\d{2}$/.test((await page.locator(id("datepicker-value")).textContent()).trim()),
            `${scope}: el DatePicker elige con teclado`,
          );
          await stillOpen("elegir fecha no cierra la capa que contiene al DatePicker");
          // Calendar
          await page.locator(`${id("calendar")} [data-date="2026-03-18"]`).click();
          await out(page, `${scope}-calendar-value`, "2026-03-18");
          await press(page, "PageDown");
          await poll(
            () => page.evaluate(() => document.activeElement?.dataset.date === "2026-04-18"),
            `${scope}: Av Pág cambia de mes dentro de la capa`,
          );
          await page
            .locator(`${layer} .z-overlay-close, ${id("content")}`)
            .first()
            .focus()
            .catch(() => {});
          await press(page, "Escape");
          await gone(page, id("content"), `${scope}: Escape cierra la capa`);
        }
      },
    },
    {
      name: "Auditoría · Popover y Tooltip en los bordes de la ventana no se salen; Tooltip es hoverable y Escape lo cierra (WCAG 1.4.13)",
      async run({ open }) {
        const page = await audit(open, { width: 900, height: 620 });
        await page.click(t("a-edges"));
        for (const at of ["tl", "tr", "bl", "br"]) {
          await page.click(t(`a-pop-${at}`));
          await visible(page, t(`a-pop-${at}-body`));
          await settled(page);
          assert(await inside(page, `.z-popover:has(${t(`a-pop-${at}-body`)})`), `el popover de la esquina ${at} se sale de la ventana`);
          await press(page, "Escape");
          await gone(page, t(`a-pop-${at}-body`));
        }
        for (const at of ["top", "right", "bottom", "left"]) {
          await page.locator(t(`a-tip-${at}`)).hover();
          await visible(page, ".z-tooltip");
          await settled(page);
          assert(await inside(page, ".z-tooltip"), `el tooltip del borde ${at} se sale de la ventana`);
          await press(page, "Escape");
          await gone(page, ".z-tooltip", `Escape cierra el tooltip (${at})`);
          await page.mouse.move(450, 300, { steps: 3 });
        }
        await page.click(t("a-edges"));
        // Hoverable.
        await page.locator(t("a-tip")).hover();
        await visible(page, ".z-tooltip");
        await settled(page);
        const box = await page.locator(".z-tooltip").first().boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
        await sleep(500);
        assert((await page.locator(".z-tooltip").count()) >= 1, "la burbuja se cierra al pasar el puntero del disparador a ella");
        await page.mouse.move(5, 300, { steps: 4 });
        await gone(page, ".z-tooltip", "al salir el puntero se cierra");
        assert((await page.locator(t("a-tip")).getAttribute("aria-describedby")) === null, "aria-describedby se retira al cerrar");
      },
    },
    {
      name: "Auditoría · ConfirmDialog (Escape llama a onCancel), CommandPalette (deshabilitado, closeOnSelect, filter, índice acotado) y Toast (limit, posición, dismiss)",
      async run({ open }) {
        const page = await audit(open);
        await page.click(t("a-confirm"));
        await visible(page, '[role="alertdialog"]');
        await press(page, "Escape");
        await gone(page, '[role="alertdialog"]');
        await out(page, "a-confirm-cancels", 1, "Escape llama a onCancel");
        await out(page, "a-confirm-value", "none");
        await page.click(t("a-confirm"));
        await page.locator('[role="alertdialog"] .z-dialog-btn[data-variant="secondary"]').click();
        await out(page, "a-confirm-cancels", 2);
        await page.click(t("a-confirm"));
        await page.locator('[role="alertdialog"] .z-dialog-btn[data-variant="danger"]').click();
        await out(page, "a-confirm-value", "confirmed");
        await out(page, "a-confirm-cancels", 2, "confirmar no llama a onCancel");
        // CommandPalette
        await page.click(t("a-palette"));
        await visible(page, ".z-palette");
        const active = () =>
          page.evaluate(
            () =>
              document
                .getElementById(document.querySelector(".z-palette__input").getAttribute("aria-activedescendant") ?? "")
                ?.textContent.trim() ?? null,
          );
        await press(page, "ArrowDown", "ArrowDown", "Enter");
        await out(page, "a-palette-ran", "none", "un comando deshabilitado no se ejecuta");
        await press(page, "ArrowUp", "Enter");
        await out(page, "a-palette-ran", "save");
        await visible(page, ".z-palette", "closeOnSelect={false} deja la paleta abierta");
        // Índice acotado: se elige el penúltimo comando, que acorta la lista a la mitad.
        await press(page, "End", "ArrowUp");
        assert((await active()) === "Shrink the list", `comando activo: ${await active()}`);
        await press(page, "Enter");
        await expectCount(page, ".z-palette__item", 3);
        assert(
          (await active()) === "Locked command",
          `tras acortar la lista el comando activo debe ser el último que queda, no uno inexistente: ${await active()}`,
        );
        await press(page, "ArrowUp", "Enter");
        await out(page, "a-palette-ran", "save");
        await press(page, "Escape");
        await gone(page, ".z-palette");
        await page.click(t("a-palette-strict"));
        await page.click(t("a-palette"));
        await page.locator(".z-palette__input").fill("file");
        await visible(page, ".z-palette__empty");
        await page.locator(".z-palette__input").fill("open");
        await expectCount(page, ".z-palette__item", 1, "filter propio: solo prefijo");
        await press(page, "Escape");
        // Toast
        for (let i = 0; i < 4; i++) await page.click(t("a-toast-add"));
        await expectCount(page, '.z-toast[data-state="open"]', 3, "limit=3 retira el más antiguo");
        assert((await page.locator(".z-toast-viewport").getAttribute("data-position")) === "top-center", "posición del proveedor");
        // 0.2.0: mismo marcado que toast() de zui/dom. Una región con nombre y avisos role=status/alert, sin lista.
        const toastMarkup = await page.evaluate(() => {
          const region = document.querySelector(".z-toast-viewport");
          const items = [...region.querySelectorAll(".z-toast")];
          return {
            region: `${region.tagName} ${region.getAttribute("role")}`,
            name: region.getAttribute("aria-label"),
            top: region.matches(":popover-open"),
            items: items.map((el) => `${el.tagName} ${el.getAttribute("role")}`),
            lists: document.querySelectorAll(".z-toast-viewport ol, .z-toast-viewport li, ol.z-toast-viewport").length,
          };
        });
        assert(
          toastMarkup.region === "DIV region" && toastMarkup.name === "Audit notice" && toastMarkup.top && toastMarkup.lists === 0,
          `región de avisos: ${JSON.stringify(toastMarkup)}`,
        );
        assert(
          toastMarkup.items.every((item) => item === "DIV status" || item === "DIV alert") && toastMarkup.items.includes("DIV alert"),
          `avisos: ${JSON.stringify(toastMarkup.items)}`,
        );
        assert((await page.locator(".z-toast").first().textContent()).includes("Notice 2"), "el aviso más antiguo es el que se retira");
        await page.click(t("a-toast-dismiss"));
        await expectCount(page, '.z-toast[data-state="open"]', 2);
        await page.click(t("a-toast-dismiss-all"));
        await expectCount(page, ".z-toast", 0);
      },
    },
    {
      name: "Auditoría · 0.2.0: Escape en un SearchInput dentro de un Modal solo limpia; Popover con nombre accesible",
      async run({ open }) {
        const page = await audit(open);
        await page.click(t("a-ms-open"));
        await visible(page, "dialog.z-modal:modal");
        await page.locator(t("a-ms-input")).focus();
        assert((await page.inputValue(t("a-ms-input"))) === "draft", "el campo empieza con texto");
        await press(page, "Escape");
        await poll(async () => (await page.inputValue(t("a-ms-input"))) === "", "Escape limpia el campo");
        await sleep(300);
        assert((await page.locator("dialog.z-modal:modal").count()) === 1, "la primera pulsación de Escape no cierra el Modal");
        await focusOn(page, t("a-ms-input"), "el foco sigue en el campo");
        await press(page, "Escape");
        await gone(page, ".z-modal");
        await focusOn(page, t("a-ms-open"), "con el campo vacío, Escape cierra el Modal y el foco vuelve al disparador");
        // Todo Popover abierto es un role=dialog con nombre (label obligatorio en los tipos).
        const names = await page.evaluate(async () => {
          const out = [];
          for (const trigger of document.querySelectorAll('[aria-haspopup="dialog"]:not(.z-select__control)')) {
            trigger.click();
            await new Promise((done) => setTimeout(done, 60));
            for (const panel of document.querySelectorAll(".z-popover[role=dialog]:popover-open, dialog.z-popover[open]"))
              out.push(panel.getAttribute("aria-label") || panel.getAttribute("aria-labelledby") || "");
            trigger.click();
            await new Promise((done) => setTimeout(done, 60));
          }
          return out;
        });
        assert(names.length > 0 && names.every(Boolean), `Popover sin nombre accesible: ${JSON.stringify(names)}`);
      },
    },
    {
      name: "Auditoría · Popover modal: <dialog> con inercia real, foco retenido, cierre con Escape y pulsación fuera",
      async run({ open }) {
        const page = await audit(open);
        const panel = "dialog.z-popover";
        const look = (selector) =>
          page.locator(selector).evaluate((el) => {
            const s = getComputedStyle(el);
            return [s.paddingTop, s.borderTopWidth, s.borderTopStyle, s.borderTopColor, s.backgroundColor, s.color, s.borderRadius].join(
              " | ",
            );
          });
        // Aspecto de referencia: el popover no modal.
        await page.click(t("a-compose-popover"));
        await visible(page, ".z-popover[role=dialog]:popover-open");
        await settled(page);
        const plain = await look(".z-popover[role=dialog]:popover-open");
        await press(page, "Escape");
        await gone(page, ".z-popover");

        await page.click(t("a-mpop-open"));
        await visible(page, `${panel}:modal`);
        await settled(page);
        assert((await look(panel)) === plain, `el popover modal no se ve como el no modal: ${await look(panel)} ≠ ${plain}`);
        await expectAttr(page, panel, "aria-label", "Rename project");
        await expectAttr(page, t("a-mpop-open"), "aria-expanded", "true");
        // Anclado a su disparador, no centrado como un <dialog> del navegador; y sin velo que oscurezca la página.
        const geometry = await page.evaluate(
          ([p, tr]) => {
            const a = document.querySelector(p).getBoundingClientRect();
            const b = document.querySelector(tr).getBoundingClientRect();
            return {
              gap: a.top - b.bottom,
              left: a.left - b.left,
              veil: getComputedStyle(document.querySelector(p), "::backdrop").backgroundColor,
            };
          },
          [panel, t("a-mpop-open")],
        );
        assert(
          Math.abs(geometry.gap - 4) < 1.5 && Math.abs(geometry.left) < 1.5,
          `no está anclado al disparador: ${JSON.stringify(geometry)}`,
        );
        assert(/rgba\(0, 0, 0, 0\)|transparent/.test(geometry.veil), `el velo no es transparente: ${geometry.veil}`);
        // El foco entra en el panel y Tab da la vuelta dentro.
        await focusOn(page, t("a-mpop-save"), "al abrir, el foco va al primer control del panel");
        for (let i = 0; i < 5; i++) {
          await press(page, "Tab");
          assert(
            await page.evaluate((p) => document.querySelector(p).contains(document.activeElement), panel),
            `Tab sacó el foco del panel (pulsación ${i + 1})`,
          );
        }
        // Como los demás diálogos modales, bloquea el desplazamiento de la página mientras está abierto.
        const scrollLocked = () => page.evaluate(() => getComputedStyle(document.documentElement).overflowY === "hidden");
        assert(await scrollLocked(), "el popover modal no bloquea el desplazamiento de la página");
        // Inercia real: lo de fuera no se puede enfocar ni pulsar. La pulsación fuera solo cierra el panel.
        assert(
          await page.evaluate((s) => {
            const el = document.querySelector(s);
            el.focus();
            return document.activeElement !== el;
          }, t("a-mpop-outside")),
          "un control de fuera del popover modal admite el foco: no es inerte",
        );
        const { x, y } = await page.locator(t("a-mpop-outside")).evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await page.mouse.click(x, y);
        await gone(page, panel, "la pulsación fuera cierra el popover modal");
        assert(!(await scrollLocked()), "al cerrar el popover modal la página sigue sin poder desplazarse");
        await out(page, "a-mpop-count", 0, "la pulsación fuera no activó el botón que había debajo");
        await focusOn(page, t("a-mpop-open"), "al cerrar, el foco vuelve al disparador");
        // Cerrado, la página vuelve a responder.
        await page.click(t("a-mpop-outside"));
        await out(page, "a-mpop-count", 1, "con el popover cerrado el botón de fuera responde");
        // Escape cierra y devuelve el foco.
        await page.click(t("a-mpop-open"));
        await visible(page, `${panel}:modal`);
        await press(page, "Escape");
        await gone(page, panel, "Escape cierra el popover modal");
        await focusOn(page, t("a-mpop-open"), "tras Escape el foco vuelve al disparador");
        await expectAttr(page, t("a-mpop-open"), "aria-expanded", "false");
      },
    },
    {
      name: "Auditoría · Toast y capa modal: un aviso emitido antes de abrir un Modal sigue activo dentro y vuelve a la página al cerrarlo",
      async run({ open }) {
        const page = await audit(open);
        await page.click(t("a-toast-add"));
        await page.click(t("a-toast-add"));
        await expectCount(page, ".z-toast", 2);
        await settled(page);
        const inside = () =>
          page.evaluate(() => [...document.querySelectorAll(".z-toast")].map((el) => !!el.closest("dialog:modal")).join());
        // Lo que queda fuera de un diálogo modal es inerte: la región de avisos se muda a él.
        await page.click(t("a-ms-open"));
        await visible(page, "dialog.z-modal:modal");
        await settled(page);
        await poll(async () => (await inside()) === "true,true", "la región de avisos pasa al diálogo modal abierto");
        await expectCount(page, ".z-toast", 2, "los avisos no se pierden ni se duplican al mudarse");
        assert(
          await page.locator(".z-toast-viewport").evaluate((el) => el.matches(":popover-open")),
          "la región sigue en la capa superior",
        );
        // Sigue activo: se puede enfocar y su botón de cierre responde.
        await page.locator('.z-toast:has-text("Notice 1") .z-toast__close').click({ timeout: 5000 });
        await expectCount(page, ".z-toast", 1, "el aviso emitido antes de abrir el Modal se puede cerrar");
        await press(page, "F8");
        await poll(
          () => page.evaluate(() => document.activeElement?.classList.contains("z-toast")),
          "F8 lleva el foco al aviso con el Modal abierto",
        );
        // Al cerrar el Modal el aviso que queda vuelve a la página, sin reiniciarse, y sigue activo.
        await page.locator(t("a-ms-input")).focus();
        await press(page, "Escape", "Escape");
        await gone(page, ".z-modal");
        await poll(async () => (await inside()) === "false", "al cerrar el Modal la región vuelve a la página");
        await expectText(page, ".z-toast .z-toast__title", "Notice 2");
        assert(
          await page.locator(".z-toast-viewport").evaluate((el) => el.matches(":popover-open")),
          "la región sigue visible tras cerrar el Modal",
        );
        await page.locator(".z-toast .z-toast__close").click({ timeout: 5000 });
        await expectCount(page, ".z-toast", 0, "el aviso sigue respondiendo en la página");
      },
    },
    {
      name: 'Auditoría · RTL: Calendar, Rating, Slider, Tabs, Pagination y Breadcrumb dentro de dir="rtl", y la pantalla entera con <html dir="rtl">',
      async run({ open }) {
        const page = await audit(open);
        await page.locator(`${t("a-rtl-calendar")} [data-date="2026-03-10"]`).focus();
        await press(page, "ArrowLeft");
        await poll(
          () => page.evaluate(() => document.activeElement?.dataset.date === "2026-03-11"),
          "Calendar RTL: flecha izquierda = día siguiente",
        );
        const left = (d) => page.locator(`${t("a-rtl-calendar")} [data-date="${d}"]`).evaluate((el) => el.getBoundingClientRect().left);
        assert((await left("2026-03-11")) < (await left("2026-03-10")), "Calendar RTL: el día siguiente queda a la izquierda");
        await page.locator(`${t("a-rtl-rating")} [data-star="2"]`).focus();
        await press(page, "ArrowLeft");
        await out(page, "a-rtl-rating-value", 3, "Rating RTL: flecha izquierda sube");
        assert(
          (await page.locator(`${t("a-rtl-rating")} [data-star="3"]`).evaluate((el) => el.getBoundingClientRect().left)) <
            (await page.locator(`${t("a-rtl-rating")} [data-star="1"]`).evaluate((el) => el.getBoundingClientRect().left)),
          "Rating RTL: las estrellas crecen hacia la izquierda",
        );
        // 0.2.0: las primitivas propias leen la dirección del DOM, sin proveedor ni prop `dir`: la flecha izquierda avanza.
        await page
          .locator(`${t("a-rtl-tabs")} [role="tab"]`)
          .first()
          .focus();
        await press(page, "ArrowLeft");
        await out(page, "a-rtl-tabs-value", "two", "Tabs RTL: flecha izquierda = pestaña siguiente");
        await press(page, "ArrowRight", "ArrowRight");
        await out(page, "a-rtl-tabs-value", "three", "Tabs RTL: flecha derecha retrocede (y da la vuelta)");
        const tabLeft = (i) =>
          page
            .locator(`${t("a-rtl-tabs")} [role="tab"]`)
            .nth(i)
            .evaluate((el) => el.getBoundingClientRect().left);
        assert((await tabLeft(1)) < (await tabLeft(0)), "Tabs RTL: la pestaña siguiente queda a la izquierda");
        await page.locator(`${t("a-rtl-slider")} [role="slider"]`).focus();
        const before = Number((await page.locator(t("a-rtl-slider-value")).textContent()).trim());
        await press(page, "ArrowLeft");
        await poll(
          async () => Number((await page.locator(t("a-rtl-slider-value")).textContent()).trim()) > before,
          "Slider RTL: flecha izquierda sube el valor",
        );
        const crumb = await page.evaluate(() => {
          const items = [...document.querySelectorAll('[data-testid="a-rtl-breadcrumb"] .z-breadcrumb__item')].map(
            (el) => el.getBoundingClientRect().left,
          );
          const icon = document.querySelector('[data-testid="a-rtl-breadcrumb"] .z-breadcrumb__separator svg');
          return { order: items[0] > items[1] && items[1] > items[2], flipped: new DOMMatrix(getComputedStyle(icon).transform).a < 0 };
        });
        assert(crumb.order && crumb.flipped, `Breadcrumb RTL: orden y separador reflejados (${JSON.stringify(crumb)})`);
        const pag = await page.evaluate(() => {
          const buttons = [...document.querySelectorAll('[data-testid="a-rtl-pagination"] .z-pagination > button')];
          return buttons[0].getBoundingClientRect().left > buttons[1].getBoundingClientRect().left;
        });
        assert(pag, "Pagination RTL: anterior a la derecha");
        const icon = await page.evaluate(() => {
          const wrap = document.querySelector('[data-testid="a-rtl-input"]').closest(".z-input");
          return (
            wrap.querySelector(".z-input__icon").getBoundingClientRect().left > wrap.querySelector("input").getBoundingClientRect().left
          );
        });
        assert(icon, "Input RTL: el icono queda al inicio (derecha)");
        // Página entera en RTL.
        const rtl = await open("audit", { query: "dir=rtl" });
        const state = await rtl.evaluate(() => ({
          dir: document.documentElement.dir,
          overflow: document.querySelector(".audit").scrollWidth > document.querySelector(".audit").clientWidth + 1,
        }));
        assert(state.dir === "rtl" && !state.overflow, `pantalla RTL: ${JSON.stringify(state)}`);
        await rtl.click(t("a-compose-drawer"));
        await visible(rtl, ".z-drawer");
        await settled(rtl);
        const close = await rtl.evaluate(() => {
          const d = document.querySelector(".z-drawer").getBoundingClientRect();
          const c = document.querySelector(".z-drawer__close").getBoundingClientRect();
          return c.left - d.left < d.right - c.right;
        });
        assert(close, "Drawer RTL: el botón de cierre queda al final de la línea (izquierda)");
      },
    },
    {
      name: "Auditoría · SSR e hidratación: sin avisos con el reloj del servidor en otro mes (Calendar), y el mes pasa al del navegador",
      async run({ open }) {
        const page = await open("audit-ssr");
        await expectText(page, t("ssr-status"), "done", "la hidratación termina");
        const result = await page.evaluate(() => window.__auditSsr);
        assert(result.htmlLength > 20000, "el render de servidor está vacío");
        assert(
          result.serverMonth === result.serverClock && result.serverClock !== result.clientMonth,
          `el servidor debía pintar otro mes: ${JSON.stringify(result)}`,
        );
        assert(
          result.recoverable.length === 0 && result.consoleErrors.length === 0,
          `la hidratación emite errores:\n${[...result.recoverable, ...result.consoleErrors].join("\n")}`,
        );
        assert(
          result.hydratedMonth === result.clientMonth,
          `tras hidratar, Calendar debe mostrar el mes del navegador (${result.hydratedMonth} ≠ ${result.clientMonth})`,
        );
        const same = await open("audit-ssr", { query: "clock=same" });
        await expectText(same, t("ssr-status"), "done");
        const again = await same.evaluate(() => window.__auditSsr);
        assert(
          again.recoverable.length === 0 && again.consoleErrors.length === 0,
          `hidratación con el mismo reloj: ${[...again.recoverable, ...again.consoleErrors].join("\n")}`,
        );
      },
    },
    {
      name: "Auditoría · la pantalla audit: axe sin violaciones graves (claro y oscuro), consola limpia y sin desbordamiento a 390 px",
      async run({ open, axe }) {
        for (const theme of ["dark", "light"]) {
          const page = await audit(open, { theme });
          const violations = (await axe(page)).filter((v) => v.impact === "serious" || v.impact === "critical");
          assert(
            violations.length === 0,
            `axe (${theme}): ${violations
              .map(
                (v) =>
                  `${v.id}: ${v.nodes
                    .slice(0, 4)
                    .map((n) => n.target)
                    .join("; ")}`,
              )
              .join(" | ")}`,
          );
        }
        const narrow = await audit(open, { width: 390, height: 800 });
        assert(
          await narrow.evaluate(() => document.querySelector(".audit").scrollWidth <= document.querySelector(".audit").clientWidth + 1),
          "desbordamiento horizontal a 390 px",
        );
      },
    },
  ];
}
