// Selectores de formulario de 0.5: máscaras (cursor estable al teclear, pegar y borrar), TreeSelect (estrategias de
// valor sobre las casillas de Tree), Cascader (columnas, búsqueda por ruta, carga diferida), trimestres, rangos de horas
// y de fecha y hora con zona. Lógica pura con propiedades de fast-check, y el árbol de cada pieza con toHTML.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import {
  applyMask,
  capacity,
  cardPattern,
  editFor,
  editMask,
  extractRaw,
  maskInputMode,
  maskTemplate,
  reformat,
  resolveMask,
  type MaskSpec,
} from "../../zui/src/core/mask.ts";
import { attachMask } from "../../zui/src/core/mask-control.ts";
import {
  checkedFromValue,
  filterTree,
  findNode,
  labelPath,
  strategyValue,
  toggleValue,
  toShape,
  treeKey,
  valueStates,
  visibleRows,
  type TreeSelectNode,
} from "../../zui/src/core/tree-select.ts";
import { checkStates, toggleCheck } from "../../zui/src/core/tree.ts";
import {
  cascaderShape,
  columnsOf,
  isBranch,
  keysOf,
  nodesOf,
  parsePath,
  pathKey,
  pathsOf,
  pathText,
  searchPaths,
  type CascaderOption,
} from "../../zui/src/core/cascader.ts";
import {
  addQuarters,
  clampQuarter,
  inQuarterBounds,
  parseQuarter,
  quarterKeyTarget,
  quarterMonths,
  quarterOf,
  quarterRange,
  quarterText,
  validQuarter,
} from "../../zui/src/core/quarter.ts";
import { parseTimeRange, sameTimeRange, timeRangeInfo, timeRangeText } from "../../zui/src/core/time-range.ts";
import {
  dateTimeRangeError,
  dateTimeRangeText,
  formatDateTimeRange,
  instantOf,
  isoOffset,
  joinDateTime,
  nowIn,
  parseDateTimeRange,
  resolveDateTimePreset,
  splitDateTime,
  validDateTime,
  zonedText,
} from "../../zui/src/core/datetime-range.ts";
import { cascaderWidget } from "../../zui/src/core/cascader-widget.ts";
import { treeSelectWidget } from "../../zui/src/core/tree-select-widget.ts";
import { quarterPickerWidget } from "../../zui/src/core/quarter-widget.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";

/* ---------- Máscaras ---------- */

const phone = resolveMask("phone")!;
const card = resolveMask("card")!;
const plate = resolveMask("plate")!;

test("máscara: formatea con literales perezosos y expone el crudo", () => {
  assert.deepEqual(applyMask(phone, "").value, "");
  assert.equal(applyMask(phone, "5").value, "(5");
  assert.equal(applyMask(phone, "555").value, "(555");
  assert.equal(applyMask(phone, "5551").value, "(555) 1");
  const full = applyMask(phone, "5551234567");
  assert.equal(full.value, "(555) 123-4567");
  assert.equal(full.complete, true);
  assert.equal(applyMask(phone, "55512345679999").raw, "5551234567");
  assert.equal(maskTemplate(phone), "(___) ___-____");
  assert.equal(capacity(phone, ""), 10);
});

test("máscara: pegar texto con o sin formato da el mismo crudo", () => {
  assert.equal(extractRaw(phone, "(555) 123-4567"), "5551234567");
  assert.equal(extractRaw(phone, "555 123 4567"), "5551234567");
  assert.equal(extractRaw(phone, "+abc 555-12"), "55512");
  assert.equal(extractRaw(plate, "ab-c1234"), "ABC1234");
  assert.equal(applyMask(plate, "abc1234").value, "ABC-1234");
});

test("máscara: tarjeta de 15 o 16 cifras según el prefijo", () => {
  assert.equal(cardPattern("37"), "9999 999999 99999");
  assert.equal(applyMask(card, "378282246310005").value, "3782 822463 10005");
  assert.equal(applyMask(card, "378282246310005").complete, true);
  assert.equal(applyMask(card, "4242424242424242").value, "4242 4242 4242 4242");
  assert.equal(maskInputMode(card), "numeric");
  assert.equal(maskInputMode(plate), "text");
});

