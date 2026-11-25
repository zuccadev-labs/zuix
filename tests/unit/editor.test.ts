// Conector de editores visuales (zui/src/editor): validación, migraciones, salidas HTML, DOM y React, lectura de HTML,
// operaciones del árbol, protocolo y marca. Las propiedades con fast-check generan documentos (también hostiles) y
// comprueban lo que debe cumplirse siempre: la validación no lanza, el HTML no deja pasar marcado ni esquemas
// peligrosos, documento → HTML → documento conserva el contenido y las migraciones dan documentos válidos.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import fc from "fast-check";
import { React, renderToStaticMarkup } from "./helpers/react.mjs";
import { createUndoStack } from "../../zui/src/core/undo.ts";
import {
  type Catalog,
  type ElementNode,
  type PageDocument,
  type PageNode,
  DOCUMENT_JSON_SCHEMA,
  accepts,
  checkContrast,
  createBrandEditor,
  createDocument,
  envelope,
  envelopeProblem,
  findNode,
  fromHTML,
  idGenerator,
  insertNode,
  migrateDocument,
  moveNode,
  originAllowed,
  pathTo,
  removeNode,
  safeUrl,
  textOf,
  toHTML,
  toTrustedHTML,
  updateProps,
  updateStyle,
  updateText,
  validateDocument,
  validateSchema,
  versionOf,
  walk,
  withNewIds,
} from "../../zui/src/editor/index.ts";
import { toDOM } from "../../zui/src/editor/dom.ts";
import { toReact } from "../../zui/src/editor/react.ts";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261125), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 200) });

const catalog = JSON.parse(readFileSync(new URL("../../zui/editor/catalog.json", import.meta.url), "utf8")) as Catalog;
const doc = (body: PageNode[]): PageDocument => ({ format: "zuix.page", schemaVersion: 1, body });
const t = (id: string, text: string): PageNode => ({ id, type: "#text", text });
const codes = (d: unknown) => validateDocument(d, catalog).errors.map((e) => e.code);

/** Sin ids: para comparar documentos que solo difieren en ellos. */
function strip(list: PageNode[]): unknown[] {
  return list.map((n) => {
    if (n.type === "#text") return { text: (n as { text: string }).text };
    const e = n as ElementNode;
    return { type: e.type, props: e.props ?? {}, children: strip(e.children ?? []) };
  });
}

// ── Generadores de documentos con los bloques del conector ───────────────────────────────────────────────────
const words = fc.stringMatching(/^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ,.!?-]{0,30}$/).filter((s) => s.trim() === s && s.length > 0);
const hostile = fc.oneof(
  words,
  fc
    .array(fc.constantFrom("<", ">", '"', "'", "&", "/", "=", " ", "script", "onload", "javascript:", "&quot;", "a"), {
      minLength: 1,
      maxLength: 16,
    })
    .map((p) => p.join("")),
);
const counter = () => {
  let n = 0;
  return () => `n${n++}`;
};
type Gen = (id: () => string) => PageNode;
/** Contenido en línea sin textos contiguos (en HTML se fundirían en uno). */
const TEXT = Symbol("text");
const isTextGen = (g: Gen) => (g as unknown as { [TEXT]?: true })[TEXT] === true;
const markText = (g: Gen): Gen => Object.assign(g, { [TEXT]: true as const });
const phr = (depth: number) =>
  fc
    .array(
      fc.oneof(
        words.map((s) => markText((id) => t(id(), s))),
        ...(depth > 0
          ? [
              fc.tuple(fc.constantFrom("strong", "em", "code", "mark", "small"), fc.constant(depth)).chain(([tag, d]) =>
                phr(d - 1).map(
                  (kids): Gen =>
                    (id) => ({ id: id(), type: "InlineText", props: { tag }, children: kids.map((k) => k(id)) }),
                ),
              ),
            ]
          : []),
      ),
      { minLength: 1, maxLength: 4 },
    )
    .map((list) => list.filter((g, i) => i === 0 || !(isTextGen(g) && isTextGen(list[i - 1] as Gen))));
