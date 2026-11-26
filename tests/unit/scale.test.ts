// Escala (0.5): núcleo de virtualización (ventana, filas fijadas, medidas, desplazar a un índice, posición para
// lectores), carga asíncrona de opciones, modelo de la rejilla de DataTable (grupos, árbol, detalle, columnas fijadas,
// orden, validación, fechas con locale, teclado), arrastre del árbol y menú «Más» de las pestañas.
import { mount, press, setBox, setRect } from "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  createSizeCache,
  listWindow,
  offsets,
  positionAttrs,
  renderIndices,
  sameWindow,
  scrollForIndex,
  virtualWindow,
  virtualizeAttr,
  wantsVirtual,
} from "../../zui/src/core/virtual.ts";
import { createVirtualizer, measureRows, trackViewport } from "../../zui/src/core/virtual-runtime.ts";
import {
  followVirtual,
  measureInto,
  scrollToRow,
  spacerNode,
  unfollowVirtual,
  widgetList,
  windowChanges,
} from "../../zui/src/core/virtual-widget.ts";
import { createAsyncOptions, type AsyncState } from "../../zui/src/core/async-options.ts";
import {
  aggregate,
  flattenGrid,
  formatDateCell,
  formatNumberCell,
  gridMove,
  keyRange,
  moveColumn,
  orderColumns,
  pinLayout,
  pinOrder,
  validateCell,
} from "../../zui/src/core/datagrid-model.ts";
import { bindGrid } from "../../zui/src/core/datagrid-grid.ts";
import { bindColumnReorder } from "../../zui/src/core/datagrid-reorder.ts";
import { dropPositionAt, dropSlots, isWithin, moveNode, validDrop, type TreeShape } from "../../zui/src/core/tree.ts";
import { overflowedTabs, revealSelected, scrollTabIntoView } from "../../zui/src/core/tab-overflow.ts";

const frame = () => new Promise((r) => setTimeout(r, 20));

describe("virtual: núcleo", () => {
  test("umbral: false nunca, true siempre, número propio o el de la pieza", () => {
    assert.equal(wantsVirtual(false, 1e6, 10), false);
    assert.equal(wantsVirtual(true, 1, 10), true);
    assert.equal(wantsVirtual(true, 0, 10), false);
    assert.equal(wantsVirtual(undefined, 11, 10), true);
    assert.equal(wantsVirtual(undefined, 10, 10), false);
    assert.equal(wantsVirtual(50, 51, 10), true);
    assert.equal(wantsVirtual(50, 50, 10), false);
    assert.equal(virtualizeAttr(undefined), undefined);
    assert.equal(virtualizeAttr(""), true);
    assert.equal(virtualizeAttr("true"), true);
    assert.equal(virtualizeAttr("false"), false);
    assert.equal(virtualizeAttr("30"), 30);
    assert.equal(virtualizeAttr("x"), undefined);
  });

  test("filas fijadas: la del foco se pinta aunque esté fuera, en orden y sin repetir", () => {
    assert.deepEqual(renderIndices({ start: 10, end: 13 }, [2, 11, 50, 2]), [2, 10, 11, 12, 50]);
    assert.deepEqual(renderIndices({ start: 0, end: 2 }, [-1, 1.5]), [0, 1]);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 40 }),
        fc.array(fc.integer({ min: 0, max: 600 })),
        (start, len, keep) => {
          const out = renderIndices({ start, end: start + len }, keep);
          for (let i = 1; i < out.length; i++) assert.ok(out[i]! > out[i - 1]!);
          for (const k of keep) assert.ok(out.includes(k));
        },
      ),
    );
  });

  test("desplazar a un índice: nearest no mueve si ya se ve; start, center y end; acotado", () => {
    assert.equal(scrollForIndex(5, 20, 100, 0, 200), 0);
    assert.equal(scrollForIndex(15, 20, 100, 0, 200), 120);
    assert.equal(scrollForIndex(2, 20, 100, 300, 200), 40);
    assert.equal(scrollForIndex(50, 20, 100, 0, 200, "start"), 1000);
    assert.equal(scrollForIndex(50, 20, 100, 0, 200, "center"), 910);
    assert.equal(scrollForIndex(50, 20, 100, 0, 200, "end"), 820);
    assert.equal(scrollForIndex(99, 20, 100, 0, 200, "start"), 1800);
    assert.equal(scrollForIndex(0, 20, 0, 0, 200), 0);
    const size = (i: number) => (i % 2 ? 30 : 10);
    assert.equal(scrollForIndex(3, size, 10, 0, 40, "start"), 50);
    assert.equal(scrollForIndex(3, size, 10, 0, 40, "start", offsets(10, size)), 50);
  });

  test("posiciones precalculadas: la misma ventana sin recorrer las filas", () => {
    const size = (i: number) => 10 + (i % 7);
    const pos = offsets(1000, size);
    assert.deepEqual(
      virtualWindow({ count: 1000, size, scroll: 3333, viewport: 400, overscan: 2, positions: pos }),
      virtualWindow({ count: 1000, size, scroll: 3333, viewport: 400, overscan: 2 }),
    );
  });

  test("altos medidos por clave, con la estimación para lo no medido", () => {
    const cache = createSizeCache((i) => (i === 0 ? 50 : 30));
    assert.equal(cache.size(0, "a"), 50);
    assert.equal(cache.set("a", 44), true);
    assert.equal(cache.set("a", 44), false);
    assert.equal(cache.set("b", 0), false);
    assert.equal(cache.size(0, "a"), 44);
    assert.equal(cache.has("a"), true);
    assert.equal(cache.count, 1);
    cache.clear();
    assert.equal(cache.count, 0);
    assert.equal(createSizeCache(20).size(3, "x"), 20);
  });

  test("posición para lectores y ventana de lista", () => {
    assert.deepEqual(positionAttrs("row", 4, 100, 2), { "aria-rowindex": "7" });
    assert.deepEqual(positionAttrs("set", 4, 100), { "aria-posinset": "5", "aria-setsize": "100" });
    const all = listWindow({ virtual: false, count: 3, size: 10, scroll: 0, viewport: 10 });
    assert.deepEqual(all.indices, [0, 1, 2]);
    const win = listWindow({ virtual: true, count: 1000, size: 10, scroll: 5000, viewport: 100, overscan: 0, keep: [0] });
    assert.deepEqual(win.indices.slice(0, 2), [0, 500]);
    assert.ok(sameWindow(win, { ...win }));
    assert.ok(!sameWindow(win, null));
  });
});

