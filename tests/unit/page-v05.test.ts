// Piezas de página y de dominio de la 0.5: índice (core/toc), barra de carga (core/top-progress), fila con «+N»
// (core/overflow-list), lista o rejilla (core/data-view), búsqueda en la conversación (core/chat-search), traza de
// error (core/stack-trace), vista previa (core/web-preview), grabación (core/voice-input), reproductor
// (core/audio-player), Affix, BackToTop y SearchView. Propiedades con fast-check; los árboles y la interacción, con
// happy-dom.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { activeHeading, fragmentId, readingLine, scrollBehaviorFor, tocRows } from "../../zui/src/core/toc.ts";
import { tableOfContentsWidget } from "../../zui/src/core/toc-widget.ts";
import { advance, createProgress, progressView, topProgressWidget, trickleStep } from "../../zui/src/core/top-progress.ts";
import { fitCount, paintOverflow, visibleIndexes } from "../../zui/src/core/overflow-list.ts";
import { attachDataView, isLayout, readLayout, windowStore, writeLayout } from "../../zui/src/core/data-view.ts";
import { countText, findMatches, nearestMatch, stepMatch } from "../../zui/src/core/chat-search.ts";
import { frameLocation, groupFrames, parseFrame, parseStack, shortFile, stackText } from "../../zui/src/core/stack-trace.ts";
import { stackTraceWidget } from "../../zui/src/core/stack-trace-widget.ts";
import { canTravel, displayUrl, normalizeUrl, sandboxValue, travel, visit } from "../../zui/src/core/web-preview.ts";
import { webPreviewWidget } from "../../zui/src/core/web-preview-widget.ts";
import {
  levelBars,
  levelOf,
  pauseClock,
  pickMimeType,
  problemOf,
  pushLevel,
  recordedMs,
  recorderSupport,
  resumeClock,
} from "../../zui/src/core/voice-input.ts";
import { voiceInputWidget } from "../../zui/src/core/voice-input-widget.ts";
import { decodePeaks, playerKey, rateText, skipBy, skipLabel } from "../../zui/src/core/audio-player.ts";
import { audioPlayerWidget, waveformWidget, waveNode } from "../../zui/src/core/audio-player-widget.ts";
import { chatSearchWidget } from "../../zui/src/core/chat-search-widget.ts";
import { backToTopVisible, backToTopWidget } from "../../zui/src/core/back-to-top.ts";
import { isStuck } from "../../zui/src/core/affix.ts";
import { growFrom } from "../../zui/src/core/search-view.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";
import type { Widget, WidgetHost } from "../../zui/src/core/widget.ts";

/** Monta una pieza en happy-dom con un anfitrión mínimo (el de React y el del modo DOM hacen lo mismo). */
function mountWidget<P, C, S>(widget: Widget<P, C, S>, props: P) {
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  const config = widget.configure(props);
  let state = widget.initial(config);
  const events: Array<[string, unknown]> = [];
  const paint = () => {
    if (widget.control) state = widget.control(config, state);
    root.innerHTML = toHTML(widget.tree(config, state, "w"));
  };
  const host: WidgetHost<C, S> = {
    config: () => config,
    state: () => state,
    update(patch) {
      state = { ...state, ...patch };
      paint();
    },
    emit: (name, detail) => events.push([name, detail]),
  };
  paint();
  const detach = widget.attach(root, host);
  return { root, host, events, detach, state: () => state };
}
const html = <P, C, S>(widget: Widget<P, C, S>, props: P, patch: Partial<S> = {}) => {
  const config = widget.configure(props);
  return toHTML(widget.tree(config, { ...widget.initial(config), ...patch }, "w"));
};
const click = (el: Element | null) => el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const key = (el: Element, k: string, extra: Record<string, unknown> = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));