const block = (depth: number): fc.Arbitrary<Gen> =>
  fc.oneof(
    fc.tuple(fc.integer({ min: 1, max: 6 }), phr(1)).map(
      ([level, kids]): Gen =>
        (id) => ({ id: id(), type: "Heading", props: { level }, children: kids.map((k) => k(id)) }),
    ),
    phr(2).map(
      (kids): Gen =>
        (id) => ({ id: id(), type: "Paragraph", children: kids.map((k) => k(id)) }),
    ),
    fc.tuple(fc.boolean(), fc.array(phr(1), { minLength: 1, maxLength: 3 })).map(
      ([ordered, items]): Gen =>
        (id) => ({
          id: id(),
          type: "List",
          ...(ordered ? { props: { ordered } } : {}),
          children: items.map((kids) => ({ id: id(), type: "ListItem", children: kids.map((k) => k(id)) })),
        }),
    ),
    fc.tuple(fc.constantFrom("/a", "https://example.com/x", "#top", "mailto:a@b.c"), words).map(
      ([alt, s]): Gen =>
        (id) => ({ id: id(), type: "Image", props: { src: alt, alt: s } }),
    ),
    ...(depth > 0
      ? [
          fc.tuple(fc.constantFrom("section", "div", "article", "aside"), fc.array(block(depth - 1), { minLength: 1, maxLength: 3 })).map(
            ([tag, kids]): Gen =>
              (id) => ({ id: id(), type: "Section", props: { tag }, children: kids.map((k) => k(id)) }),
          ),
        ]
      : []),
  );
const coreDoc = fc.array(block(2), { minLength: 1, maxLength: 5 }).map((gens) => {
  const id = counter();
  return doc(gens.map((g) => g(id)));
});

describe("catálogo", () => {
  test("cumple su esquema y trae bloques, presets y tokens", () => {
    const schema = JSON.parse(readFileSync(new URL("../../zui/editor/catalog.schema.json", import.meta.url), "utf8"));
    assert.deepEqual(validateSchema(catalog, schema), []);
    assert.equal(catalog.schemaVersion, 1);
    assert.ok(catalog.blocks.length > 250);
    const button = catalog.blocks.find((b) => b.type === "Button");
    assert.equal(button?.html, "template");
    assert.equal(button?.props.properties.variant?.["x-control"], "select");
    assert.ok(button?.variants.some((v) => v.prop === "variant" && v.value === "primary"));
    const iconButton = catalog.blocks.find((b) => b.type === "IconButton");
    assert.equal(iconButton?.a11y[0]?.rule, "name");
    assert.ok(catalog.blocks.find((b) => b.type === "Grid")?.layout);
    assert.ok(catalog.blocks.find((b) => b.type === "Calendar")?.presets.every((p) => p.html));
    assert.ok(catalog.tokens.tokens.some((tk) => tk.name === "accent" && tk.type === "color" && tk.scope === "theme"));
    assert.ok(catalog.tokens.tokens.some((tk) => tk.name === "space-4" && tk.type === "length" && tk.max === 256));
  });

  test("los presets con nodo validan y salen en HTML", () => {
    let n = 0;
    for (const b of catalog.blocks) {
      for (const p of b.presets) {
        if (!p.node) continue;
        const node = b.parents ? { id: "wrap", type: b.parents[0] as string, children: [p.node] } : p.node;
        assert.ok(validateDocument(doc([node]), catalog).valid, `${b.type}/${p.id}`);
        if (b.html !== "none") assert.ok(toHTML(doc([node]), { catalog }).length > 0);
        n++;
      }
    }
    assert.ok(n > 300);
  });
});