describe("virtual: conectado al documento", () => {
  test("trackViewport: desplazamiento menos lo de delante, una vez por cambio", async () => {
    const el = mount('<div style="overflow:auto"></div>') as HTMLElement;
    setBox(el, { clientHeight: 300 });
    const seen: number[] = [];
    const stop = trackViewport(
      el,
      (s) => seen.push(s.scroll),
      () => 40,
    );
    el.scrollTop = 500;
    el.dispatchEvent(new Event("scroll"));
    await new Promise((r) => setTimeout(r, 60));
    stop();
    assert.deepEqual(seen, [0, 460]);
  });

  test("createVirtualizer: ventana, filas fijadas, medida y desplazar a un índice", async () => {
    const el = mount('<div><div class="rows"></div></div>') as HTMLElement;
    setBox(el, { clientHeight: 100 });
    const changes: number[] = [];
    let keep = [0];
    const v = createVirtualizer(el, {
      count: 1000,
      size: 10,
      key: (i) => `k${i}`,
      overscan: 1,
      keep: () => keep,
      onChange: (w) => changes.push(w.start),
    });
    assert.equal(v.window().start, 0);
    assert.ok(v.window().indices.length <= 13);
    v.scrollToIndex(500, "start");
    assert.equal(el.scrollTop, 5000);
    assert.ok(v.window().indices.includes(0), "la fijada sigue");
    assert.ok(v.window().indices.includes(500));
    // Medida: filas pintadas con su clave.
    const rows = el.querySelector(".rows")!;
    rows.innerHTML = '<div data-key="k500"></div><div data-key="k501"></div>';
    for (const row of rows.children) setBox(row as HTMLElement, { offsetHeight: 40 });
    v.measure(rows, "[data-key]");
    assert.equal(v.sizeOf(500), 40);
    assert.equal(v.positions()?.length, 1001);
    keep = [];
    v.update({ count: 10 }, true);
    assert.equal(v.window().end <= 10, true);
    v.destroy();
    assert.ok(changes.length >= 2);
    const fixed = createVirtualizer(el, { count: 5, size: 10, onChange: () => {} });
    assert.equal(fixed.positions(), undefined);
    fixed.destroy();
  });

  test("measureRows: solo cuenta lo que cambia", () => {
    const box = mount('<div><p data-k="a"></p><p data-k="b"></p></div>') as HTMLElement;
    for (const p of box.children) setBox(p as HTMLElement, { offsetHeight: 12 });
    const cache = createSizeCache(10);
    assert.equal(measureRows(box, "p", cache, "data-k"), true);
    assert.equal(measureRows(box, "p", cache, "data-k"), false);
  });

  test("piezas: ventana del estado, relleno, medida con el hueco y seguimiento del contenedor", async () => {
    const input = {
      virtual: true,
      count: 1000,
      keyOf: (i: number) => `r${i}`,
      estimate: 20,
      view: { scroll: 0, viewport: 200 },
      keep: [900],
    };
    const win = widgetList(input);
    assert.ok(win.indices.includes(900));
    assert.ok(windowChanges(input, { scroll: 4000, viewport: 200 }));
    assert.ok(!windowChanges(input, { scroll: 0, viewport: 200 }));
    assert.equal(spacerNode("li", "x", 0), null);
    assert.equal(spacerNode("li", "x", 12.4)?.s?.["--z-virtual-space"], "12px");
    const list = mount('<ul style="row-gap: 4px"><li data-key="a"></li><li></li></ul>') as HTMLElement;
    setBox(list.children[0] as HTMLElement, { offsetHeight: 30 });
    const heights = new Map<string, number>();
    assert.equal(measureInto(list, "li", heights), true);
    assert.equal(heights.get("a"), 34);
    assert.equal(measureInto(list, "li", heights), false);
    setBox(list, { clientHeight: 100 });
    scrollToRow(list, { ...input, heights }, 500);
    assert.ok(list.scrollTop > 0);
    scrollToRow(null, input, 3);
    const root = mount('<div><div class="s"></div></div>') as HTMLElement;
    const views: number[] = [];
    followVirtual(root, "s", ".s", (v) => views.push(v.viewport));
    followVirtual(root, "s", ".s", () => views.push(-1));
    followVirtual(root, "s", null, () => {});
    followVirtual(root, "t", ".s", () => {});
    unfollowVirtual(root);
    assert.deepEqual(views, [0]);
  });
});