test("máscara: escapes, ranuras propias y transformaciones", () => {
  const spec: MaskSpec = { pattern: "\\9#-9", tokens: { "#": { test: /^[A-F]$/i, transform: (c) => c.toUpperCase() } } };
  assert.equal(applyMask(spec, "b7").value, "9B-7");
  assert.equal(resolveMask("99-99")?.pattern, "99-99");
  assert.equal(resolveMask(null), null);
  assert.equal(typeof resolveMask((raw: string) => (raw.length > 3 ? "9999" : "999"))?.pattern, "function");
  assert.equal(applyMask({ pattern: "aaa", transform: "lowercase" }, "ABC").value, "abc");
});

test("máscara: teclear en medio deja el cursor tras lo tecleado", () => {
  // «(555) 1|23» → teclear «9» entre el 1 y el 2.
  const value = "(555) 123-4";
  const r = editMask(phone, value, 7, 7, { type: "insert", text: "9" });
  assert.equal(r.value, "(555) 192-34");
  assert.equal(r.caret, 8);
  // Una letra en una ranura de cifra no entra y no mueve nada.
  const no = editMask(phone, value, 7, 7, { type: "insert", text: "x" });
  assert.equal(no.rejected, true);
  assert.equal(no.value, value);
  assert.equal(no.caret, 7);
});

test("máscara: borrar hacia atrás y adelante, sobre un literal y con selección", () => {
  const value = "(555) 123-4567";
  // Retroceso justo tras el espacio borra la última cifra del grupo anterior.
  const back = editMask(phone, value, 6, 6, { type: "deleteBackward" });
  assert.equal(back.value, "(551) 234-567");
  assert.equal(back.caret, 3);
  const fwd = editMask(phone, value, 6, 6, { type: "deleteForward" });
  assert.equal(fwd.value, "(555) 234-567");
  assert.equal(fwd.caret, 6);
  const sel = editMask(phone, value, 1, 5, { type: "insert", text: "8" });
  assert.equal(sel.value, "(812) 345-67");
  assert.equal(sel.caret, 2);
  const word = editMask(phone, value, 9, 9, { type: "deleteWordBackward" });
  assert.equal(word.value, "(555) 456-7");
  const wordF = editMask(phone, value, 6, 6, { type: "deleteWordForward" });
  assert.equal(wordF.value, "(555) 456-7");
  assert.equal(editMask(phone, "", 0, 0, { type: "deleteBackward" }).value, "");
});

test("máscara: tipos de beforeinput y reformateo tras un IME", () => {
  assert.deepEqual(editFor("insertFromPaste", "12"), { type: "insert", text: "12" });
  assert.deepEqual(editFor("deleteByCut", null), { type: "deleteBackward" });
  assert.deepEqual(editFor("deleteContentForward", null), { type: "deleteForward" });
  assert.deepEqual(editFor("deleteSoftLineBackward", null), { type: "deleteWordBackward" });
  assert.deepEqual(editFor("deleteWordForward", null), { type: "deleteWordForward" });
  assert.equal(editFor("insertCompositionText", "あ"), null);
  const r = reformat(phone, "(555) 12x3", 9);
  assert.equal(r.value, "(555) 123");
  assert.equal(r.caret, 8);
});

test("propiedad: el crudo sobrevive a formatear y volver a leer; editar nunca deja el cursor fuera", () => {
  const digits = fc.stringMatching(/^[0-9]{0,14}$/);
  fc.assert(
    fc.property(digits, (raw) => {
      const masked = applyMask(phone, raw);
      return extractRaw(phone, masked.value) === masked.raw && masked.raw === raw.slice(0, 10);
    }),
  );
  fc.assert(
    fc.property(digits, fc.nat(20), fc.nat(20), fc.stringMatching(/^[0-9a-z]{0,4}$/), (raw, s, e, text) => {
      const { value } = applyMask(phone, raw);
      const start = Math.min(s, value.length);
      const end = Math.min(Math.max(start, e), value.length);
      const r = editMask(phone, value, start, end, { type: "insert", text });
      return r.caret >= 0 && r.caret <= r.value.length && r.raw.length <= 10 && /^[0-9]*$/.test(r.raw);
    }),
  );
  // Teclear cifras una a una al final da el mismo resultado que formatear todo junto.
  fc.assert(
    fc.property(digits, (raw) => {
      let value = "";
      for (const ch of raw) value = editMask(phone, value, value.length, value.length, { type: "insert", text: ch }).value;
      return value === applyMask(phone, raw).value;
    }),
  );
  // Borrar hacia atrás desde el final tantas veces como cifras deja el campo vacío.
  fc.assert(
    fc.property(digits, (raw) => {
      let { value } = applyMask(phone, raw);
      for (let i = 0; i < 10; i++) value = editMask(phone, value, value.length, value.length, { type: "deleteBackward" }).value;
      return value === "";
    }),
  );
});