describe("validación", () => {
  test("errores legibles con código, nodo y ruta", () => {
    const r = validateDocument(
      doc([
        {
          id: "s",
          type: "Section",
          children: [
            { id: "b", type: "IconButton", props: { icon: "plus" } },
            { id: "x", type: "Nope" },
          ],
        },
      ]),
      catalog,
    );
    assert.equal(r.valid, false);
    const a11y = r.errors.find((e) => e.code === "a11y.name");
    assert.equal(a11y?.nodeId, "b");
    assert.deepEqual(a11y?.path, ["s", "b"]);
    assert.equal(a11y?.pointer, "/body/0/children/0");
    assert.match(a11y?.message ?? "", /IconButton «b» \(en s\).*label/);
    assert.ok(r.errors.some((e) => e.code === "node.unknown-type" && e.nodeId === "x"));
  });

  test("props, iconos, estilo, anidado, ids y versión", () => {
    assert.deepEqual(codes(doc([{ id: "b", type: "Button", props: { variant: "huge" }, children: [t("t", "Go")] }])), ["prop.invalid"]);
    assert.deepEqual(codes(doc([{ id: "b", type: "Button", props: { icon: "no-such-icon" }, children: [t("t", "Go")] }])), ["prop.icon"]);
    assert.deepEqual(codes(doc([{ id: "b", type: "Button", props: { onClick: "x" }, children: [t("t", "Go")] }])), ["prop.invalid"]);
    assert.deepEqual(codes(doc([{ id: "p", type: "Paragraph", style: { padding: "space-99" }, children: [t("t", "x")] }])), [
      "style.invalid",
    ]);
    assert.deepEqual(codes(doc([{ id: "p", type: "Paragraph", style: { color: "#f00" }, children: [t("t", "x")] }])), ["document.shape"]);
    assert.deepEqual(
      codes(doc([{ id: "p", type: "Paragraph", style: { padding: "space-4", textAlign: "center" }, children: [t("t", "x")] }])),
      [],
    );
    assert.deepEqual(codes(doc([{ id: "b", type: "Button", children: [{ id: "c", type: "Button", children: [t("t", "x")] }] }])), [
      "nesting.not-allowed",
      "nesting.interactive",
    ]);
    assert.deepEqual(
      codes(
        doc([
          {
            id: "b",
            type: "Button",
            children: [
              { id: "i", type: "InlineText", children: [{ id: "l", type: "Link", props: { href: "/" }, children: [t("t", "x")] }] },
            ],
          },
        ]),
      ),
      ["nesting.interactive"],
    );
    assert.deepEqual(codes(doc([{ id: "li", type: "ListItem" }])), ["nesting.not-allowed", "nesting.parent"]);
    assert.deepEqual(codes(doc([t("t", "suelto")])), ["nesting.not-allowed"]);
    assert.deepEqual(codes(doc([{ id: "g", type: "Grid", children: [t("t", "x")] }])), ["nesting.not-allowed"]);
    assert.deepEqual(
      codes(
        doc([
          { id: "a", type: "Paragraph" },
          { id: "a", type: "Paragraph" },
        ]),
      ),
      ["node.duplicate-id"],
    );
    assert.deepEqual(codes(doc([{ id: "i", type: "Image", props: { src: "/a.png" } }])), ["a11y.alt"]);
    assert.deepEqual(codes(doc([{ id: "c", type: "CardHeader", slots: {} }])), ["nesting.required", "a11y.text"]);
    assert.deepEqual(codes(doc([{ id: "c", type: "Calendar", preset: "nope" }])), ["node.preset"]);
    assert.deepEqual(codes(doc([{ id: "c", type: "Card", slots: { footer: [{ id: "p", type: "Paragraph" }] } }])), [
      "nesting.unknown-slot",
    ]);
    assert.deepEqual(codes({ ...doc([]), schemaVersion: 7 }), ["document.version"]);
    assert.deepEqual(codes({ format: "zuix.page", schemaVersion: 1 }), ["document.shape"]);
  });

  test("avisos de títulos: un solo h1 y sin saltos", () => {
    const r = validateDocument(
      doc([
        { id: "a", type: "Heading", props: { level: 1 }, children: [t("t1", "A")] },
        { id: "b", type: "Heading", props: { level: 3 }, children: [t("t2", "B")] },
        { id: "c", type: "Heading", props: { level: 1 }, children: [t("t3", "C")] },
      ]),
      catalog,
    );
    assert.ok(r.valid);
    assert.deepEqual(
      r.warnings.map((w) => w.code),
      ["a11y.heading-order", "a11y.multiple-h1"],
    );
  });

  test("la forma da el error de la variante más cercana", () => {
    const r = validateDocument(doc([{ id: "p", type: "Paragraph", children: [t("1x", "A")] }]), catalog);
    assert.equal(r.errors[0]?.pointer, "/body/0/children/0/id");
  });

  test("propiedad: no lanza con cualquier entrada", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const r = validateDocument(value, catalog);
        assert.equal(typeof r.valid, "boolean");
        assert.ok(r.valid === false || (value as PageDocument).format === "zuix.page");
      }),
    );
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            type: fc.oneof(fc.constantFrom("Button", "Paragraph", "#text", "Grid"), fc.string()),
            props: fc.dictionary(fc.string(), fc.jsonValue()),
          }),
        ),
        (body) => {
          validateDocument(doc(body as PageNode[]), catalog);
        },
      ),
    );
  });

  test("propiedad: los documentos del conector son válidos", () => {
    fc.assert(fc.property(coreDoc, (d) => assert.deepEqual(validateDocument(d, catalog).errors, [])));
  });
});