describe("carga asíncrona de opciones", () => {
  const manual = () => {
    const queue: Array<{ fn: () => void; ms: number }> = [];
    return {
      timers: {
        set: (fn: () => void, ms: number) => {
          const entry = { fn, ms };
          queue.push(entry);
          return entry;
        },
        clear: (id: unknown) => {
          const i = queue.indexOf(id as { fn: () => void; ms: number });
          if (i >= 0) queue.splice(i, 1);
        },
      },
      flush: () => {
        for (const e of queue.splice(0)) e.fn();
      },
      pending: () => queue.length,
    };
  };

  test("antirrebote, cancelación de la anterior, páginas, vacío por longitud mínima y error con reintento", async () => {
    const t = manual();
    const calls: string[] = [];
    const aborted: string[] = [];
    let fail = true;
    const states: AsyncState<string>[] = [];
    const engine = createAsyncOptions<string>({
      debounce: 100,
      minLength: 1,
      timers: t.timers,
      onChange: (s) => states.push(s),
      load: (query, { signal, page }) => {
        calls.push(`${query}#${page}`);
        signal.addEventListener("abort", () => aborted.push(query));
        if (query === "boom" && fail) {
          fail = false;
          return Promise.reject(new Error("down"));
        }
        if (query === "arr") return Promise.resolve([`${query}-x`]);
        return Promise.resolve({ options: [`${query}-${page}`], hasMore: page < 2 });
      },
    });
    engine.search("r");
    engine.search("ro");
    engine.search("rom");
    assert.equal(t.pending(), 1, "una espera viva");
    t.flush();
    await frame();
    assert.deepEqual(calls, ["rom#1"]);
    assert.deepEqual(engine.state().options, ["rom-1"]);
    assert.equal(engine.state().hasMore, true);
    engine.more();
    await frame();
    assert.deepEqual(engine.state().options, ["rom-1", "rom-2"]);
    engine.more();
    await frame();
    assert.equal(calls.length, 2, "sin más páginas, no pide");
    engine.search("", true);
    assert.equal(engine.state().status, "idle");
    // Una búsqueda que llega tarde no pisa a la nueva.
    engine.search("slow", true);
    engine.search("fast", true);
    await frame();
    assert.deepEqual(engine.state().options, ["fast-1"]);
    assert.ok(aborted.includes("slow"));
    engine.search("arr", true);
    await frame();
    assert.deepEqual(engine.state().options, ["arr-x"]);
    assert.equal(engine.state().hasMore, false);
    engine.search("boom", true);
    await frame();
    assert.equal(engine.state().status, "error");
    engine.retry();
    await frame();
    assert.equal(engine.state().status, "ready");
    engine.search("zz");
    engine.abort();
    assert.equal(t.pending(), 0);
    assert.notEqual(engine.state().status, "loading");
    assert.ok(states.length > 5);
  });

  test("un cargador que lanza en el acto es un error, y el de la página siguiente se reintenta", async () => {
    let page2 = 0;
    const engine = createAsyncOptions<number>({
      debounce: 0,
      onChange: () => {},
      load: (_q, { page }) => {
        if (page === 2 && page2++ === 0) throw new Error("now");
        if (page === 9) return Promise.reject({ name: "AbortError" });
        return Promise.resolve({ options: [page], hasMore: true });
      },
    });
    engine.search("x");
    await frame();
    engine.more();
    await frame();
    assert.equal(engine.state().status, "error");
    engine.retry();
    await frame();
    assert.deepEqual(engine.state().options, [1, 2]);
  });
});