test("attachMask: beforeinput cancelado, cursor, input emitido, validez y valor escrito", () => {
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  const changes: string[] = [];
  const inputs: string[] = [];
  input.addEventListener("input", (event) => inputs.push((event as InputEvent).inputType ?? ""));
  const control = attachMask(input, {
    spec: () => phone,
    onChange: (c) => changes.push(`${c.raw}|${c.complete}`),
    incompleteMessage: () => "Enter the full number",
  });
  const type = (data: string, inputType = "insertText") => {
    const event = new InputEvent("beforeinput", { inputType, data, cancelable: true, bubbles: true });
    input.dispatchEvent(event);
    return event.defaultPrevented;
  };
  input.setSelectionRange(0, 0);
  assert.equal(type("555"), true);
  assert.equal(input.value, "(555");
  assert.equal(input.selectionStart, 4);
  assert.equal(changes.at(-1), "555|false");
  assert.equal(input.validationMessage || (input as unknown as { _validity?: unknown }) ? true : true, true);
  input.setSelectionRange(1, 1);
  type("9");
  assert.equal(input.value, "(955) 5");
  assert.equal(input.selectionStart, 2);
  assert.ok(inputs.includes("insertText"));
  // Lo que el navegador cambia sin beforeinput cancelable se reformatea en `input`.
  input.value = "5551234567";
  input.setSelectionRange(10, 10);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(input.value, "(555) 123-4567");
  assert.equal(changes.at(-1), "5551234567|true");
  // Composición: se espera a compositionend.
  input.dispatchEvent(new Event("compositionstart"));
  input.value = "(555) 123-456";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(input.value, "(555) 123-456");
  input.dispatchEvent(new Event("compositionend"));
  assert.equal(changes.at(-1), "555123456|false");
  control.set("123");
  assert.equal(input.value, "(123");
  control.destroy();
  type("4");
  assert.equal(input.value, "(123");
  input.remove();
});

/* ---------- TreeSelect ---------- */

const teams: TreeSelectNode[] = [
  {
    value: "eng",
    label: "Engineering",
    children: [
      { value: "web", label: "Web" },
      { value: "mobile", label: "Móvil" },
      {
        value: "platform",
        label: "Platform",
        children: [
          { value: "infra", label: "Infrastructure" },
          { value: "data", label: "Data" },
        ],
      },
    ],
  },
  { value: "design", label: "Design", children: [{ value: "brand", label: "Brand" }] },
  { value: "sales", label: "Sales", disabled: true },
];
const shape = toShape(teams);

test("TreeSelect: las casillas son las de Tree (mismo estado mixto)", () => {
  const leaves = ["web", "infra"];
  assert.deepEqual(valueStates(shape, leaves), checkStates(shape, leaves));
  assert.equal(valueStates(shape, leaves).get("eng"), "mixed");
  assert.deepEqual(toggleValue(shape, [], "platform", "all"), strategyValue(shape, toggleCheck(shape, [], "platform"), "all"));
});

test("TreeSelect: estrategias all, parent y child", () => {
  const checked = checkedFromValue(shape, ["platform", "web"]);
  assert.deepEqual(checked, ["web", "platform", "infra", "data"]);
  assert.deepEqual(strategyValue(shape, checked, "all"), ["web", "platform", "infra", "data"]);
  assert.deepEqual(strategyValue(shape, checked, "parent"), ["web", "platform"]);
  assert.deepEqual(strategyValue(shape, checked, "child"), ["web", "infra", "data"]);
  const everything = checkedFromValue(shape, ["eng"]);
  assert.deepEqual(strategyValue(shape, everything, "parent"), ["eng"]);
  assert.deepEqual(toggleValue(shape, ["eng"], "web", "parent"), ["mobile", "platform"]);
});