describe("TableOfContents (core/toc)", () => {
  test("filas: sangría relativa al nivel más alto, sin ids vacíos ni repetidos", () => {
    const rows = tocRows([
      { id: "a", label: "A", level: 2 },
      { id: "b", label: "B", level: 3 },
      { id: "a", label: "Dup", level: 2 },
      { id: "", label: "Empty" },
      { id: "c", label: "C", level: 6 },
      { id: "d", label: "D" },
    ]);
    assert.deepEqual(
      rows.map((r) => [r.id, r.depth]),
      [
        ["a", 0],
        ["b", 1],
        ["c", 3],
        ["d", 0],
      ],
    );
    assert.deepEqual(tocRows([]), []);
  });
  test("propiedad: la sangría está siempre en [0, 3] y el nivel más alto no lleva", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ id: fc.uuid(), label: fc.string(), level: fc.integer({ min: -2, max: 9 }) }), { minLength: 1, maxLength: 20 }), (items) => {
        const rows = tocRows(items);
        assert.ok(rows.every((r) => r.depth >= 0 && r.depth <= 3));
        assert.ok(rows.some((r) => r.depth === 0));
      }),
    );
  });
  test("sección activa: la última que cruzó la línea, la primera si ninguna, la última al final", () => {
    assert.equal(activeHeading([10, 300, 900], 100), 0);
    assert.equal(activeHeading([-400, -20, 90, 600], 100), 2);
    assert.equal(activeHeading([200, 600], 100), 0, "ninguna cruzó: la primera");
    assert.equal(activeHeading([null, 200, null], 100), 1, "salta las que no existen");
    assert.equal(activeHeading([-900, -500, 300], 100, true), 2, "al final, la última");
    assert.equal(activeHeading([null, null], 100), -1);
    assert.equal(activeHeading([], 100, true), -1);
  });
  test("propiedad: el índice activo es el mayor con top ≤ línea (o el primero existente)", () => {
    fc.assert(
      fc.property(fc.array(fc.option(fc.integer({ min: -2000, max: 2000 }), { nil: null }), { maxLength: 30 }), fc.integer({ min: 0, max: 800 }), (tops, line) => {
        const i = activeHeading(tops, line);
        const existing = tops.map((t, k) => (t === null ? -1 : k)).filter((k) => k >= 0);
        if (!existing.length) return assert.equal(i, -1);
        const passed = existing.filter((k) => (tops[k] as number) <= line);
        assert.equal(i, passed.length ? passed[passed.length - 1] : existing[0]);
      }),
    );
  });
  test("línea de lectura, desplazamiento y fragmentos", () => {
    assert.equal(readingLine(400, 0), 100);
    assert.equal(readingLine(1200, 64), 224, "como mucho 160 bajo lo que tapa");
    assert.equal(readingLine(-5, -3), 0);
    assert.equal(scrollBehaviorFor(false), "smooth");
    assert.equal(scrollBehaviorFor(true), "auto", "movimiento reducido");
    assert.equal(scrollBehaviorFor(false, false), "auto");
    assert.equal(fragmentId("#install"), "install");
    assert.equal(fragmentId("#caf%C3%A9"), "café");
    assert.equal(fragmentId("#%E0%A4%A"), "%E0%A4%A", "mal codificado: tal cual");
    assert.equal(fragmentId("/docs#x"), null);
    assert.equal(fragmentId("#"), null);
    assert.equal(fragmentId(null), null);
  });
  test("árbol: navegación con nombre, aria-current en la activa y compacto como <details>", () => {
    const items = [
      { id: "intro", label: "Intro", level: 2 },
      { id: "api", label: "API", level: 3 },
    ];
    const out = html(tableOfContentsWidget, { items, defaultActive: "api" });
    assert.match(out, /role="navigation" aria-label="On this page"/);
    assert.match(out, /<a class="z-toc__link" href="#api" aria-current="true">API<\/a>/);
    assert.match(out, /data-depth="1"/);
    assert.match(out, /<p class="z-toc__title" aria-hidden="true">On this page<\/p>/);
    const compact = html(tableOfContentsWidget, { items, compact: true, defaultActive: "intro", labels: { title: "Contents" } });
    assert.match(compact, /<details class="z-toc__compact">/);
    assert.match(compact, /z-toc__summary-current">Intro</);
    assert.doesNotMatch(html(tableOfContentsWidget, { items, hideTitle: true }), /z-toc__title/);
    const controlled = tableOfContentsWidget.control!(tableOfContentsWidget.configure({ items, active: "api" }), { active: "intro", open: false });
    assert.equal(controlled.active, "api");
  });
  test("clic: lleva a la sección, la marca, la enfoca y avisa", () => {
    const { root, events, state, detach } = mountWidget(tableOfContentsWidget, {
      items: [
        { id: "s1", label: "One" },
        { id: "s2", label: "Two" },
      ],
      smooth: false,
    });
    const target = document.createElement("h2");
    target.id = "s2";
    document.body.append(target);
    click(root.querySelector('a[href="#s2"]'));
    assert.equal(state().active, "s2");
    assert.deepEqual(events.at(-1), ["active-change", { id: "s2" }]);
    assert.equal(target.getAttribute("tabindex"), "-1");
    assert.equal(document.activeElement, target);
    // Un enlace a una sección que no existe sigue su curso.
    click(root.querySelector('a[href="#s1"]'));
    assert.equal(state().active, "s2");
    detach();
  });
  test("fromDom: lista en data-props y atributos", () => {
    const el = document.createElement("div");
    el.dataset.compact = "";
    el.dataset.offset = "64";
    el.dataset.smooth = "false";
    el.dataset.active = "b";
    el.dataset.label = "Contents";
    const p = tableOfContentsWidget.fromDom(el, { items: [{ id: "b", label: "B" }] });
    assert.equal(p.compact, true);
    assert.equal(p.offset, 64);
    assert.equal(p.smooth, false);
    assert.equal(p.defaultActive, "b");
    assert.equal(p.labels?.title, "Contents");
    assert.equal(tableOfContentsWidget.fromDom(document.createElement("div"), {}).items, undefined);
  });
});