describe("rejilla: modelo", () => {
  type R = { id: string; team: string; n: number; kids?: R[] };
  const rows: R[] = [
    { id: "a", team: "x", n: 1 },
    { id: "b", team: "y", n: 2, kids: [{ id: "b1", team: "y", n: 5 }] },
    { id: "c", team: "x", n: 3 },
  ];

  test("agregados: suma, media, mínimo, máximo y recuento; sin números, null", () => {
    assert.equal(aggregate([1, "2", null, "x"], "sum"), 3);
    assert.equal(aggregate([1, 2], "avg"), 1.5);
    assert.equal(aggregate([3, 1], "min"), 1);
    assert.equal(aggregate([new Date(5), new Date(9)], "max"), 9);
    assert.equal(aggregate([null, "a"], "count"), 2);
    assert.equal(aggregate(["a", ""], "sum"), null);
  });

  test("filas planas: grupos con sus filas (plegados fuera), árbol abierto y detalle tras su fila", () => {
    const flat = flattenGrid({ rows, keyOf: (r) => r.id, groupBy: ["team"], valueAt: (r, k) => (r as never)[k] });
    assert.deepEqual(
      flat.map((r) => (r.kind === "group" ? `g:${String(r.value)}:${r.rows.length}` : r.kind === "row" ? `${r.key}@${r.depth}` : r.key)),
      ["g:x:2", "a@1", "c@1", "g:y:1", "b@1"],
    );
    const folded = flattenGrid({
      rows,
      keyOf: (r) => r.id,
      groupBy: ["team"],
      valueAt: (r, k) => (r as never)[k],
      collapsedGroups: new Set([flat[0]!.key as string]),
    });
    assert.equal(folded.length, 3);
    const tree = flattenGrid({
      rows,
      keyOf: (r) => r.id,
      childrenOf: (r) => r.kids,
      expandedRows: new Set(["b"]),
      openDetails: new Set(["a"]),
    });
    assert.deepEqual(
      tree.map((r) => (r.kind === "row" ? `${r.key}:${r.depth}:${r.pos}/${r.size}:${r.parent ?? "-"}` : r.key)),
      ["a:0:1/3:-", "a:detail", "b:0:2/3:-", "b1:1:1/1:b", "c:0:3/3:-"],
    );
    const closed = flattenGrid({ rows, keyOf: (r) => r.id, childrenOf: (r) => r.kids });
    assert.equal(closed.length, 3);
    assert.equal(flattenGrid({ rows: [{ id: "d", team: "", n: 0 }], keyOf: (r) => r.id, groupBy: ["team"] })[0]!.kind, "group");
  });

  test("orden de columnas: guardado, sin las que ya no existen y con las nuevas al final; mover y fijadas a los lados", () => {
    assert.deepEqual(orderColumns(["a", "b", "c"], ["c", "x", "a"]), ["c", "a", "b"]);
    assert.deepEqual(orderColumns(["a"], null), ["a"]);
    assert.deepEqual(moveColumn(["a", "b", "c"], "a", 2), ["b", "c", "a"]);
    assert.deepEqual(moveColumn(["a", "b"], "z", 0), ["a", "b"]);
    assert.deepEqual(moveColumn(["a", "b", "c"], "c", -4), ["c", "a", "b"]);
    const cols = [{ key: "a" }, { key: "b", pinned: "end" as const }, { key: "c", pinned: "start" as const }, { key: "d" }];
    assert.deepEqual(
      pinOrder(cols).map((c) => c.key),
      ["c", "a", "d", "b"],
    );
    const { offset, edge } = pinLayout([50, 60, 70, 80], ["start", "start", undefined, "end"]);
    assert.deepEqual(offset, [0, 50, 0, 0]);
    assert.deepEqual(edge, [false, true, false, true]);
    assert.deepEqual(pinLayout([10, 20, 30], ["end", "end", "end"]).offset, [50, 30, 0]);
  });

  test("validación: obligatorio, número, mínimo y máximo, fechas, opciones y patrón", () => {
    assert.equal(validateCell("", { required: true }), "Required");
    assert.equal(validateCell("  ", {}), null);
    assert.equal(validateCell("x", { type: "number" }), "Enter a number");
    assert.equal(validateCell("1,5", { type: "number", min: 2 }), "Must be at least 2");
    assert.equal(validateCell("9", { type: "number", max: 5 }), "Must be at most 5");
    assert.equal(validateCell("2026-01-01", { type: "date", min: "2026-02-01" }), "Must be at least 2026-02-01");
    assert.equal(validateCell("2026-03-01", { type: "date", max: "2026-02-01" }), "Must be at most 2026-02-01");
    assert.equal(validateCell("b", { options: ["a"] }), "Choose one of the options");
    assert.equal(validateCell("ab1", { pattern: "[a-z]+" }), "Invalid format");
    assert.equal(validateCell("ab", { pattern: "[a-z]+" }), null);
    assert.equal(validateCell("ab", { pattern: "(" }), null, "un patrón que no compila no bloquea");
  });

  test("fechas y números con el idioma de la tabla, no con el del entorno", () => {
    const d = new Date("2025-03-02T12:00:00Z");
    assert.equal(formatDateCell(d, "es-ES", { day: "numeric", month: "long", timeZone: "UTC" }), "2 de marzo");
    assert.equal(formatDateCell(d, "en-US", { day: "numeric", month: "long", timeZone: "UTC" }), "March 2");
    assert.equal(formatDateCell(new Date("x"), "en-US"), "");
    assert.equal(formatDateCell(d, "zz-invalid-???", { year: "numeric", timeZone: "UTC" }), "2025");
    assert.equal(formatNumberCell(1234.5, "de-DE"), "1.234,5");
    assert.equal(formatNumberCell(2, "??"), "2");
  });

  test("teclado de la rejilla y rangos", () => {
    const at = { row: 5, col: 2 };
    assert.deepEqual(gridMove(at, "ArrowDown", 10, 4), { row: 6, col: 2 });
    assert.deepEqual(gridMove(at, "ArrowLeft", 10, 4), { row: 5, col: 1 });
    assert.deepEqual(gridMove(at, "Home", 10, 4), { row: 5, col: 0 });
    assert.deepEqual(gridMove(at, "End", 10, 4, { ctrl: true }), { row: 9, col: 3 });
    assert.deepEqual(gridMove(at, "PageUp", 10, 4, { page: 3 }), { row: 2, col: 2 });
    assert.equal(gridMove({ row: 0, col: 0 }, "ArrowUp", 10, 4), null);
    assert.equal(gridMove(at, "x", 10, 4), null);
    assert.equal(gridMove(at, "ArrowDown", 0, 4), null);
    assert.deepEqual(keyRange(["a", "b", "c", "d"], "c", "a"), ["a", "b", "c"]);
    assert.deepEqual(keyRange(["a"], "a", "z"), []);
  });

  test("bindGrid: una parada de Tab, flechas, F2 y letra para editar, →/← para abrir, Mayús para rangos", () => {
    const table = mount(
      `<table><tbody>${["a", "b", "c"].map((k) => `<tr data-row-key="${k}"><td>${k}1</td><td>${k}2${k === "b" ? "<button>x</button>" : ""}</td></tr>`).join("")}</tbody></table>`,
    ) as HTMLTableElement;
    const log: string[] = [];
    let open = false;
    const g = bindGrid(table, {
      rowKeys: () => ["a", "b", "c", "far"],
      reveal: (k) => log.push(`reveal:${k}`),
      editable: (_r, c) => c === 0,
      onEdit: (r, c, seed) => log.push(`edit:${r}:${c}:${seed ?? ""}`),
      onToggle: (r, o) => {
        if (r !== "a") return false;
        open = o;
        return true;
      },
      onSelect: (r, range) => log.push(`select:${r}:${range}`),
      onExtend: (a, b) => log.push(`extend:${a}>${b}`),
      onActivate: (r, c) => log.push(`activate:${r}:${c}`),
    });
    g.sync();
    assert.equal(table.querySelectorAll('[tabindex="0"]').length, 1);
    g.setActive({ row: "b", col: 0 }, true);
    press(document.activeElement!, "ArrowRight");
    assert.equal(document.activeElement?.tagName, "BUTTON", "una celda con un solo control enfoca el control");
    press(document.activeElement!, "ArrowUp");
    // Intro en una celda sin control ni edición: activa la fila.
    press(document.activeElement!, "Enter");
    press(document.activeElement!, "ArrowDown");
    assert.equal(g.active()?.row, "b");
    press(document.activeElement!, "Home");
    press(document.activeElement!, "F2");
    press(document.activeElement!, "q");
    press(document.activeElement!, "ArrowRight");
    press(document.activeElement!, "Enter");
    g.setActive({ row: "a", col: 0 }, true);
    press(document.activeElement!, "ArrowRight");
    assert.equal(open, true);
    press(document.activeElement!, "ArrowUp");
    press(document.activeElement!, " ", { shiftKey: true });
    press(document.activeElement!, "ArrowDown", { shiftKey: true });
    press(document.activeElement!, "End", { ctrlKey: true });
    g.sync();
    assert.ok(log.includes("edit:b:0:"));
    assert.ok(log.includes("edit:b:0:q"));
    assert.ok(log.includes("activate:a:1"), `activa: ${log}`);
    assert.ok(log.includes("select:a:true"));
    assert.ok(log.includes("extend:a>b"));
    assert.ok(log.includes("reveal:far"), `fuera de la ventana: ${log}`);
    g.destroy();
  });

  test("bindColumnReorder: Espacio coge, flechas mueven (anunciado), Escape devuelve; el puntero suelta en la cabecera", () => {
    const table = mount(
      `<table><thead><tr>${["a", "b", "c"].map((k) => `<th><button class="z-table__grip" data-col-key="${k}"></button>${k}</th>`).join("")}</tr></thead></table>`,
    ) as HTMLTableElement;
    let order = ["a", "b", "c"];
    const said: string[] = [];
    const stop = bindColumnReorder(table, {
      order: () => order,
      onMove: (key, to) => {
        order = moveColumn(order, key, to);
      },
      nameOf: (k) => k.toUpperCase(),
      announce: (t) => said.push(t),
    });
    const grip = table.querySelector<HTMLElement>('[data-col-key="a"]')!;
    grip.focus();
    press(grip, " ");
    assert.equal(grip.getAttribute("aria-pressed"), "true");
    press(grip, "ArrowRight");
    assert.deepEqual(order, ["b", "a", "c"]);
    press(grip, "ArrowRight");
    press(grip, "Escape");
    assert.deepEqual(order, ["a", "b", "c"]);
    press(grip, "Enter");
    press(grip, "ArrowRight");
    press(grip, "Enter");
    assert.deepEqual(order, ["b", "a", "c"]);
    assert.ok(said.some((t) => t.startsWith("A grabbed, position 1 of 3")));
    assert.ok(said.some((t) => t.includes("back at position 1")));
    assert.ok(said.some((t) => t.startsWith("A dropped at position 2")));
    // Puntero: arrastrar «c» a la primera cabecera.
    const ths = [...table.tHead!.rows[0]!.cells];
    ths.forEach((th, i) => {
      setRect(th, { left: i * 100, top: 0, width: 100, height: 30 });
    });
    const c = table.querySelector<HTMLElement>('[data-col-key="c"]')!;
    c.setPointerCapture = () => {};
    c.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 250, pointerId: 1 }));
    c.dispatchEvent(new window.PointerEvent("pointermove", { bubbles: true, clientX: 20, pointerId: 1 }));
    assert.equal(ths[0]!.getAttribute("data-drop"), "before");
    c.dispatchEvent(new window.PointerEvent("pointerup", { bubbles: true, clientX: 20, pointerId: 1 }));
    // El orden del marcado no cambió (lo cambia quien pinta): «c» cae delante de la primera cabecera, la de «a».
    assert.deepEqual(order, ["b", "c", "a"]);
    c.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, pointerId: 2 }));
    c.dispatchEvent(new window.PointerEvent("pointercancel", { bubbles: true, pointerId: 2 }));
    stop();
  });
});