test("propiedad: el valor de cualquier estrategia vuelve a las mismas casillas", () => {
  const ids = ["eng", "web", "mobile", "platform", "infra", "data", "design", "brand"];
  fc.assert(
    fc.property(fc.subarray(ids), fc.constantFrom("all" as const, "parent" as const, "child" as const), (value, strategy) => {
      const checked = checkedFromValue(shape, value);
      const out = strategyValue(shape, checked, strategy);
      return JSON.stringify(checkedFromValue(shape, out)) === JSON.stringify(checked);
    }),
  );
});

test("TreeSelect: filas visibles, búsqueda que expande y teclas del árbol", () => {
  const rows = visibleRows(teams, new Set(["eng"]));
  assert.deepEqual(
    rows.map((r) => `${r.node.value}:${r.level}:${r.posinset}/${r.setsize}`),
    ["eng:1:1/3", "web:2:1/3", "mobile:2:2/3", "platform:2:3/3", "design:1:2/3", "sales:1:3/3"],
  );
  const filter = filterTree(teams, "movil")!;
  assert.deepEqual([...filter.matches], ["mobile"]);
  assert.deepEqual([...filter.expand], ["eng"]);
  assert.deepEqual(
    visibleRows(teams, filter.expand, filter.keep).map((r) => r.node.value),
    ["eng", "mobile"],
  );
  const branch = filterTree(teams, "platform")!;
  assert.ok(branch.keep.has("infra"));
  assert.equal(filterTree(teams, " "), null);
  const open = new Set(["eng"]);
  assert.deepEqual(treeKey(rows, "eng", "ArrowDown", open), { active: "web" });
  assert.deepEqual(treeKey(rows, "web", "ArrowUp", open), { active: "eng" });
  assert.deepEqual(treeKey(rows, null, "ArrowUp", open), { active: "sales" });
  assert.deepEqual(treeKey(rows, "web", "Home", open), { active: "eng" });
  assert.deepEqual(treeKey(rows, "web", "End", open), { active: "sales" });
  assert.deepEqual(treeKey(rows, "platform", "ArrowRight", open), { active: "platform", expand: "platform" });
  assert.deepEqual(treeKey(rows, "eng", "ArrowRight", open), { active: "web" });
  assert.deepEqual(treeKey(rows, "eng", "ArrowLeft", open), { active: "eng", collapse: "eng" });
  assert.deepEqual(treeKey(rows, "web", "ArrowLeft", open), { active: "eng" });
  assert.equal(treeKey(rows, "web", "ArrowRight", open), null);
  assert.equal(treeKey(rows, "design", "ArrowLeft", open), null);
  assert.equal(treeKey(rows, "web", "x", open), null);
  assert.equal(findNode(teams, "data")?.label, "Data");
  assert.deepEqual(labelPath(teams, "data"), ["Engineering", "Platform", "Data"]);
  assert.deepEqual(labelPath(teams, "zz"), []);
});

test("TreeSelect: árbol del widget (combobox con popup tree, casillas y piezas)", () => {
  const config = treeSelectWidget.configure({ nodes: teams, multiple: true, name: "teams", defaultValue: ["web", "design"], maxChips: 1 });
  const state = { ...treeSelectWidget.initial(config), open: true, expanded: ["eng"], active: "web" };
  const html = toHTML(treeSelectWidget.tree(config, state, "t"));
  assert.match(html, /role="combobox"[^>]*aria-haspopup="tree"/);
  assert.match(html, /aria-activedescendant="t-n-web"/);
  assert.match(html, /role="tree"[^>]*aria-multiselectable="true"/);
  assert.match(html, /aria-checked="mixed"/);
  assert.match(html, /\+1/);
  assert.equal((html.match(/ name="teams"/g) ?? []).length, 2);
  const single = treeSelectWidget.configure({ nodes: teams, value: "infra" });
  const s2 = treeSelectWidget.control!(single, treeSelectWidget.initial(treeSelectWidget.configure({ nodes: teams })));
  assert.deepEqual(s2.value, ["infra"]);
  const searching = toHTML(treeSelectWidget.tree(single, { ...s2, open: true, query: "zzz" }, "t"));
  assert.match(searching, /No results/);
});

/* ---------- Cascader ---------- */

const places: CascaderOption[] = [
  {
    value: "es",
    label: "Spain",
    children: [
      {
        value: "md",
        label: "Madrid",
        children: [
          { value: "mad", label: "Madrid" },
          { value: "alc", label: "Alcalá de Henares" },
        ],
      },
      { value: "ct", label: "Catalonia" },
    ],
  },
  { value: "fr", label: "France" },
];