describe("TopProgress (core/top-progress)", () => {
  const fake = () => {
    let now = 0;
    const queue: Array<{ at: number; fn: () => void; id: number }> = [];
    let seq = 0;
    return {
      timers: {
        set(fn: () => void, ms: number) {
          queue.push({ at: now + ms, fn, id: ++seq });
          return seq;
        },
        clear(id: unknown) {
          const i = queue.findIndex((q) => q.id === id);
          if (i >= 0) queue.splice(i, 1);
        },
      },
      advance(ms: number) {
        now += ms;
        for (;;) {
          queue.sort((a, b) => a.at - b.at);
          const next = queue[0];
          if (!next || next.at > now) break;
          queue.shift();
          next.fn();
        }
      },
    };
  };
  test("goteo: pasos decrecientes y nunca llega al final", () => {
    assert.equal(trickleStep(0), 0.1);
    assert.equal(trickleStep(0.3), 0.04);
    assert.equal(trickleStep(0.7), 0.02);
    assert.equal(trickleStep(0.95), 0.005);
    assert.equal(trickleStep(0.995), 0);
    assert.equal(trickleStep(Number.NaN), 0.1);
    assert.equal(advance(0.99, 1), 0.994);
    assert.equal(advance(0.5, -9), 0);
    assert.equal(advance(Number.NaN), 0.1);
  });
  test("propiedad: el goteo es monótono y se queda por debajo de 1", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.integer({ min: 1, max: 400 }), (v, n) => {
        let x = v;
        for (let i = 0; i < n; i++) {
          const next = advance(x);
          assert.ok(next >= Math.min(x, 0.994) - 1e-12);
          x = next;
        }
        assert.ok(x <= 0.994);
      }),
    );
  });
  test("controlador: start, goteo, set, inc, done y reset", () => {
    const t = fake();
    const p = createProgress({ timers: t.timers, trickleMs: 100, doneMs: 200 });
    const seen: string[] = [];
    const off = p.subscribe((s) => seen.push(s.status));
    p.done();
    assert.equal(p.snapshot().status, "idle", "done sin empezar no hace nada");
    p.start();
    assert.deepEqual(p.snapshot(), { status: "loading", value: 0.08 });
    t.advance(100);
    assert.ok(Math.abs(p.snapshot().value - 0.18) < 1e-9);
    p.start();
    assert.ok(p.snapshot().value > 0.08, "start durante la carga sigue donde iba");
    p.set(0.5);
    t.advance(1000);
    assert.equal(p.snapshot().value, 0.5, "set para el goteo");
    p.inc(0.1);
    assert.equal(p.snapshot().value, 0.6);
    p.done();
    assert.deepEqual(p.snapshot(), { status: "done", value: 1 });
    t.advance(200);
    assert.deepEqual(p.snapshot(), { status: "idle", value: 0 });
    p.inc();
    assert.equal(p.snapshot().status, "loading", "inc parado empieza");
    p.reset();
    assert.equal(p.snapshot().status, "idle");
    p.done(true);
    assert.equal(p.snapshot().status, "done", "done forzado");
    off();
    assert.ok(seen.includes("done"));
  });
  test("vista: valor controlado, activa sin valor o el controlador", () => {
    assert.deepEqual(progressView({ value: 64 }, { status: "idle", value: 0 }), { status: "loading", value: 0.64, determinate: true });
    assert.equal(progressView({ value: 100 }, { status: "idle", value: 0 }).status, "done");
    assert.equal(progressView({ value: 50, active: false }, { status: "idle", value: 0 }).status, "idle");
    assert.deepEqual(progressView({ active: true }, { status: "idle", value: 0 }), { status: "loading", value: 0, determinate: false });
    assert.deepEqual(progressView({}, { status: "loading", value: 0.3 }), { status: "loading", value: 0.3, determinate: true });
  });
  test("árbol: progressbar con valor, indeterminada sin aria-valuenow y en reposo oculta", () => {
    assert.match(html(topProgressWidget, { value: 42 }), /role="progressbar" aria-label="Loading" aria-valuemin="0" aria-valuemax="100" aria-valuenow="42"/);
    const indeterminate = html(topProgressWidget, { active: true });
    assert.match(indeterminate, /data-indeterminate/);
    assert.doesNotMatch(indeterminate, /aria-valuenow/);
    assert.match(html(topProgressWidget, { controller: createProgress() }), /aria-hidden="true" data-state="idle"/);
    const el = document.createElement("div");
    el.dataset.value = "30";
    el.dataset.active = "";
    el.dataset.inline = "";
    el.dataset.announce = "false";
    assert.deepEqual(topProgressWidget.fromDom(el, {}), { value: 30, active: true, indeterminate: false, announce: false, inline: true, labels: undefined });
  });
  test("pieza: sigue al controlador y anuncia el principio y el final", () => {
    const t = fake();
    const controller = createProgress({ timers: t.timers, doneMs: 10 });
    const { root, detach } = mountWidget(topProgressWidget, { controller });
    controller.start();
    assert.equal(root.querySelector(".z-top-progress")?.getAttribute("data-state"), "loading");
    controller.done();
    assert.equal(root.querySelector(".z-top-progress")?.getAttribute("aria-valuenow"), "100");
    detach();
  });
});

describe("OverflowList (core/overflow-list)", () => {
  test("cuántos caben: todos, con «+N» o el mínimo", () => {
    assert.equal(fitCount([50, 50, 50], 170, 10), 3, "caben todos sin el botón");
    assert.equal(fitCount([50, 50, 50], 150, 10, 30), 2, "dos y el botón");
    assert.equal(fitCount([50, 50, 50], 60, 10, 30), 0);
    assert.equal(fitCount([50, 50, 50], 60, 10, 30, 1), 1, "mínimo visible");
    assert.equal(fitCount([200, 10, 10], 100, 0, 20, 0, "start"), 2, "recorta por el principio");
    assert.equal(fitCount([], 100), 0);
    assert.equal(fitCount([10, Number.NaN], Number.NaN), 0, "sin espacio conocido, ninguno");
  });
  test("propiedad: lo visible más el botón cabe, o es el mínimo pedido", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 200 }), { maxLength: 15 }),
        fc.integer({ min: 0, max: 1200 }),
        fc.integer({ min: 0, max: 16 }),
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 4 }),
        (widths, space, gap, more, min) => {
          const k = fitCount(widths, space, gap, more, min);
          assert.ok(k >= 0 && k <= widths.length);
          if (k === widths.length) return;
          const used = widths.slice(0, k).reduce((a, w) => a + w + gap, more);
          assert.ok(used <= space + 0.5 || k === Math.min(min, widths.length));
        },
      ),
    );
  });
  test("índices visibles y marcado del modo DOM", () => {
    assert.deepEqual(visibleIndexes(5, 2), [0, 1]);
    assert.deepEqual(visibleIndexes(5, 2, "start"), [3, 4]);
    assert.deepEqual(visibleIndexes(2, 9), [0, 1]);
    document.body.innerHTML =
      '<div class="z-overflow-list"><div class="z-overflow-list__item" data-id="a"></div><div class="z-overflow-list__item" data-id="b"></div><div class="z-overflow-list__item" data-id="c"></div><button class="z-overflow-list__more" data-z-open="#m"><span class="z-overflow-list__count"></span></button></div><div id="m"><button data-overflow-for="a"></button><button data-overflow-for="b"></button><button data-overflow-for="c"></button></div>';
    const root = document.querySelector<HTMLElement>(".z-overflow-list")!;
    paintOverflow(root, 1, "end", "{count} more");
    const more = root.querySelector(".z-overflow-list__more")!;
    assert.equal(more.getAttribute("aria-label"), "2 more");
    assert.equal(more.textContent, "+2");
    assert.ok(root.querySelector('[data-id="b"]')!.hasAttribute("inert"));
    assert.equal(root.querySelector('[data-id="a"]')!.hasAttribute("aria-hidden"), false);
    assert.deepEqual(
      [...document.querySelectorAll<HTMLElement>("[data-overflow-for]")].map((e) => e.hidden),
      [true, false, false],
    );
    paintOverflow(root, 3, "end", "{count} more");
    assert.ok(more.hasAttribute("data-overflow"), "sin ocultos, el botón sobra");
  });
});