describe("migraciones", () => {
  test("de la forma suelta (0) a la 1", () => {
    const r = migrateDocument([
      { type: "Heading", props: { level: 1 }, children: ["Hola"] },
      { type: "Paragraph", children: ["Texto ", { type: "InlineText", props: { tag: "strong" }, children: ["fuerte"] }] },
    ]);
    assert.equal(r.from, 0);
    assert.deepEqual(r.applied, ["0→1"]);
    assert.equal(r.document.schemaVersion, 1);
    assert.ok(validateDocument(r.document, catalog).valid);
    assert.equal(textOf(r.document.body[1] as PageNode), "Texto fuerte");
    const wrapped = migrateDocument({ title: "T", lang: "es", body: [{ type: "Paragraph", children: ["x"] }] });
    assert.equal(wrapped.document.title, "T");
    assert.equal(wrapped.document.lang, "es");
  });

  test("un documento actual vuelve tal cual; uno del futuro lanza", () => {
    const d = createDocument({ body: [{ id: "a", type: "Paragraph", children: [t("b", "x")] }] });
    assert.equal(migrateDocument(d).document, d);
    assert.deepEqual(migrateDocument(d).applied, []);
    assert.throws(() => migrateDocument({ ...d, schemaVersion: 99 }), /actualiza el paquete/);
    assert.throws(() => versionOf({ schemaVersion: -1 }), /no válido/);
    assert.throws(() => migrateDocument([{ props: {} }]), /sin tipo/);
  });

  test("propiedad: la migración es determinista y da documentos con forma válida", () => {
    const loose: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
      node: fc.oneof(
        { depthSize: "small", withCrossShrink: true },
        words,
        fc.record({
          type: fc.constantFrom("Paragraph", "Section", "InlineText", "Heading"),
          children: fc.array(tie("node"), { maxLength: 3 }),
        }),
      ),
    })).node;
    fc.assert(
      fc.property(fc.array(loose, { maxLength: 5 }), (body) => {
        const a = migrateDocument(body).document;
        assert.deepEqual(migrateDocument(body).document, a);
        assert.deepEqual(validateSchema(a, DOCUMENT_JSON_SCHEMA), []);
        const ids = new Set<string>();
        walk(a.body, (n) => {
          assert.ok(!ids.has(n.id));
          ids.add(n.id);
        });
      }),
    );
  });
});