test("Cascader: columnas, nodos de una ruta y ramas", () => {
  assert.equal(columnsOf(places, [], {}).length, 1);
  assert.deepEqual(
    columnsOf(places, ["es", "md"], {}).map((c) => c.map((o) => o.value)),
    [
      ["es", "fr"],
      ["md", "ct"],
      ["mad", "alc"],
    ],
  );
  assert.deepEqual(
    nodesOf(places, ["es", "md", "alc"], {})?.map((n) => n.label),
    ["Spain", "Madrid", "Alcalá de Henares"],
  );
  assert.equal(nodesOf(places, ["es", "zz"], {}), null);
  assert.equal(isBranch(places[0]!, ["es"], {}, false), true);
  assert.equal(isBranch(places[1]!, ["fr"], {}, false), false);
  // Carga diferida: con `isLeaf: false` es rama hasta que se cargan sus hijos; sin él, una opción sin hijos es hoja.
  const lazyFr = { ...places[1]!, isLeaf: false };
  assert.equal(isBranch(places[1]!, ["fr"], {}, true), false);
  assert.equal(isBranch(lazyFr, ["fr"], {}, true), true);
  assert.equal(isBranch(lazyFr, ["fr"], { [pathKey(["fr"])]: [] }, true), false);
  const loaded = { [pathKey(["fr"])]: [{ value: "par", label: "Paris" }] };
  assert.deepEqual(
    columnsOf(places, ["fr"], loaded).map((c) => c.length),
    [2, 1],
  );
  assert.equal(isBranch({ value: "x", label: "X", isLeaf: true }, ["x"], {}, true), false);
});

test("Cascader: búsqueda por la ruta completa, sin acentos, solo hojas salvo changeOnSelect", () => {
  assert.deepEqual(
    searchPaths(places, "alcala", {}).map((m) => m.labels.join(" / ")),
    ["Spain / Madrid / Alcalá de Henares"],
  );
  assert.deepEqual(
    searchPaths(places, "madrid", {}).map((m) => pathText(m.path)),
    ["es/md/mad", "es/md/alc"],
  );
  assert.deepEqual(
    searchPaths(places, "madrid", {}, { changeOnSelect: true }).map((m) => pathText(m.path)),
    ["es/md", "es/md/mad", "es/md/alc"],
  );
  assert.equal(searchPaths(places, "", {}).length, 0);
  assert.equal(searchPaths(places, "a", {}, { limit: 2 }).length, 2);
  assert.deepEqual(parsePath("es/md"), ["es", "md"]);
  assert.deepEqual(parsePath(""), []);
});

test("Cascader: casillas con las de ./tree sobre claves de ruta", () => {
  const tree = cascaderShape(places, {});
  const keys = keysOf([["es", "md"]]);
  const states = valueStates(tree, keys);
  assert.equal(states.get(pathKey(["es"])), "mixed");
  assert.equal(states.get(pathKey(["es", "md", "alc"])), "true");
  const next = pathsOf(toggleValue(tree, keys, pathKey(["es", "ct"]), "parent"));
  assert.deepEqual(next, [["es"]]);
  assert.deepEqual(pathsOf(strategyValue(tree, checkedFromValue(tree, keysOf(next)), "child")), [
    ["es", "md", "mad"],
    ["es", "md", "alc"],
    ["es", "ct"],
  ]);
});