describe("DataView (core/data-view)", () => {
  const store = (initial: Record<string, string> = {}, broken = false) => {
    const data = { ...initial };
    return {
      getItem: (k: string) => {
        if (broken) throw new Error("blocked");
        return data[k] ?? null;
      },
      setItem: (k: string, v: string) => {
        if (broken) throw new Error("blocked");
        data[k] = v;
      },
      data,
    };
  };
  test("lectura y escritura tolerantes", () => {
    assert.equal(readLayout(store({ k: "grid" }), "k", "list"), "grid");
    assert.equal(readLayout(store({ k: "table" }), "k", "list"), "list", "valor desconocido");
    assert.equal(readLayout(store({}, true), "k", "grid"), "grid", "almacén que lanza");
    assert.equal(readLayout(null, "k", "list"), "list");
    assert.equal(readLayout(store(), undefined, "grid"), "grid");
    const s = store();
    assert.equal(writeLayout(s, "k", "grid"), true);
    assert.equal(s.data.k, "grid");
    assert.equal(writeLayout(store({}, true), "k", "grid"), false);
    assert.equal(writeLayout(s, undefined, "grid"), false);
    assert.equal(isLayout("grid") && !isLayout("table"), true);
    assert.equal(windowStore(null), null);
    const throwing = Object.defineProperty({}, "localStorage", {
      get() {
        throw new Error("denied");
      },
    }) as Window;
    assert.equal(windowStore(throwing), null);
  });
  test("modo DOM: el conmutador cambia la disposición, la guarda y avisa", () => {
    const storage = window.localStorage;
    storage.clear();
    document.body.innerHTML =
      '<div class="z-dataview" data-layout="list" data-persist="dv-test"><div class="z-dataview__bar"><div class="z-dataview__switch" role="radiogroup"><button role="radio" value="list"></button><button role="radio" value="grid"></button></div></div><ul class="z-dataview__items"></ul></div>';
    const root = document.querySelector<HTMLElement>(".z-dataview")!;
    const off = attachDataView(root);
    assert.equal(root.querySelector('[value="list"]')!.getAttribute("aria-checked"), "true");
    const seen: string[] = [];
    root.addEventListener("z:layoutchange", (e) => seen.push((e as CustomEvent).detail.layout));
    root.querySelector(".z-dataview__switch")!.dispatchEvent(new CustomEvent("z:change", { bubbles: true, detail: { value: "grid" } }));
    assert.equal(root.dataset.layout, "grid");
    assert.equal(storage.getItem("dv-test"), "grid");
    assert.deepEqual(seen, ["grid"]);
    off();
    // Al volver a montar, lo guardado manda.
    root.dataset.layout = "list";
    const again = attachDataView(root);
    assert.equal(root.dataset.layout, "grid");
    again();
  });
});

describe("ChatSearch (core/chat-search)", () => {
  test("coincidencias sin mayúsculas ni acentos, en orden de lectura", () => {
    const m = findMatches(["Café con leche", "otro CAFE", "nada"], "cafe");
    assert.deepEqual(m, [
      { index: 0, start: 0, end: 4 },
      { index: 1, start: 5, end: 9 },
    ]);
    assert.deepEqual(findMatches(["Café"], "cafe", { matchCase: true }), []);
    assert.deepEqual(findMatches(["abc"], "   "), []);
    assert.equal(findMatches(["aaaa"], "aa").length, 1, "las solapadas se unen");
  });
  test("propiedad: cada coincidencia, plegada, es la consulta", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 40 }), { maxLength: 8 }), fc.string({ minLength: 1, maxLength: 3 }), (texts, q) => {
        if (!q.trim()) return;
        const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
        for (const m of findMatches(texts, q)) {
          const piece = texts[m.index]!.slice(m.start, m.end);
          assert.ok(fold(piece).includes(fold(q.trim())), `${piece} ⊇ ${q}`);
        }
      }),
    );
  });
  test("anterior y siguiente dan la vuelta; contador", () => {
    assert.equal(stepMatch(0, 3, 1), 1);
    assert.equal(stepMatch(2, 3, 1), 0);
    assert.equal(stepMatch(0, 3, -1), 2);
    assert.equal(stepMatch(-1, 3, -1), 2);
    assert.equal(stepMatch(0, 0, 1), -1);
    assert.equal(nearestMatch([{ index: 0, start: 0, end: 1 }, { index: 4, start: 0, end: 1 }], 2), 1);
    assert.equal(nearestMatch([{ index: 0, start: 0, end: 1 }], 9), 0);
    assert.equal(nearestMatch([], 0), -1);
    assert.equal(countText(1, 7, "{current} of {total}", "No results"), "2 of 7");
    assert.equal(countText(0, 0, "{current} of {total}", "No results"), "No results");
  });
  test("pieza: busca en la lista, avanza con Intro y retrocede con Mayús + Intro, Escape cierra", async () => {
    const { root, events, state, detach } = mountWidget(chatSearchWidget, { target: "msgs", defaultQuery: "release" });
    // La lista va después de montar (el montaje de prueba vacía el documento); la búsqueda empieza en una microtarea.
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div id="msgs"><p class="z-message__text">release one</p><p class="z-message__text">nothing</p><p class="z-message__text">release two</p></div>',
    );
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(state().total, 2);
    assert.match(root.querySelector(".z-chat-search__count")!.textContent!, /1 of 2/);
    // Cada pintado del montaje de prueba rehace el marcado: el campo se vuelve a buscar.
    const field = () => root.querySelector<HTMLInputElement>(".z-chat-search__input")!;
    key(field(), "Enter");
    assert.equal(state().current, 1);
    key(field(), "Enter", { shiftKey: true });
    assert.equal(state().current, 0);
    key(field(), "Enter", { shiftKey: true });
    assert.equal(state().current, 1, "da la vuelta");
    click(root.querySelector(".z-chat-search__next"));
    assert.equal(state().current, 0);
    // Sin la Highlight API (happy-dom), los mensajes con coincidencias se marcan.
    assert.equal(document.querySelectorAll("[data-search-hit]").length, 2);
    assert.equal(document.querySelectorAll("[data-search-current]").length, 1);
    key(field(), "Escape");
    assert.equal(events.at(-1)?.[0], "close");
    const input = field();
    input.value = "nothing";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 160));
    assert.equal(state().total, 1);
    assert.ok(events.some(([n]) => n === "query-change"));
    detach();
    assert.equal(document.querySelectorAll("[data-search-hit]").length, 0, "al desmontar no deja marcas");
  });
});

