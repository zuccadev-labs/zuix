// Marcado que emite el binding de React con sus primitivas propias (render estático): mismas clases, roles y
// atributos de estado que el contrato de zui/html.json, sin rastro de Radix, y los cambios de 0.2.0 que se ven en
// el HTML (Button en carga, DatePicker obligatorio, campos nativos ocultos). La interacción se prueba en navegador.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { React, render } from "./helpers/react.mjs";

const zui = await import("../../zui/src/index.ts");
const h = React.createElement;
const count = (html, pattern) => [...html.matchAll(pattern)].length;

describe("sin rastro de Radix en el marcado", () => {
  test("ningún atributo data-radix-*, id radix-… ni variable --radix-*", () => {
    const html = [
      render(zui.Tabs, { items: [{ value: "a", label: "A", content: "x" }] }),
      render(zui.Accordion, { items: [{ value: "a", title: "A", content: "x" }] }),
      render(zui.Select, { options: [{ value: "a", label: "A" }], "aria-label": "S" }),
      render(zui.Slider, { defaultValue: [10], "aria-label": "S" }),
      render(zui.Checkbox, { children: "c" }),
      render(zui.Switch, { children: "s" }),
      render(zui.SegmentedControl, { label: "v", items: [{ value: "a", label: "A" }] }),
      render(zui.Toggle, { label: "t" }),
      render(zui.Menu, { trigger: h("button", null, "m"), items: [] }),
      render(zui.Modal, { trigger: h("button", null, "m"), title: "t" }),
    ].join("\n");
    assert.doesNotMatch(html, /radix/i);
    assert.doesNotMatch(html, /\sdir="ltr"/, "la dirección se lee del DOM: el binding no la fija");
  });
});

describe("Tabs y Accordion", () => {
  const tabs = render(zui.Tabs, {
    label: "Sections",
    items: [
      { value: "a", label: "A", content: "Pa" },
      { value: "b", label: "B", content: "Pb", disabled: true },
      { value: "c", label: "C", content: "Pc" },
    ],
  });
  test("Tabs: roles, estado, enlace pestaña-panel y una sola parada de tabulación", () => {
    assert.match(tabs, /<div role="tablist" class="z-tabs__list"[^>]*aria-label="Sections"/);
    assert.equal(count(tabs, /role="tab"[^>]*tabindex="0"/g), 1);
    assert.match(
      tabs,
      /role="tab" id="([^"]+)-tab-a"[^>]*data-value="a" data-state="active"[^>]*aria-selected="true" aria-controls="\1-panel-a"/,
    );
    assert.match(
      tabs,
      /role="tabpanel" id="([^"]+)-panel-a" aria-labelledby="\1-tab-a" class="z-tabs__panel" data-value="a" data-state="active" tabindex="0">Pa</,
    );
    assert.match(tabs, /data-value="b" data-state="inactive"[^>]*data-disabled=""[^>]*disabled=""/);
  });
  test("Tabs: el panel inactivo queda oculto y sin contenido, salvo keepMounted", () => {
    assert.match(tabs, /data-value="c" data-state="inactive" tabindex="0" hidden=""><\/div>/);
    const kept = render(zui.Tabs, {
      items: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
      children: h(zui.TabPanel, { value: "b", keepMounted: true }, "kept"),
    });
    assert.match(kept, /data-value="b" data-state="inactive" tabindex="0" hidden="">kept</);
  });
  test("Accordion: encabezado real del nivel pedido, botón con aria-expanded/-controls y región oculta al cerrar", () => {
    const html = render(zui.Accordion, {
      headingLevel: 4,
      defaultValue: ["x"],
      items: [
        { value: "x", title: "X", content: "cx" },
        { value: "y", title: "Y", content: "cy", disabled: true },
      ],
    });
    assert.equal(count(html, /<h4 class="z-accordion__header">/g), 2);
    assert.doesNotMatch(html, /aria-level/);
    assert.match(html, /<div class="z-accordion" data-type="single">/);
    assert.match(html, /id="([^"]+)-x" class="z-accordion__trigger" data-state="open" aria-expanded="true" aria-controls="\1-x-content"/);
    assert.match(html, /id="([^"]+)-x-content" role="region" aria-labelledby="\1-x" class="z-accordion__content" data-state="open"/);
    assert.match(
      html,
      /class="z-accordion__content" data-state="closed" hidden=""[^>]*><div class="z-accordion__body">cy</,
      "el contenido cerrado sigue en el marcado, oculto",
    );
    assert.match(html, /class="z-accordion__trigger" data-state="closed" data-disabled="" aria-expanded="false"[^>]*disabled=""/);
  });
  test("Accordion multiple abre varias; single solo la primera", () => {
    const items = [
      { value: "x", title: "X", content: "cx" },
      { value: "y", title: "Y", content: "cy" },
    ];
    assert.equal(count(render(zui.Accordion, { type: "multiple", defaultValue: ["x", "y"], items }), /aria-expanded="true"/g), 2);
    assert.equal(count(render(zui.Accordion, { defaultValue: ["x", "y"], items }), /aria-expanded="true"/g), 1);
  });
});

