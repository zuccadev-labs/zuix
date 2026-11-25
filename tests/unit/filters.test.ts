// Filtros (core/filters y la pieza FilterBar): activos, interruptores, opciones con una o varias, resumen del chip,
// recuento; el árbol de la pieza y su interacción sobre un DOM mínimo.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { filterBarWidget } from "../../zui/src/core/filter-bar-widget.ts";
import {
  activeCount,
  chipText,
  filterKind,
  isActive,
  selected,
  toggleFilter,
  toggleOption,
  valueKey,
  type FilterDef,
  type FilterValue,
} from "../../zui/src/core/filters.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261123), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300) });

const OPTIONS = [
  { value: "entire", label: "Entire home" },
  { value: "room", label: "Private room" },
  { value: "shared", label: "Shared room" },
];
const DEFS: FilterDef[] = [
  { id: "instant", label: "Instant book", icon: "bolt" },
  { id: "type", label: "Type of place", options: OPTIONS },
  {
    id: "price",
    label: "Price",
    multiple: false,
    options: [
      { value: "low", label: "Low" },
      { value: "high", label: "High" },
    ],
  },
  { id: "forced", label: "Forced", type: "toggle", options: OPTIONS },
];

describe("filtros", () => {
  test("clase, activos, interruptor y opciones con varias o con una", () => {
    assert.equal(filterKind(DEFS[0]!), "toggle");
    assert.equal(filterKind(DEFS[1]!), "menu");
    assert.equal(filterKind(DEFS[3]!), "toggle");
    let v: FilterValue = toggleFilter(DEFS[0]!, {});
    assert.deepEqual(v, { instant: true });
    v = toggleOption(DEFS[1]!, v, "shared");
    v = toggleOption(DEFS[1]!, v, "entire");
    assert.deepEqual(v.type, ["entire", "shared"], "en el orden de la definición");
    assert.deepEqual(chipText(DEFS[1]!, v), { label: "Type of place", detail: "2" });
    assert.equal(activeCount(DEFS, v), 2);
    v = toggleOption(DEFS[2]!, v, "low");
    v = toggleOption(DEFS[2]!, v, "high");
    assert.deepEqual(v.price, ["high"], "con una sola, elegir otra sustituye");
    assert.deepEqual(chipText(DEFS[2]!, v), { label: "Price", detail: "High" });
    v = toggleOption(DEFS[2]!, v, "high");
    assert.equal("price" in v, false, "quitar la elegida deja el filtro fuera del valor");
    assert.deepEqual(toggleOption(DEFS[1]!, v, "nope"), v, "opción que no existe");
    assert.deepEqual(selected(DEFS[1]!, { type: ["x", "room", "room"] }), ["room"]);
    assert.deepEqual(selected(DEFS[2]!, { price: ["low", "high"] }), ["low"]);
    assert.equal(isActive(DEFS[0]!, { instant: ["x"] }), false);
    assert.deepEqual(chipText(DEFS[0]!, {}), { label: "Instant book", detail: "" });
    assert.deepEqual(toggleFilter(DEFS[0]!, { instant: true }), {});
    assert.equal(valueKey({ b: true, a: ["x"] }), valueKey({ a: ["x"], b: true }));
    assert.equal(valueKey(undefined), "");
  });
  test("propiedad: alternar dos veces la misma opción deja el filtro como estaba y el recuento no pasa del total", () => {
    fc.assert(
      fc.property(
        fc.subarray(OPTIONS.map((o) => o.value)),
        fc.constantFrom(...OPTIONS.map((o) => o.value)),
        fc.boolean(),
        (start, option, on) => {
          const value: FilterValue = { type: start, ...(on ? { instant: true } : {}) };
          const twice = toggleOption(DEFS[1]!, toggleOption(DEFS[1]!, value, option), option);
          assert.deepEqual(selected(DEFS[1]!, twice), selected(DEFS[1]!, value));
          assert.ok(activeCount(DEFS, twice) <= DEFS.length);
          assert.equal(activeCount(DEFS, {}), 0);
        },
      ),
    );
  });
});