describe("HTML", () => {
  test("bloques del contrato y escapado", () => {
    const html = toHTML(
      doc([
        { id: "b", type: "Button", props: { variant: "primary", icon: "plus" }, children: [t("t", 'New <b>project</b> & "más"')] },
        { id: "l", type: "Link", props: { href: "javascript:alert(1)" }, children: [t("u", "x")] },
        { id: "a", type: "Anchor", props: { href: " JaVa\tScRiPt:alert(1)" }, children: [t("v", "y")] },
        { id: "i", type: "Image", props: { src: "data:text/html,<script>", alt: '"><script>' } },
      ]),
    );
    assert.match(
      html,
      /<button type="button" class="z-btn z-btn--primary" data-size="md"><z-icon name="plus" size="16"><\/z-icon>New &lt;b&gt;project&lt;\/b&gt; &amp; "más"<\/button>/,
    );
    assert.doesNotMatch(html, /javascript|<script|data:text/i);
    assert.match(html, /<a class="z-link z-link--inline">x<\/a>/);
    assert.match(html, /alt="&quot;&gt;&lt;script&gt;"/);
  });

  test("estilo limitado a tokens, como variables", () => {
    const d = doc([
      {
        id: "p",
        type: "Paragraph",
        style: { padding: "space-4", background: "surface-2", textAlign: "center", color: "x;}" },
        children: [t("t", "x")],
      },
    ]);
    assert.equal(toHTML(d, { catalog }), '<p style="padding: var(--z-space-4); background: var(--z-surface-2); text-align: center">x</p>');
    assert.match(toHTML(d, { ids: true }), /data-z-node="p"/);
  });

  test("bloques preset y sin contrato", () => {
    const cal = catalog.blocks.find((b) => b.type === "Calendar");
    const preset = cal?.presets[0];
    assert.ok(preset?.html);
    assert.equal(toHTML(doc([{ id: "c", type: "Calendar", preset: preset.id }]), { catalog }), preset.html);
    assert.throws(() => toHTML(doc([{ id: "c", type: "Calendar", preset: preset.id }])), /no existe en el catálogo/);
    const reactOnly = catalog.blocks.find((b) => b.html === "none");
    assert.throws(() => toHTML(doc([{ id: "r", type: reactOnly?.type ?? "" }]), { catalog }), /toReact/);
    assert.equal(toTrustedHTML(doc([{ id: "p", type: "Paragraph", children: [t("t", "x")] }])), "<p>x</p>");
  });

  test("propiedad: el texto hostil nunca sale como marcado", () => {
    fc.assert(
      fc.property(hostile, hostile, (text, href) => {
        const html = toHTML(
          doc([{ id: "p", type: "Paragraph", children: [{ id: "a", type: "Anchor", props: { href }, children: [t("t", text)] }] }]),
        );
        const body = html.replace(/^<p><a(?: href="[^"]*")?>/, "").replace(/<\/a><\/p>$/, "");
        assert.doesNotMatch(body, /[<>]/);
        assert.doesNotMatch(html, /href="\s*javascript:/i);
      }),
    );
  });

  test("propiedad: documento → HTML → documento conserva el contenido", () => {
    fc.assert(
      fc.property(coreDoc, (d) => {
        const back = fromHTML(toHTML(d));
        assert.deepEqual(back.skipped, []);
        assert.deepEqual(strip(back.document.body), strip(d.body));
      }),
    );
  });

  test("no depende de la configuración regional ni de la zona horaria", () => {
    const script = `import { readFileSync } from "node:fs"; import { toHTML } from "./zui/src/editor/index.ts";
const c = JSON.parse(readFileSync("zui/editor/catalog.json", "utf8"));
const out = c.blocks.flatMap((b) => b.presets.filter((p) => p.node && b.html === "template" && !b.parents).map((p) => toHTML({ format: "zuix.page", schemaVersion: 1, body: [p.node] }, { catalog: c })));
process.stdout.write(out.join("\\n"));`;
    const run = (env: Record<string, string>) =>
      spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
        encoding: "utf8",
        env: { ...process.env, ...env },
      }).stdout;
    const a = run({ LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8", TZ: "UTC" });
    const b = run({ LANG: "de_DE.UTF-8", LC_ALL: "de_DE.UTF-8", TZ: "Asia/Tokyo" });
    assert.ok(a.length > 1000);
    assert.equal(a, b);
  });

  test("safeUrl", () => {
    for (const bad of [
      "javascript:alert(1)",
      " javascript:x",
      "java\nscript:x",
      "JAVASCRIPT:x",
      "vbscript:x",
      "data:text/html,x",
      "//evil.example",
      "\\\\evil",
    ])
      assert.equal(safeUrl(bad), undefined, bad);
    for (const ok of ["/a", "a/b", "#x", "?q=1", "https://x.dev", "http://x.dev", "mailto:a@b.c", "tel:+34"]) assert.equal(safeUrl(ok), ok);
    assert.equal(safeUrl("data:image/png;base64,AAAA", "image"), "data:image/png;base64,AAAA");
    assert.equal(safeUrl("data:image/svg+xml;base64,AAAA", "image"), undefined);
    assert.equal(safeUrl(3), undefined);
  });
});

describe("DOM y React", () => {
  test("toDOM da el mismo marcado que toHTML", () => {
    for (const b of catalog.blocks.filter((x) => x.html === "template" && !x.parents)) {
      for (const p of b.presets) {
        const d = doc([p.node as PageNode]);
        const frag = toDOM(d, document, { catalog });
        const div = document.createElement("div");
        div.append(frag);
        assert.equal(
          div.innerHTML
            .replace(/ ([a-z-]+)=""/g, " $1")
            .replace(/style="([^"]*)"/g, (_, s: string) => `style="${s.replace(/;\s*$/, "").replace(/;\s*/g, "; ")}"`),
          toHTML(d, { catalog }),
          `${b.type}/${p.id}`,
        );
      }
    }
  });

  test("toReact: el marcado de servidor coincide con toHTML; con componentes usa el binding", async () => {
    const norm = (s: string) =>
      s
        .replace(/\s*\/>/g, ">")
        .replace(/ ([a-z-]+)=""/g, " $1")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/style="([^"]*)"/g, (_, x: string) => `style="${x.replace(/\s*([:;])\s*/g, "$1")}"`);
    for (const b of catalog.blocks.filter((x) => x.html === "template" && !x.parents)) {
      for (const p of b.presets) {
        const d = doc([p.node as PageNode]);
        assert.equal(norm(renderToStaticMarkup(toReact(d, { catalog }))), norm(toHTML(d, { catalog })), `${b.type}/${p.id}`);
      }
    }
    const zui = await import("../../zui/src/index.ts");
    const d = doc([{ id: "b", type: "Button", props: { variant: "primary" }, style: { margin: "space-2" }, children: [t("t", "Go")] }]);
    const html = renderToStaticMarkup(toReact(d, { catalog, components: zui as unknown as Record<string, unknown> }));
    assert.match(html, /class="z-btn z-btn--primary"/);
    assert.match(html, /margin:var\(--z-space-2\)/);
    assert.throws(() => toReact(doc([{ id: "r", type: "TabPanel" }]), { catalog }), /sin componente/);
    void React;
  });
});