const V8 = `TypeError: Cannot read properties of undefined (reading 'map')
    at ProjectList (http://localhost:5173/src/screens/Projects.tsx:42:19)
    at renderWithHooks (http://localhost:5173/node_modules/.vite/deps/react-dom.js:11548:26)
    at async Promise.all (index 0)
    at new Store (/app/src/store.ts:3:1)
    at node:internal/process/task_queues:95:5
    at loadProjects (http://localhost:5173/src/data/projects.ts:17:5)`;
const FIREFOX = `ProjectList@http://localhost:5173/src/screens/Projects.tsx:42:19
renderWithHooks@http://localhost:5173/node_modules/.vite/deps/react-dom.js:11548:26
@http://localhost:5173/@vite/client:10:2
fn@[native code]`;

describe("StackTrace (core/stack-trace)", () => {
  test("V8: cabecera, marcos y los de terceros", () => {
    const e = parseStack(V8);
    assert.equal(e.name, "TypeError");
    assert.equal(e.message, "Cannot read properties of undefined (reading 'map')");
    assert.deepEqual(
      e.frames.map((f) => [f.fn, f.line, f.app]),
      [
        ["ProjectList", 42, true],
        ["renderWithHooks", 11548, false],
        ["Promise.all", undefined, true],
        ["new Store", 3, true],
        ["", 95, false],
        ["loadProjects", 17, true],
      ],
    );
    assert.equal(e.frames[0]!.column, 19);
  });
  test("Firefox y Safari: fn@archivo, anónimas y código nativo", () => {
    const e = parseStack({ name: "TypeError", message: "x is undefined", stack: FIREFOX });
    assert.equal(e.name, "TypeError");
    assert.equal(e.message, "x is undefined");
    assert.deepEqual(
      e.frames.map((f) => [f.fn, f.file, f.app]),
      [
        ["ProjectList", "http://localhost:5173/src/screens/Projects.tsx", true],
        ["renderWithHooks", "http://localhost:5173/node_modules/.vite/deps/react-dom.js", false],
        ["", "http://localhost:5173/@vite/client", false],
        ["fn", "[native code]", false],
      ],
    );
    assert.equal(parseFrame("Invalid email a@b.c"), null, "un mensaje con @ no es un marco");
    assert.equal(parseFrame("   "), null);
    assert.deepEqual(parseStack(null), { name: "", message: "", frames: [] });
    assert.equal(parseStack("just a message").message, "just a message");
  });
  test("grupos, ruta corta, ubicación y texto para copiar", () => {
    const groups = groupFrames(parseStack(V8).frames);
    assert.deepEqual(
      groups.map((g) => (g.kind === "app" ? `a${g.index}` : `l${g.start}:${g.frames.length}`)),
      ["a0", "l1:1", "a2", "a3", "l4:1", "a5"],
    );
    assert.equal(shortFile("http://localhost:5173/src/screens/Projects.tsx?t=1"), "…/screens/Projects.tsx");
    assert.equal(shortFile("app.js"), "app.js");
    assert.equal(frameLocation({ file: "a.js", line: 1, column: 2 }), "a.js:1:2");
    assert.equal(frameLocation({ file: "a.js" }), "a.js");
    const text = stackText(parseStack(V8));
    assert.match(text, /^TypeError: Cannot read/);
    assert.match(text, /\n {4}at ProjectList \(http:\/\/localhost:5173\/src\/screens\/Projects\.tsx:42:19\)/);
  });
  test("propiedad: leer, copiar y volver a leer conserva los marcos", () => {
    const frame = fc.record({
      fn: fc.constantFrom("", "run", "Foo.bar", "new Thing"),
      file: fc.constantFrom("http://x.test/src/a.ts", "/app/node_modules/lib/index.js", "file:///b.js"),
      line: fc.integer({ min: 1, max: 9999 }),
      column: fc.integer({ min: 1, max: 999 }),
    });
    fc.assert(
      fc.property(fc.array(frame, { minLength: 1, maxLength: 8 }), (frames) => {
        const stack = `Error: boom\n${frames.map((f) => `    at ${f.fn ? `${f.fn} (${f.file}:${f.line}:${f.column})` : `${f.file}:${f.line}:${f.column}`}`).join("\n")}`;
        const once = parseStack(stack);
        const twice = parseStack(stackText(once));
        assert.deepEqual(
          twice.frames.map((f) => [f.fn, f.file, f.line, f.column, f.app]),
          once.frames.map((f) => [f.fn, f.file, f.line, f.column, f.app]),
        );
      }),
    );
  });
  test("pieza: plegar, abrir un grupo, elegir un marco y copiar", async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void writes.push(t) } });
    const { root, events, state, detach } = mountWidget(stackTraceWidget, { error: V8, selectable: true });
    assert.equal(root.querySelectorAll(".z-stack-trace__library[hidden]").length, 2);
    click(root.querySelector(".z-stack-trace__toggle-group"));
    assert.deepEqual(state().expanded, [1]);
    click(root.querySelector('.z-stack-trace__open[data-index="0"]'));
    assert.equal((events.at(-1)![1] as { index: number }).index, 0);
    click(root.querySelector(".z-stack-trace__toggle"));
    assert.equal(state().open, false);
    assert.ok(root.querySelector(".z-stack-trace__frames")!.hasAttribute("hidden"));
    click(root.querySelector(".z-stack-trace__copy"));
    await new Promise((r) => setTimeout(r, 0));
    assert.match(writes[0]!, /^TypeError/);
    assert.deepEqual(events.at(-1), ["copy", { ok: true }]);
    detach();
    const el = document.createElement("div");
    el.dataset.open = "false";
    el.dataset.libraryPatterns = "vendor, lib";
    const p = stackTraceWidget.fromDom(el, { error: "Error: x" });
    assert.equal(p.defaultOpen, false);
    assert.deepEqual(p.libraryPatterns, ["vendor", "lib"]);
    assert.match(html(stackTraceWidget, { error: V8, showLibrary: true }), /aria-expanded="true"/);
  });
});