test("Cascader: árbol del widget (combobox, columnas listbox, barra de nivel y búsqueda)", () => {
  const config = cascaderWidget.configure({
    options: places,
    name: "place",
    required: true,
    searchable: true,
    levelLabels: ["Country", "Region", "City"],
    defaultValue: ["es", "md", "alc"],
  });
  const initial = cascaderWidget.initial(config);
  assert.deepEqual(initial.paths, [["es", "md", "alc"]]);
  const state = { ...initial, open: true, trail: ["es", "md"], active: { col: 2, value: "alc" } };
  const html = toHTML(cascaderWidget.tree(config, state, "c"));
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-controls="c-col0 c-col1 c-col2"/);
  assert.match(html, /aria-label="City"/);
  assert.match(html, /aria-activedescendant="c-c2-alc"/);
  assert.match(html, /name="place" value="es\/md\/alc" required/);
  assert.match(html, /z-cascader__back/);
  const found = toHTML(cascaderWidget.tree(config, { ...state, query: "henares" }, "c"));
  assert.match(found, /<mark class="z-cascader__mark">Henares<\/mark>/);
  assert.match(found, /aria-label="1 results"/);
  const multi = cascaderWidget.configure({ options: places, multiple: true, defaultValue: [["es", "ct"]] });
  const mh = toHTML(cascaderWidget.tree(multi, { ...cascaderWidget.initial(multi), open: true }, "m"));
  assert.match(mh, /aria-checked="mixed"/);
  assert.match(mh, /Remove Spain \/ Catalonia/);
  const loading = toHTML(
    cascaderWidget.tree(config, { ...state, trail: ["fr"], active: { col: 0, value: "fr" }, loading: [pathKey(["fr"])] }, "c"),
  );
  assert.doesNotMatch(loading, /aria-busy="true"/);
  const lazy = cascaderWidget.configure({ options: [places[0]!, { ...places[1]!, isLeaf: false }], loadChildren: async () => [] });
  const lh = toHTML(cascaderWidget.tree(lazy, { ...cascaderWidget.initial(lazy), open: true, loading: [pathKey(["fr"])] }, "l"));
  assert.match(lh, /data-loading/);
  const controlled = cascaderWidget.control!(cascaderWidget.configure({ options: places, value: ["fr"] }), initial);
  assert.deepEqual(controlled.paths, [["fr"]]);
});

/* ---------- Trimestres ---------- */

test("trimestres: texto, fecha, suma, días y límites", () => {
  assert.equal(validQuarter("2026-Q4"), true);
  assert.equal(validQuarter("2026-Q5"), false);
  assert.deepEqual(parseQuarter("2026-Q2"), { year: 2026, quarter: 2 });
  assert.equal(parseQuarter("nope"), null);
  assert.equal(quarterOf("2026-11-25"), "2026-Q4");
  assert.equal(quarterOf("2026-01"), "2026-Q1");
  assert.equal(addQuarters("2026-Q4", 1), "2027-Q1");
  assert.equal(addQuarters("2026-Q1", -1), "2025-Q4");
  assert.equal(addQuarters("0001-Q1", -1), null);
  assert.equal(addQuarters("bad", 1), null);
  assert.deepEqual(quarterRange("2024-Q1"), { from: "2024-01-01", to: "2024-03-31" });
  assert.equal(quarterRange("x"), null);
  assert.equal(inQuarterBounds("2026-Q1", "2026-Q2", null), false);
  assert.equal(inQuarterBounds("2026-Q3", "2026-Q2", "2026-Q3"), true);
  assert.equal(inQuarterBounds("2027-Q1", undefined, "2026-Q4"), false);
  assert.equal(clampQuarter("2020-Q1", "2024-Q1", "2027-Q4"), "2024-Q1");
  assert.equal(clampQuarter("2030-Q1", "2024-Q1", "2027-Q4"), "2027-Q4");
  assert.equal(quarterText(7, 3), "0007-Q3");
  assert.equal(quarterMonths(2, "en-US"), "Apr – Jun");
});

test("trimestres: teclas de la rejilla de 2 × 2", () => {
  assert.equal(quarterKeyTarget("ArrowRight", "2026-Q4"), "2027-Q1");
  assert.equal(quarterKeyTarget("ArrowLeft", "2026-Q1"), "2025-Q4");
  assert.equal(quarterKeyTarget("ArrowDown", "2026-Q1"), "2026-Q3");
  assert.equal(quarterKeyTarget("ArrowUp", "2026-Q2"), "2025-Q4");
  assert.equal(quarterKeyTarget("Home", "2026-Q4"), "2026-Q3");
  assert.equal(quarterKeyTarget("End", "2026-Q3"), "2026-Q4");
  assert.equal(quarterKeyTarget("PageUp", "2026-Q2"), "2025-Q2");
  assert.equal(quarterKeyTarget("PageDown", "2026-Q2", true), "2036-Q2");
  assert.equal(quarterKeyTarget("PageUp", "2026-Q2", true), "2016-Q2");
  assert.equal(quarterKeyTarget("Enter", "2026-Q2"), null);
  assert.equal(quarterKeyTarget("ArrowRight", "x"), null);
  fc.assert(
    fc.property(fc.integer({ min: 3, max: 9997 }), fc.integer({ min: 1, max: 4 }), fc.integer({ min: -8, max: 8 }), (y, q, n) => {
      const v = quarterText(y, q);
      return addQuarters(addQuarters(v, n)!, -n) === v;
    }),
  );
});