describe("árbol e historial", () => {
  const base = () =>
    doc([
      {
        id: "s",
        type: "Section",
        children: [
          { id: "a", type: "Paragraph", children: [t("at", "A")] },
          { id: "b", type: "Paragraph", children: [t("bt", "B")] },
        ],
      },
      { id: "c", type: "Paragraph", children: [t("ct", "C")] },
    ]);

  test("insertar, mover, quitar, props, estilo y texto", () => {
    const original = base();
    const snapshot = JSON.stringify(original);
    insertNode(original, { id: "top", type: "Paragraph" }, { parent: null, index: 0 });
    moveNode(original, "c", { parent: null, index: 0 });
    removeNode(original, "c");
    assert.equal(JSON.stringify(original), snapshot, "las operaciones no deben mutar el documento");
    let d = insertNode(base(), { id: "n", type: "Paragraph", children: [t("nt", "N")] }, { parent: "s", index: 1 });
    assert.deepEqual(pathTo(d, "n"), ["s", "n"]);
    assert.throws(() => insertNode(d, { id: "a", type: "Paragraph" }, { parent: null, index: 0 }), /ya existe/);
    d = moveNode(d, "a", { parent: "s", index: 3 });
    assert.deepEqual(
      (findNode(d, "s") as ElementNode).children?.map((n) => n.id),
      ["n", "b", "a"],
    );
    assert.throws(() => moveNode(d, "s", { parent: "a", index: 0 }), /dentro de sí mismo/);
    d = moveNode(d, "c", { parent: "s", index: 0 });
    assert.equal(d.body.length, 1);
    d = updateProps(d, "c", { foo: 1 });
    d = updateProps(d, "c", { foo: undefined });
    assert.equal((findNode(d, "c") as ElementNode).props, undefined);
    d = updateStyle(d, "c", { padding: "space-2" });
    assert.deepEqual((findNode(d, "c") as ElementNode).style, { padding: "space-2" });
    d = updateText(d, "ct", "Nuevo");
    assert.equal(textOf(findNode(d, "c") as PageNode), "Nuevo");
    assert.throws(() => updateText(d, "c", "x"), /no es un nodo de texto/);
    assert.equal(removeNode(d, "zz"), d);
    d = removeNode(d, "s");
    assert.equal(d.body.length, 0);
    const copy = withNewIds(base().body[0] as PageNode, idGenerator("k"));
    assert.deepEqual(strip([copy]), strip([base().body[0] as PageNode]));
    assert.equal(copy.id, "k0");
  });

  test("propiedad: mover conserva los nodos; deshacer vuelve al estado exacto", () => {
    fc.assert(
      fc.property(coreDoc, fc.nat(), fc.nat(), (d, from, to) => {
        const before = JSON.stringify(d);
        const ids: string[] = [];
        walk(d.body, (n) => {
          if (n.type !== "#text") ids.push(n.id);
        });
        const id = ids[from % ids.length] as string;
        const undo = createUndoStack<PageDocument>({ merge: 0 });
        let next = d;
        try {
          next = moveNode(d, id, { parent: null, index: to % (d.body.length + 1) });
          undo.record(d);
        } catch {
          return;
        }
        const count = (x: PageDocument) => {
          let n = 0;
          walk(x.body, () => n++);
          return n;
        };
        assert.equal(count(next), count(d));
        assert.equal(JSON.stringify(d), before, "la operación cambió el documento de partida");
        assert.equal(undo.undo(next), d);
      }),
    );
  });
});