describe("WebPreview (core/web-preview)", () => {
  test("dirección: http y https, sin esquema se supone https", () => {
    assert.equal(normalizeUrl("example.com"), "https://example.com/");
    assert.equal(normalizeUrl("  http://example.com/a?b=1 "), "http://example.com/a?b=1");
    assert.equal(normalizeUrl("//cdn.test/x"), "https://cdn.test/x");
    assert.equal(normalizeUrl("javascript:alert(1)"), null);
    assert.equal(normalizeUrl("data:text/html,hi"), null);
    assert.equal(normalizeUrl("file:///etc/passwd"), null);
    assert.equal(normalizeUrl("not a url"), null);
    assert.equal(normalizeUrl(""), null);
    assert.equal(displayUrl("https://example.com/"), "https://example.com");
    assert.equal(displayUrl("https://example.com/a/"), "https://example.com/a/");
  });
  test("propiedad: lo que pasa es siempre http o https", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const url = normalizeUrl(s);
        if (url) assert.match(url, /^https?:\/\//);
      }),
    );
  });
  test("historial de la barra y sandbox", () => {
    let h = visit({ entries: [], index: -1 }, "https://a.test/");
    h = visit(h, "https://b.test/");
    assert.equal(visit(h, "https://b.test/"), h, "la actual no se repite");
    assert.ok(canTravel(h, -1) && !canTravel(h, 1));
    h = travel(h, -1);
    assert.equal(h.entries[h.index], "https://a.test/");
    assert.equal(travel(h, -1), h, "no hay más atrás");
    h = visit(h, "https://c.test/");
    assert.deepEqual(h.entries, ["https://a.test/", "https://c.test/"], "visitar corta lo de delante");
    assert.equal(sandboxValue(undefined), "allow-scripts allow-forms");
    assert.equal(sandboxValue("allow-scripts allow-top-navigation allow-scripts"), "allow-scripts", "desconocidos fuera, sin repetir");
    assert.equal(sandboxValue(""), "");
    assert.equal(sandboxValue(["allow-popups"]), "allow-popups");
  });
  test("pieza: dirección no válida, navegar, atrás, adelante, recargar y anchos", () => {
    const { root, state, events, detach } = mountWidget(webPreviewWidget, { defaultUrl: "a.test", viewports: true });
    const frame = root.querySelector("iframe")!;
    assert.equal(frame.getAttribute("sandbox"), "allow-scripts allow-forms");
    assert.equal(frame.getAttribute("referrerpolicy"), "no-referrer");
    assert.equal(frame.getAttribute("title"), "Web preview");
    const input = root.querySelector<HTMLInputElement>(".z-web-preview__input")!;
    const submit = () => root.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    input.value = "javascript:alert(1)";
    submit();
    assert.equal(state().invalid, true);
    assert.match(root.innerHTML, /role="alert"/);
    root.querySelector<HTMLInputElement>(".z-web-preview__input")!.value = "b.test";
    submit();
    assert.equal(state().history.entries.at(-1), "https://b.test/");
    assert.deepEqual(events.at(-1), ["url-change", { url: "https://b.test/" }]);
    click(root.querySelector(".z-web-preview__back"));
    assert.equal(state().history.index, 0);
    click(root.querySelector(".z-web-preview__forward"));
    assert.equal(state().history.index, 1);
    click(root.querySelector(".z-web-preview__reload"));
    assert.equal(state().reloads, 1);
    click(root.querySelector('.z-web-preview__viewport[data-viewport="mobile"]'));
    assert.equal(state().viewport, "mobile");
    assert.match(root.innerHTML, /data-viewport="mobile"/);
    root.querySelector("iframe")!.dispatchEvent(new Event("load"));
    assert.equal(state().loading, false);
    detach();
    // Controlado: la aplicación decide.
    const c = webPreviewWidget.configure({ url: "https://x.test" });
    const next = webPreviewWidget.control!(webPreviewWidget.configure({ url: "https://y.test" }), webPreviewWidget.initial(c));
    assert.equal(next.history.entries.at(-1), "https://y.test/");
    assert.match(html(webPreviewWidget, {}), /Enter an address to preview it/);
  });
});