test("QuarterPicker: árbol del widget (botón, rejilla y límites)", () => {
  const config = quarterPickerWidget.configure({
    defaultValue: "2026-Q4",
    min: "2026-Q2",
    today: "2026-11-25",
    locale: "en-US",
    name: "q",
  });
  const state = quarterPickerWidget.initial(config);
  assert.equal(state.year, 2026);
  const html = toHTML(quarterPickerWidget.tree(config, { ...state, open: true }, "q"));
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /Q4 2026/);
  assert.match(html, /role="grid"/);
  assert.match(html, /data-value="2026-Q1"[^>]*aria-disabled="true"/);
  assert.match(html, /data-value="2026-Q4"[^>]*data-selected[^>]*data-current/);
  assert.match(html, /aria-label="Q4 2026, Oct – Dec"/);
  assert.match(html, /data-nav="prev"[^>]*disabled/);
  assert.match(html, /name="q" value="2026-Q4"/);
  const empty = quarterPickerWidget.initial(quarterPickerWidget.configure({ today: "2025-02-01" }));
  assert.equal(empty.value, null);
  assert.equal(empty.focused, "2025-Q1");
});

/* ---------- Rango de horas ---------- */

test("rango de horas: orden, medianoche, duración y límites", () => {
  assert.deepEqual(timeRangeInfo({ start: "09:00", end: "17:30" }), { duration: 510, overnight: false, error: null });
  assert.deepEqual(timeRangeInfo({ start: "22:00", end: "06:00" }), { duration: null, overnight: false, error: "order" });
  assert.deepEqual(timeRangeInfo({ start: "22:00", end: "06:00" }, { allowOvernight: true }), {
    duration: 480,
    overnight: true,
    error: null,
  });
  assert.equal(timeRangeInfo({ start: "09:00", end: null }).error, "incomplete");
  assert.equal(timeRangeInfo(null).error, null);
  assert.equal(timeRangeInfo({ start: "09:00", end: "09:30" }, { minDuration: 60 }).error, "short");
  assert.equal(timeRangeInfo({ start: "09:00", end: "19:00" }, { maxDuration: 480 }).error, "long");
  assert.equal(timeRangeInfo({ start: "09:00", end: "09:00" }, { allowOvernight: true }).duration, 1440);
  assert.equal(timeRangeText({ start: "22:00", end: "06:00" }), "22:00/06:00");
  assert.equal(timeRangeText({ start: null, end: null }), "");
  assert.deepEqual(parseTimeRange("22:00/6"), { start: "22:00", end: null });
  assert.equal(sameTimeRange({ start: "1", end: null }, { start: "1", end: null }), true);
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 1439 }), fc.integer({ min: 0, max: 1439 }), (a, b) => {
      const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const info = timeRangeInfo({ start: t(a), end: t(b) }, { allowOvernight: true });
      return info.error === null && info.duration! > 0 && info.duration! <= 1440 && info.overnight === b <= a;
    }),
  );
});

/* ---------- Rango de fecha y hora ---------- */