describe("protocolo", () => {
  test("sobres y orígenes", () => {
    assert.equal(envelopeProblem(envelope("load", { document: doc([]) }), "editor"), null);
    assert.match(envelopeProblem({ ...envelope("load", {}), version: 2 }, "editor") ?? "", /versión/);
    assert.match(envelopeProblem(envelope("ready", {}), "editor") ?? "", /desconocido/);
    assert.match(envelopeProblem("hola", "editor") ?? "", /objeto/);
    assert.match(envelopeProblem({ ...envelope("load", {}), id: 1.5 }, "editor") ?? "", /id/);
    const allowed = ["https://editor.example.com"];
    assert.ok(originAllowed("https://editor.example.com", allowed));
    assert.ok(originAllowed("https://editor.example.com", ["https://editor.example.com:443/path"]));
    for (const bad of [
      "null",
      "",
      "https://editor.example.com.evil.dev",
      "http://editor.example.com",
      "https://sub.editor.example.com",
      "https://editor.example.com:8443",
    ])
      assert.equal(originAllowed(bad, allowed), false, bad);
    assert.equal(originAllowed("https://a.dev", ["no es una url"]), false);
  });

  test("accepts", () => {
    assert.ok(accepts({ text: true }, { type: "#text", categories: [] }));
    assert.ok(!accepts(undefined, { type: "Button", categories: ["flow"] }));
    assert.ok(accepts({ types: ["ListItem"] }, { type: "ListItem", categories: [] }));
  });
});

describe("marca", () => {
  test("la marca de serie pasa el contraste de tokens", () => {
    for (const name of catalog.tokens.brands) assert.ok(checkContrast(catalog.tokens.brandFiles[name] as never, catalog.tokens).ok, name);
  });

  test("leer, escribir con tipo y rango, CSS en vivo, contraste y exportar", () => {
    const brand = createBrandEditor(catalog.tokens);
    assert.ok(brand.get("accent", "dark"));
    assert.match(brand.resolve("accent-text", "dark") ?? "", /color-mix/);
    assert.equal(brand.spec("space-4")?.type, "length");
    assert.deepEqual(brand.set("accent", "#3366ff", "dark"), []);
    assert.equal(brand.cssVariables("dark").accent, "#3366ff");
    assert.match(brand.set("accent", "not-a-color", "dark")[0]?.message ?? "", /color/);
    assert.match(brand.set("space-4", "9999px")[0]?.message ?? "", /como mucho 256/);
    assert.match(brand.set("accent", "red; background: url(x)", "dark")[0]?.message ?? "", /caracteres/);
    assert.match(brand.set("nope", "1px")[0]?.message ?? "", /no existe/);
    assert.deepEqual(brand.set("space-4", "18px"), []);
    assert.equal(brand.cssVariables("light")["space-4"], "18px");
    assert.deepEqual(brand.set("fg-on-accent", "{accent}"), []);
    assert.equal(brand.cssVariables("dark")["fg-on-accent"], "var(--z-accent)");
    const report = brand.contrast();
    assert.equal(report.ok, false);
    assert.ok(report.failures.some((f) => f.what.startsWith("fg-on-accent sobre")));
    brand.reset("fg-on-accent");
    // Un acento oscuro sobre el tema oscuro no llega a 3:1 como indicador: lo dice la misma medida que pnpm tokens.
    assert.ok(brand.contrast().failures.some((f) => f.what.startsWith("accent (no texto)")));
    brand.reset("accent");
    assert.ok(brand.contrast().ok);
    assert.deepEqual(brand.set("accent", "#3366ff", "dark"), []);
    const file = brand.export();
    assert.equal(file.themes.dark.accent, "#3366ff");
    assert.equal(file.scale?.["space-4"], "18px");
    assert.throws(() => createBrandEditor(catalog.tokens, "nope"), /no existe la marca/);
  });
});