describe("árbol: mover nodos", () => {
  const nodes: (TreeShape & { label?: string })[] = [
    { id: "a", children: [{ id: "a1" }, { id: "a2", children: [{ id: "a2x" }] }] },
    { id: "b" },
    { id: "c", disabled: true },
  ];

  test("validez y movimiento inmutable: delante, dentro (último) y detrás; nunca dentro de sí mismo", () => {
    assert.ok(isWithin(nodes, "a", "a2x"));
    assert.ok(!isWithin(nodes, "b", "a"));
    assert.ok(!isWithin(nodes, "zz", "a"));
    assert.ok(!validDrop(nodes, { id: "a", target: "a2x", position: "inside" }));
    assert.ok(!validDrop(nodes, { id: "a", target: "a", position: "before" }));
    assert.ok(!validDrop(nodes, { id: "x", target: "a", position: "before" }));
    const before = moveNode(nodes, { id: "b", target: "a1", position: "before" });
    assert.deepEqual(
      before[0]!.children!.map((n) => n.id),
      ["b", "a1", "a2"],
    );
    assert.equal(nodes[1]!.id, "b", "no cambia el original");
    const inside = moveNode(nodes, { id: "a1", target: "b", position: "inside" });
    assert.deepEqual(
      inside.map((n) => [n.id, n.children?.map((k) => k.id)]),
      [
        ["a", ["a2"]],
        ["b", ["a1"]],
        ["c", undefined],
      ],
    );
    const after = moveNode(nodes, { id: "a2x", target: "c", position: "after" });
    assert.deepEqual(
      after.map((n) => n.id),
      ["a", "b", "c", "a2x"],
    );
    assert.equal(moveNode(nodes, { id: "a", target: "a1", position: "inside" }).length, 3);
  });

  test("destinos del teclado y posición por la altura del puntero", () => {
    const rows = [
      { id: "a", level: 1, last: false },
      { id: "a1", level: 2, last: true },
      { id: "b", level: 1, last: false },
      { id: "c", level: 1, last: true, disabled: true },
    ];
    const slots = dropSlots(rows, nodes, "a1");
    assert.deepEqual(
      slots.map((s) => `${s.position}:${s.target}`),
      ["before:a", "inside:a", "before:b", "inside:b"],
    );
    assert.equal(dropPositionAt(2, 30), "before");
    assert.equal(dropPositionAt(15, 30), "inside");
    assert.equal(dropPositionAt(28, 30), "after");
    assert.equal(dropPositionAt(10, 30, false), "before");
    assert.equal(dropPositionAt(20, 0, false), "after");
  });
});