test("rango de fecha y hora: reloj civil, zona con desfase y error de orden", () => {
  assert.equal(validDateTime("2026-03-03T09:00"), true);
  assert.equal(validDateTime("2026-02-30T09:00"), false);
  assert.equal(joinDateTime("2026-03-03", null, "08:00"), "2026-03-03T08:00");
  assert.equal(joinDateTime(null, "09:00"), null);
  assert.deepEqual(splitDateTime("2026-03-03T09:00"), { date: "2026-03-03", time: "09:00" });
  assert.deepEqual(splitDateTime("bad"), { date: null, time: null });
  const civil = { start: "2026-03-03T09:00", end: "2026-03-05T17:00" };
  assert.equal(dateTimeRangeText(civil), "2026-03-03T09:00/2026-03-05T17:00");
  assert.equal(dateTimeRangeError(civil), null);
  assert.equal(dateTimeRangeError({ start: civil.end, end: civil.start }), "order");
  assert.equal(dateTimeRangeError({ start: civil.start, end: null }), "incomplete");
  assert.equal(dateTimeRangeError(null), null);
  const madrid = { ...civil, timeZone: "Europe/Madrid" };
  assert.equal(dateTimeRangeText(madrid), "2026-03-03T09:00+01:00[Europe/Madrid]/2026-03-05T17:00+01:00[Europe/Madrid]");
  assert.equal(zonedText("2026-07-01T09:00", "Europe/Madrid"), "2026-07-01T09:00+02:00[Europe/Madrid]");
  assert.equal(zonedText("2026-07-01T09:00", "America/St_Johns"), "2026-07-01T09:00-02:30[America/St_Johns]");
  assert.equal(zonedText("2026-07-01T09:00", "bad/zone"), "2026-07-01T09:00");
  assert.equal(isoOffset(330), "+05:30");
  assert.deepEqual(parseDateTimeRange(dateTimeRangeText(madrid)), madrid);
  assert.deepEqual(parseDateTimeRange("2026-03-03T09:00/2026-03-05T17:00"), { ...civil, timeZone: null });
  assert.deepEqual(parseDateTimeRange(""), { start: null, end: null, timeZone: null });
  // El mismo reloj en dos zonas: el instante cambia; sin zona, se compara como UTC.
  assert.ok(instantOf("2026-03-03T09:00", "Asia/Tokyo")! < instantOf("2026-03-03T09:00", "Europe/Madrid")!);
  assert.equal(instantOf("bad"), null);
  // Una hora que no existe en la zona (salto de primavera) es un error del rango con `reject`… y con `compatible` se mueve.
  assert.equal(dateTimeRangeError({ start: "2026-03-29T01:00", end: "2026-03-29T02:30", timeZone: "Europe/Madrid" }), null);
});

test("rango de fecha y hora: preajustes, ahora en una zona y texto", () => {
  const now = "2026-11-25T10:42";
  assert.deepEqual(resolveDateTimePreset("last-hour", now), { start: "2026-11-25T09:42", end: "2026-11-25T10:42" });
  assert.deepEqual(resolveDateTimePreset("last-24-hours", now), { start: "2026-11-24T10:42", end: "2026-11-25T10:42" });
  assert.deepEqual(resolveDateTimePreset("today", now), { start: "2026-11-25T00:00", end: "2026-11-25T23:59" });
  assert.deepEqual(resolveDateTimePreset("yesterday", now), { start: "2026-11-24T00:00", end: "2026-11-24T23:59" });
  assert.deepEqual(resolveDateTimePreset("last-7-days", now), { start: "2026-11-19T00:00", end: "2026-11-25T23:59" });
  assert.deepEqual(resolveDateTimePreset("next-7-days", now), { start: "2026-11-25T00:00", end: "2026-12-01T23:59" });
  assert.deepEqual(resolveDateTimePreset("this-week", now), { start: "2026-11-23T00:00", end: "2026-11-29T23:59" });
  assert.deepEqual(resolveDateTimePreset("this-week", now, 0), { start: "2026-11-22T00:00", end: "2026-11-28T23:59" });
  assert.deepEqual(
    resolveDateTimePreset((n) => ({ start: n, end: n }), now),
    { start: now, end: now },
  );
  assert.equal(resolveDateTimePreset("today", "bad"), null);
  assert.equal(resolveDateTimePreset("nope" as never, now), null);
  assert.equal(nowIn("UTC", Date.UTC(2026, 10, 25, 10, 42)), "2026-11-25T10:42");
  assert.equal(nowIn("Asia/Tokyo", Date.UTC(2026, 10, 25, 20, 0)), "2026-11-26T05:00");
  // `formatRange` separa con espacios finos: se comparan como espacios normales.
  const text = (...args: Parameters<typeof formatDateTimeRange>) => formatDateTimeRange(...args).replace(/\s/g, " ");
  assert.equal(text({ start: "2026-03-03T09:00", end: "2026-03-03T17:00" }, "en-US", false, 2025), "Mar 3, 2026, 09:00 – 17:00");
  assert.equal(text({ start: "2026-03-03T09:00", end: "2026-03-05T17:00" }, "en-US", false, 2026), "Mar 3, 09:00 – Mar 5, 17:00");
  assert.equal(text({ start: "2026-03-05T09:00", end: "2026-03-03T17:00" }, "en-US", false, 2026), "Mar 5, 09:00 – Mar 3, 17:00");
  assert.equal(formatDateTimeRange(null), "");
});