describe("controles de formulario", () => {
  test("Checkbox: role checkbox, mixed en indeterminado y campo nativo oculto con nombre y valor", () => {
    const html = render(zui.Checkbox, { defaultChecked: "indeterminate", name: "terms", value: "yes", required: true, children: "Terms" });
    assert.match(
      html,
      /<button type="button" role="checkbox" aria-checked="mixed" aria-required="true" data-state="indeterminate" value="yes" class="z-check__box">/,
    );
    assert.match(
      html,
      /<input type="checkbox" class="z-native-input" aria-hidden="true" tabindex="-1" required="" name="terms" value="yes"\/>/,
    );
    assert.match(render(zui.Checkbox, { defaultChecked: true, name: "t" }), /<input type="checkbox"[^>]*name="t" checked=""/);
  });
  test("Switch: role switch con aria-checked y campo nativo", () => {
    const html = render(zui.Switch, { defaultChecked: true, name: "auto", disabled: true, children: "Auto" });
    assert.match(html, /role="switch" aria-checked="true" data-state="checked" data-disabled="" disabled=""/);
    assert.match(html, /<span class="z-switch__thumb" data-state="checked">/);
    assert.match(html, /<input type="checkbox" class="z-native-input"[^>]*disabled="" name="auto" checked=""/);
  });
  test("RadioGroup: radios con el nombre del grupo; la elegida es la parada de tabulación", () => {
    const html = render(zui.RadioGroup, {
      defaultValue: "b",
      name: "plan",
      required: true,
      "aria-label": "Plan",
      orientation: "horizontal",
      children: [h(zui.Radio, { key: "a", value: "a" }, "A"), h(zui.Radio, { key: "b", value: "b" }, "B")],
    });
    assert.match(html, /role="radiogroup" aria-required="true" aria-orientation="horizontal" data-orientation="horizontal"/);
    assert.match(
      html,
      /role="radio" aria-checked="true" data-state="checked" value="b" tabindex="0" class="z-radio__dot"><span class="z-radio__mark" data-state="checked">/,
    );
    assert.match(html, /role="radio" aria-checked="false" data-state="unchecked" value="a" tabindex="-1" class="z-radio__dot"><\/button>/);
    assert.equal(count(html, /<input type="radio" class="z-native-input"[^>]*name="plan"/g), 2);
    assert.throws(() => render(zui.Radio, { value: "x" }), /inside <RadioGroup>/);
  });
  test("SegmentedControl: radiogroup con una parada de tabulación (la elegida, o la primera habilitada)", () => {
    const items = [
      { value: "l", label: "L", disabled: true },
      { value: "g", label: "G" },
      { value: "b", label: "B" },
    ];
    const chosen = render(zui.SegmentedControl, { label: "View", defaultValue: "b", items });
    assert.match(chosen, /<div role="radiogroup" aria-label="View" class="z-segmented" data-size="md">/);
    assert.match(chosen, /aria-checked="true" data-state="on" value="b" tabindex="0"/);
    assert.equal(count(chosen, /tabindex="0"/g), 1);
    const none = render(zui.SegmentedControl, { label: "View", items });
    assert.match(none, /data-state="off" value="g" tabindex="0"/, "sin elección, la primera habilitada");
    assert.match(none, /data-disabled="" disabled="" value="l" tabindex="-1"/);
  });
  test("Toggle: aria-pressed y data-state", () => {
    assert.match(render(zui.Toggle, { defaultPressed: true, label: "Star" }), /aria-pressed="true" aria-label="Star" data-state="on"/);
    assert.match(render(zui.Toggle, { label: "Star", children: "Star" }), /aria-pressed="false"[^>]*data-state="off"/);
  });
  test("Slider: tiradores role=slider, atributos data-* del contrato, valores ajustados al paso y un campo por tirador", () => {
    const html = render(zui.Slider, { defaultValue: [22, 80], min: 0, max: 100, step: 5, name: "range", thumbLabels: ["From", "To"] });
    assert.match(
      html,
      /<span class="z-slider" data-size="md" data-orientation="horizontal" data-min="0" data-max="100" data-step="5" data-value="20,80">/,
    );
    assert.match(html, /class="z-slider__range" style="inset-inline-start:20%;inset-inline-end:20%"/);
    assert.match(
      html,
      /role="slider" tabindex="0" aria-label="From" aria-valuemin="0" aria-valuemax="100" aria-valuenow="20" aria-orientation="horizontal"/,
    );
    assert.deepEqual(
      [...html.matchAll(/<input type="hidden" name="range" value="(\d+)"\/>/g)].map((m) => m[1]),
      ["20", "80"],
    );
    const one = render(zui.Slider, { defaultValue: [60], inverted: true, disabled: true, orientation: "vertical", "aria-label": "V" });
    assert.match(one, /data-orientation="vertical"[^>]*data-disabled="" data-inverted=""/);
    assert.match(one, /class="z-slider__range" style="top:0%;bottom:40%"/);
    assert.match(one, /role="slider" tabindex="-1"[^>]*aria-disabled="true"/);
  });
  test("Select: combobox con aria-required válido y un select nativo oculto para el formulario", () => {
    const html = render(zui.Select, {
      name: "view",
      required: true,
      "aria-label": "View",
      placeholder: "Choose",
      options: [
        { value: "l", label: "List" },
        { label: "More", options: [{ value: "g", label: "Grid", disabled: true }] },
      ],
    });
    assert.match(
      html,
      /<button type="button" role="combobox" class="z-select__control" aria-haspopup="listbox" aria-expanded="false" aria-required="true" aria-label="View" data-state="closed" data-placeholder="">/,
    );
    assert.match(html, /<span class="z-select__value">Choose<\/span>/);
    assert.match(
      html,
      /<select class="z-native-input" aria-hidden="true" tabindex="-1" name="view" required=""><option value="" selected=""><\/option><option value="l">List<\/option><option value="g" disabled="">Grid<\/option><\/select>/,
    );
    const chosen = render(zui.Select, { defaultValue: "l", options: [{ value: "l", label: "List" }], "aria-label": "View" });
    assert.match(chosen, /data-value="l"/);
    assert.match(chosen, /<span class="z-select__value">List<\/span>/);
    assert.doesNotMatch(chosen, /<select/, "sin name ni required no hay campo de formulario");
  });
  test("DatePicker obligatorio: el botón no lleva aria-required (no lo admite su rol); valida un campo nativo", () => {
    const html = render(zui.DatePicker, { required: true, name: "due", defaultValue: "2026-11-13", "aria-label": "Due", locale: "en-US" });
    assert.doesNotMatch(html, /aria-required/);
    assert.match(html, /<button type="button" class="z-select__control" aria-haspopup="dialog" aria-expanded="false"/);
    assert.match(
      html,
      /<input type="text" class="z-native-input" aria-hidden="true" tabindex="-1" required="" name="due" value="2026-11-13"\/>/,
    );
    const range = render(zui.DatePicker, { mode: "range", name: "stay", defaultValue: { from: "2026-11-09", to: null } });
    assert.match(range, /name="stay" value="2026-11-09\/"/);
  });
});