describe("pestañas: menú «Más»", () => {
  test("la elegida vuelve a la tira ocultando las anteriores; lista lo que no se ve", () => {
    const list = mount(
      `<div class="z-tabs__list">${[0, 1, 2, 3].map((i) => `<button class="z-tabs__tab" data-value="t${i}" aria-selected="${i === 3}"></button>`).join("")}</div>`,
    ) as HTMLElement;
    setRect(list, { left: 0, width: 200, height: 30 });
    const tabs = [...list.children] as HTMLElement[];
    // La elegida (t3) no cabe hasta que se ocultan dos de delante.
    tabs.forEach((tab, i) => {
      tab.getBoundingClientRect = () => {
        const hidden = tabs.slice(0, i).filter((t) => t.hasAttribute("data-displaced")).length;
        const left = (i - hidden) * 80;
        return new window.DOMRect(left, 0, 80, 30);
      };
    });
    tabs[1]!.setAttribute("data-clipped", "");
    revealSelected(list);
    assert.deepEqual(
      tabs.map((t) => t.hasAttribute("data-displaced")),
      [false, true, true, false],
    );
    assert.deepEqual(overflowedTabs(list), ["t1", "t2"]);
    scrollTabIntoView(tabs[3]);
    scrollTabIntoView(null);
  });
});