describe("VoiceInput (core/voice-input)", () => {
  test("qué falta para grabar y qué problema es", () => {
    assert.equal(recorderSupport(null), "unsupported");
    assert.equal(recorderSupport({}), "unsupported");
    assert.equal(recorderSupport({ MediaRecorder: Number, navigator: {} }), "unsupported");
    assert.equal(recorderSupport({ MediaRecorder: Number, navigator: { mediaDevices: { getUserMedia: () => {} } }, isSecureContext: false }), "unsupported");
    assert.equal(recorderSupport({ MediaRecorder: Number, navigator: { mediaDevices: { getUserMedia: () => {} } }, isSecureContext: true }), null);
    assert.equal(problemOf({ name: "NotAllowedError" }), "denied");
    assert.equal(problemOf(new Error("x")), "failed");
    assert.equal(problemOf(null), "failed");
    assert.equal(pickMimeType((t) => t === "audio/mp4"), "audio/mp4");
    assert.equal(pickMimeType(undefined), "");
    assert.equal(
      pickMimeType(() => {
        throw new Error("bad");
      }),
      "",
    );
  });
  test("reloj sin las pausas", () => {
    let clock = { startedAt: 1000, pausedMs: 0, pausedAt: null as number | null };
    assert.equal(recordedMs(clock, 3000), 2000);
    clock = pauseClock(clock, 3000);
    assert.equal(pauseClock(clock, 9999), clock, "pausar dos veces no cambia");
    assert.equal(recordedMs(clock, 8000), 2000, "en pausa no corre");
    clock = resumeClock(clock, 8000);
    assert.equal(resumeClock(clock, 9000), clock);
    assert.equal(recordedMs(clock, 9000), 3000);
    assert.equal(recordedMs({ startedAt: 10, pausedMs: 0, pausedAt: null }, 0), 0);
  });
  test("propiedad: lo grabado nunca supera el tiempo pasado y no baja al pausar", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 5000 }), { minLength: 1, maxLength: 12 }), (steps) => {
        let clock = { startedAt: 0, pausedMs: 0, pausedAt: null as number | null };
        let now = 0;
        let last = 0;
        steps.forEach((s, i) => {
          now += s;
          clock = i % 2 ? resumeClock(clock, now) : pauseClock(clock, now);
          const rec = recordedMs(clock, now);
          assert.ok(rec <= now && rec >= last);
          last = rec;
        });
      }),
    );
  });
  test("nivel y barras", () => {
    assert.equal(levelOf([0, -0.25, 0.04]), 0.5);
    assert.equal(levelOf([]), 0);
    assert.deepEqual(pushLevel([0.1, 0.2], 2, 2), [0.2, 1]);
    assert.deepEqual(pushLevel([], Number.NaN, 3), [0]);
    assert.deepEqual(levelBars([0.5], 3), [0.08, 0.08, 0.5]);
    assert.deepEqual(levelBars([0, 1, 2], 2), [1, 1]);
  });
  test("pieza: sin MediaRecorder el botón queda desactivado con su motivo", async () => {
    const { root, state, detach } = mountWidget(voiceInputWidget, { showLabel: true });
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(state().support, "unsupported");
    const button = root.querySelector(".z-voice-input__record")!;
    assert.ok(button.hasAttribute("disabled"));
    assert.match(root.querySelector(".z-voice-input__message")!.textContent!, /isn't available/);
    detach();
    const recording = html(voiceInputWidget, {}, { status: "recording", elapsed: 7000, levels: [0.5] });
    assert.match(recording, /role="timer" aria-label="Recording time">0:07</);
    assert.match(recording, /aria-label="Pause recording"/);
    assert.match(html(voiceInputWidget, {}, { status: "paused" }), /aria-label="Resume recording"/);
    assert.match(html(voiceInputWidget, {}, { status: "error", problem: "denied" }), /role="alert">Microphone access was denied/);
    const el = document.createElement("div");
    el.dataset.maxDuration = "60";
    el.dataset.showLabel = "";
    assert.deepEqual(voiceInputWidget.fromDom(el, {}), { maxDuration: 60, bars: undefined, showLabel: true, disabled: false });
  });
  test("pieza: graba, pausa, sigue y envía con un MediaRecorder de prueba", async () => {
    class FakeRecorder extends (window.EventTarget as typeof EventTarget) {
      state = "inactive";
      mimeType = "audio/webm";
      static isTypeSupported = (t: string) => t === "audio/webm";
      start() {
        this.state = "recording";
      }
      pause() {
        this.state = "paused";
      }
      resume() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        const data = new Event("dataavailable") as Event & { data: Blob };
        data.data = new Blob(["x"]);
        this.dispatchEvent(data);
        this.dispatchEvent(new Event("stop"));
      }
    }
    const w = window as unknown as Record<string, unknown>;
    const restore = { MediaRecorder: w.MediaRecorder };
    w.MediaRecorder = FakeRecorder;
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
    const { root, state, events, detach } = mountWidget(voiceInputWidget, {});
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(state().support, null);
    click(root.querySelector(".z-voice-input__record"));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(state().status, "recording");
    click(root.querySelector(".z-voice-input__pause"));
    assert.equal(state().status, "paused");
    click(root.querySelector(".z-voice-input__pause"));
    assert.equal(state().status, "recording");
    click(root.querySelector(".z-voice-input__send"));
    assert.equal(state().status, "idle");
    const sent = events.find(([n]) => n === "send")?.[1] as { blob: Blob; peaks: number[]; type: string };
    assert.equal(sent.type, "audio/webm");
    assert.equal(sent.peaks.length, 40);
    click(root.querySelector(".z-voice-input__record"));
    await new Promise((r) => setTimeout(r, 10));
    key(root.querySelector(".z-voice-input__send")!, "Escape");
    assert.equal(events.at(-1)?.[0], "cancel");
    // Permiso negado.
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw Object.assign(new Error("no"), { name: "NotAllowedError" });
        },
      },
    });
    click(root.querySelector(".z-voice-input__record"));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(state().status, "error");
    assert.equal(state().problem, "denied");
    detach();
    w.MediaRecorder = restore.MediaRecorder;
  });
});