describe("FilterBar", () => {
  test("árbol: grupo con recuento, interruptor con aria-pressed, menú en popover con casillas y Clear", () => {
    const c = filterBarWidget.configure({ filters: DEFS, defaultValue: { instant: true, type: ["room"] } });
    const s = filterBarWidget.initial(c);
    const html = toHTML(filterBarWidget.tree(c, s, "fb"));
    assert.match(html, /role="group" aria-label="Filters" aria-describedby="fb-count" data-size="md" data-active="2"/);
    assert.match(
      html,
      /aria-pressed="true" data-toggle="instant"><z-icon name="bolt" size="14"><\/z-icon><span class="z-chip__label">Instant book/,
    );
    assert.match(html, /popovertarget="fb-m-type" aria-haspopup="dialog" aria-expanded="false"/);
    assert.match(html, /<span class="z-chip__count">Private room<\/span>/);
    assert.match(html, /type="checkbox" class="z-filter-bar__input" name="fb-m-type-options" value="room" data-checked/);
    assert.match(html, /type="radio" class="z-filter-bar__input" name="fb-m-price-options" value="low" data-option="price"/);
    assert.match(html, /data-clear>/);
    assert.match(html, /<span class="z-sr-only" id="fb-count">2 filters active<\/span>/);
    const none = toHTML(filterBarWidget.tree(c, { ...s, value: {} }, "fb"));
    assert.doesNotMatch(none, /data-clear/);
    assert.match(none, /No filters active/);
    assert.match(toHTML(filterBarWidget.tree(c, { ...s, value: { instant: true } }, "fb")), /1 filter active/);
    // Controlado: un value nuevo manda; el mismo no toca el estado.
    const controlled = filterBarWidget.configure({ filters: DEFS, value: { instant: true } });
    const cs = filterBarWidget.initial(controlled);
    assert.equal(filterBarWidget.control!(controlled, cs), cs);
    const changed = filterBarWidget.control!(filterBarWidget.configure({ filters: DEFS, value: {} }), cs);
    assert.deepEqual(changed.value, {});
    assert.equal(filterBarWidget.control!(c, s), s);
  });
  test("interacción: interruptor, opción, Clear con el foco en el primer chip, y props desde atributos", async () => {
    const c = filterBarWidget.configure({ filters: DEFS });
    let state = filterBarWidget.initial(c);
    const events: [string, unknown][] = [];
    const root = document.createElement("div");
    root.className = "z-filter-bar";
    document.body.append(root);
    const paint = () => {
      root.innerHTML = (filterBarWidget.tree(c, state, "fb").c ?? []).map((n) => toHTML(n)).join("");
    };
    const host = {
      config: () => c,
      state: () => state,
      update: (p: Partial<typeof state>) => {
        state = { ...state, ...p };
        paint();
      },
      emit: (n: string, d: unknown) => events.push([n, d]),
    };
    paint();
    const off = filterBarWidget.attach(root, host);
    root.querySelector<HTMLElement>('[data-toggle="instant"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(root.querySelector('[data-toggle="instant"]')?.getAttribute("aria-pressed"), "true");
    const box = root.querySelector<HTMLInputElement>('input[data-option="type"][value="shared"]')!;
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    assert.deepEqual(state.value, { instant: true, type: ["shared"] });
    root.querySelector<HTMLElement>("[data-clear]")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(state.value, {});
    assert.equal(root.querySelector("[data-clear]"), null);
    assert.deepEqual(
      events.map(([, d]) => (d as { id: string }).id),
      ["instant", "type", ""],
    );
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(root.querySelector("[data-live]")?.textContent, "No filters active");
    off();
    root.remove();
    root.dataset.size = "sm";
    const props = filterBarWidget.fromDom(root, { filters: DEFS, value: { pets: true }, defaultValue: { a: true } });
    assert.equal(props.size, "sm");
    assert.deepEqual(props.value, { pets: true });
    assert.deepEqual(filterBarWidget.fromDom(document.createElement("div"), {}).filters, []);
  });
});