describe("acciones y navegación", () => {
  test("Button e IconButton en carga: aria-disabled y aria-busy, sin el atributo disabled", () => {
    for (const html of [
      render(zui.Button, { loading: true, children: "Save" }),
      render(zui.IconButton, { loading: true, icon: "plus", label: "Add" }),
    ]) {
      assert.match(html, /data-loading="true" aria-busy="true" aria-disabled="true"/);
      assert.doesNotMatch(html, /\sdisabled=""/);
    }
    assert.match(render(zui.Button, { disabled: true, children: "Save" }), /\sdisabled=""/);
    assert.doesNotMatch(render(zui.Button, { children: "Save" }), /aria-disabled/);
  });
  test("NavLink asChild: el hijo es el elemento, con clases y props fusionadas y su contenido entre el icono y el final", () => {
    const html = render(zui.NavLink, {
      asChild: true,
      active: true,
      trailing: "3",
      "data-x": "1",
      children: h("a", { href: "/home", className: "app" }, "Home"),
    });
    assert.equal(
      html,
      '<a href="/home" class="z-navlink app" data-x="1" aria-current="page" data-active="true">Home<span class="z-navlink__trailing">3</span></a>',
    );
    assert.match(render(zui.NavLink, { asChild: true, disabled: true, children: h("a", { href: "/x" }, "X") }), /aria-disabled="true"/);
  });
  test("disparadores: Menu, Modal y Popover anotan a su hijo sin envolverlo", () => {
    assert.match(
      render(zui.Menu, { trigger: h("button", { className: "mine" }, "Open"), items: [] }),
      /^<button class="mine" aria-haspopup="menu" aria-expanded="false" data-state="closed" id="[^"]+">Open<\/button>$/,
    );
    assert.match(
      render(zui.Modal, { trigger: h("button", null, "Open"), title: "T" }),
      /^<button aria-haspopup="dialog" aria-expanded="false" data-state="closed">Open<\/button>$/,
    );
    assert.match(
      render(zui.Popover, { trigger: h("button", null, "Open"), label: "Usage" }),
      /^<button aria-haspopup="dialog" aria-expanded="false" data-state="closed">Open<\/button>$/,
    );
    assert.equal(render(zui.Tooltip, { content: "", children: h("button", null, "x") }), "<button>x</button>");
    assert.match(render(zui.Tooltip, { content: "Tip", children: h("button", null, "x") }), /^<button data-state="closed">x<\/button>$/);
    assert.equal(render(zui.ContextMenu, { items: [], children: h("div", null, "zone") }), '<div data-state="closed">zone</div>');
  });
});