describe("AudioPlayer y Waveform (core/audio-player)", () => {
  test("saltos, teclas, velocidad y textos", () => {
    assert.equal(skipBy(5, -10, 60), 0);
    assert.equal(skipBy(55, 10, 60), 60);
    assert.equal(skipBy(5, 10, 0), 15, "sin duración conocida no hay tope");
    assert.equal(skipBy(Number.NaN, Number.NaN, 60), 0);
    assert.equal(playerKey("k"), "toggle");
    assert.equal(playerKey("K"), "toggle");
    assert.equal(playerKey(" "), "toggle");
    assert.equal(playerKey(" ", { onButton: true }), null, "Espacio en un botón lo pulsa");
    assert.equal(playerKey("j"), "back");
    assert.equal(playerKey("l"), "forward");
    assert.equal(playerKey("l", { modifier: true }), null);
    assert.equal(playerKey("ArrowLeft"), null);
    assert.equal(skipLabel("Back {seconds} seconds", -10.4), "Back 10 seconds");
    assert.equal(rateText(1.5), "1.5×");
    assert.equal(rateText(Number.NaN), "1×");
  });
  test("propiedad: un salto queda dentro de [0, duración]", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.double({ min: 0.1, max: 1e4, noNaN: true }), (p, d, dur) => {
        const v = skipBy(p, d, dur);
        assert.ok(v >= 0 && v <= dur);
      }),
    );
  });
  test("onda: slider con tiempo y barras reproducidas", () => {
    const out = toHTML(waveNode({ peaks: [1, 2, 3, 4], bars: 4, position: 30, duration: 60, label: "Seek", cls: "z-waveform__wave" }));
    assert.match(out, /role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="60" aria-valuenow="30" aria-valuetext="0:30 \/ 1:00"/);
    assert.equal((out.match(/data-played/g) ?? []).length, 2);
    assert.match(toHTML(waveNode({ bars: 4, position: 0, duration: 0, label: "Seek", cls: "x", disabled: true, loading: true })), /tabindex="-1".*aria-disabled="true" aria-busy="true"/);
  });
  test("Waveform: el teclado busca y la posición controlada manda", () => {
    const { root, state, events, detach } = mountWidget(waveformWidget, { duration: 60, peaks: [1, 2, 3] });
    const wave = () => root.querySelector(".z-waveform__wave")!;
    key(wave(), "ArrowRight");
    assert.equal(state().position, 5);
    key(wave(), "End");
    assert.equal(state().position, 60);
    assert.deepEqual(events.at(-1), ["seek", { position: 60 }]);
    detach();
    const c = waveformWidget.configure({ position: 12 });
    assert.equal(waveformWidget.control!(c, waveformWidget.initial(c)).position, 12);
    const el = document.createElement("div");
    el.dataset.peaks = "1 2 3";
    el.dataset.duration = "9";
    assert.deepEqual(waveformWidget.fromDom(el, {}).peaks, [1, 2, 3]);
  });
  test("AudioPlayer: árbol, velocidad, saltos y teclas sin audio cargado", () => {
    const out = html(audioPlayerWidget, { src: "/a.mp3", title: "Episode", duration: 120 });
    assert.match(out, /role="group" aria-labelledby="w-title"/);
    assert.match(out, /aria-label="Back 10 seconds"/);
    assert.match(out, /aria-label="Playback speed 1×"/);
    assert.match(html(audioPlayerWidget, {}), /aria-label="Audio player"/);
    const { root, state, events, detach } = mountWidget(audioPlayerWidget, { src: "/a.mp3", duration: 120, skipForward: 30 });
    click(root.querySelector(".z-audio-player__rate"));
    assert.equal(state().rate, 1.25);
    click(root.querySelector(".z-audio-player__forward"));
    assert.equal(state().position, 30);
    key(root.querySelector(".z-audio-player__wave")!, "j");
    assert.equal(state().position, 20);
    key(root.querySelector(".z-audio-player__wave")!, "Home");
    assert.equal(state().position, 0);
    assert.ok(events.some(([n]) => n === "rate-change"));
    detach();
    const el = document.createElement("div");
    el.dataset.src = "/b.mp3";
    el.dataset.rates = "1 2";
    el.dataset.analyze = "";
    const p = audioPlayerWidget.fromDom(el, {});
    assert.deepEqual(p.rates, [1, 2]);
    assert.equal(p.analyze, true);
  });
  test("decodePeaks: sin Web Audio o si falla la descarga, null", async () => {
    assert.equal(await decodePeaks(null, "/a.mp3", 10), null);
    const view = { fetch: async () => ({ ok: false }) } as unknown as Window;
    assert.equal(await decodePeaks(view, "/a.mp3", 10), null);
    const ok = {
      fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
      OfflineAudioContext: class {
        decodeAudioData() {
          return Promise.resolve({ duration: 3, numberOfChannels: 1, getChannelData: () => new Float32Array([0, 0.5, -1, 0.25]) });
        }
      },
    } as unknown as Window;
    const result = await decodePeaks(ok, "/a.mp3", 2);
    assert.deepEqual(result, { peaks: [0.5, 1], duration: 3 });
  });
});

describe("BackToTop, Affix y SearchView", () => {
  test("se ve pasado el umbral", () => {
    assert.equal(backToTopVisible(401, 400), true);
    assert.equal(backToTopVisible(400, 400), false);
    assert.equal(backToTopVisible(Number.NaN, 0), false);
    assert.equal(backToTopVisible(1, -50), true);
    const out = html(backToTopWidget, { showLabel: true });
    assert.match(out, /data-placement="sticky"/);
    assert.match(out, /tabindex="-1"/, "oculto: fuera del orden de tabulación");
    assert.match(html(backToTopWidget, { placement: "fixed" }, { visible: true }), /data-visible.*aria-label="Back to top"/);
    const el = document.createElement("div");
    el.dataset.threshold = "120";
    el.dataset.placement = "fixed";
    assert.equal(backToTopWidget.fromDom(el, {}).threshold, 120);
  });
  test("BackToTop: subir enfoca el destino", () => {
    const main = document.createElement("main");
    main.id = "top-target";
    const { root, events, detach } = mountWidget(backToTopWidget, { focusTarget: "top-target", smooth: false });
    document.body.prepend(main);
    window.scrollTo = (() => {}) as typeof window.scrollTo;
    click(root.querySelector(".z-back-to-top__button"));
    assert.equal(document.activeElement, main);
    assert.deepEqual(events.at(-1), ["click", {}]);
    detach();
  });
  test("Affix: pegado cuando asoma por el borde del área recortada", () => {
    const root = { top: 65, bottom: 800 };
    assert.equal(isStuck("top", 0.9, { top: 64, bottom: 110 }, root), true);
    assert.equal(isStuck("top", 1, { top: 200, bottom: 250 }, root), false);
    assert.equal(isStuck("top", 0.5, { top: 700, bottom: 900 }, root), false, "recortado por abajo no es pegado arriba");
    assert.equal(isStuck("bottom", 0.5, { top: 760, bottom: 820 }, root), true);
    assert.equal(isStuck("bottom", 0.5, { top: 0, bottom: 40 }, root), false);
  });
  test("SearchView: recortes desde la caja de la barra", () => {
    assert.deepEqual(growFrom({ left: 16, top: 12, right: 374, bottom: 60 }, { width: 390, height: 844 }), { top: 12, right: 16, bottom: 784, left: 16 });
    assert.deepEqual(growFrom({ left: -5, top: -1, right: 500, bottom: 900 }, { width: 390, height: 844 }), { top: 0, right: 0, bottom: 0, left: 0 });
  });
});
