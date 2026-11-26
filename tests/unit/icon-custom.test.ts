// Iconos que aporta la aplicación: validación (nombre, caja, trazados, pinturas, imagen), extracción segura de un SVG
// dado como texto y dibujo con iconSvg/iconElement (caja propia, pintura por trazado, imagen a todo color).
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { defineIcon, parseSvgIcon, registerAppIcons, safeImageUrl, safePaint } from "../../zicon/src/custom.ts";
import { getIcon } from "../../zicon/src/registry.ts";
import { iconElement, iconFrame, iconPaths, iconSvg } from "../../zicon/src/svg.ts";

fc.configureGlobal({ seed: 20261125, numRuns: 150 });

describe("iconos de la aplicación", () => {
  test("defineIcon valida nombre, caja, trazados e imagen", () => {
    assert.deepEqual(defineIcon({ name: "acme-logo", paths: ["M0 0h24v24H0z"] }), {
      name: "acme-logo",
      o: ["M0 0h24v24H0z"],
      s: ["M0 0h24v24H0z"],
    });
    assert.deepEqual(defineIcon({ name: "acme-mark", viewBox: "0,0,32,32", paths: [{ d: "M1 1h30", fill: "#f00", opacity: 2 }] }), {
      name: "acme-mark",
      o: [{ d: "M1 1h30", fill: "#f00", opacity: 1 }],
      s: [{ d: "M1 1h30", fill: "#f00", opacity: 1 }],
      viewBox: "0 0 32 32",
    });
    assert.equal(defineIcon({ name: "acme-photo", image: "data:image/png;base64,AAAA" }).image, "data:image/png;base64,AAAA");
    const bad = (src: Parameters<typeof defineIcon>[0], problem: string) =>
      assert.throws(() => defineIcon(src), new RegExp(`\\(${problem}\\)`));
    bad({ name: "Acme Logo", paths: ["M0 0"] }, "name");
    bad({ name: "trash", paths: ["M0 0"] }, "reserved");
    bad({ name: "acme-a", viewBox: "0 0 0 24", paths: ["M0 0"] }, "viewbox");
    bad({ name: "acme-b", viewBox: "0 0 a b", paths: ["M0 0"] }, "viewbox");
    bad({ name: "acme-c", paths: ['M0 0"/><script>'] }, "path");
    bad({ name: "acme-d", paths: [{ d: "url(x)" }] }, "path");
    bad({ name: "acme-e", image: "javascript:alert(1)" }, "image");
    bad({ name: "acme-f" }, "empty");
    // Una pintura insegura se descarta, no rompe el icono.
    assert.deepEqual(defineIcon({ name: "acme-g", paths: [{ d: "M0 0", fill: "url(#x)" }] }).o, [{ d: "M0 0" }]);
  });
  test("URL de imagen y pinturas seguras", () => {
    assert.equal(safeImageUrl("https://cdn.example/logo.png"), "https://cdn.example/logo.png");
    assert.equal(safeImageUrl("/logos/a.svg"), "/logos/a.svg");
    assert.equal(safeImageUrl("data:image/svg+xml;utf8,<svg/>"), "data:image/svg+xml;utf8,<svg/>");
    assert.equal(safeImageUrl("data:text/html,<b>"), undefined);
    assert.equal(safeImageUrl("JavaScript:alert(1)"), undefined);
    assert.equal(safeImageUrl("//evil.example/x.png"), undefined);
    assert.equal(safeImageUrl("ftp://x/y.png"), undefined);
    assert.equal(safeImageUrl("a\u0000b"), undefined);
    assert.equal(safeImageUrl(42), undefined);
    assert.equal(safePaint("currentColor"), "currentColor");
    assert.equal(safePaint("var(--brand)"), "var(--brand)");
    assert.equal(safePaint("rgb(1 2 3 / 50%)"), "rgb(1 2 3 / 50%)");
    assert.equal(safePaint("url(#g)"), undefined);
    assert.equal(safePaint("red;x"), undefined);
    assert.equal(safePaint(null), undefined);
  });
  test("parseSvgIcon extrae formas sin interpretar el marcado", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><script>alert(1)</script>
      <path d="M0 0L10 10" fill="#123456" fill-rule="evenodd" opacity=".5"/>
      <circle cx="5" cy="5" r="2"/><ellipse cx="5" cy="5" rx="3" ry="1"/>
      <rect x="1" y="1" width="4" height="2"/><rect x="0" y="0" width="10" height="6" rx="2"/>
      <polygon points="0,0 4,0 4,4"/><polyline points="0 0 1 1 2 0"/><rect width="0" height="1"/><circle r="0"/>
      <path d="M0 0 url(x)"/><use href="#x"/></svg>`;
    const out = parseSvgIcon(svg);
    assert.equal(out.viewBox, "0 0 48 32");
    assert.equal(out.paths.length, 7);
    assert.deepEqual(out.paths[0], { d: "M0 0L10 10", fill: "#123456", opacity: 0.5, evenodd: true });
    assert.match(out.paths[1]!.d, /^M3 5a2 2 0 1 0 4 0/);
    assert.match(out.paths[3]!.d, /^M1 1h4v2h-4Z$/);
    assert.match(out.paths[4]!.d, /a2 2 0 0 1/);
    assert.equal(out.paths[5]!.d, "M0 0L4 0L4 4Z");
    assert.equal(out.paths[6]!.d, "M0 0L1 1L2 0");
    assert.equal(parseSvgIcon('<svg viewBox="0 0 16 16"></svg>').viewBox, "0 0 16 16");
    assert.deepEqual(parseSvgIcon(undefined as unknown as string), { viewBox: "0 0 24 24", paths: [] });
    const def = defineIcon({ name: "acme-svg", svg });
    assert.equal(def.viewBox, "0 0 48 32");
  });
  test("se dibuja con su caja, su pintura y su imagen, sin marcado inyectado", () => {
    registerAppIcons([
      { name: "acme-two", viewBox: "0 0 32 32", paths: [{ d: "M0 0h32", fill: "#ff0000" }, "E:M1 1h2"] },
      { name: "acme-img", viewBox: "0 0 64 32", image: "https://cdn.example/a.png" },
    ]);
    assert.ok(getIcon("acme-two"));
    assert.deepEqual(iconPaths("acme-two"), ["M0 0h32", "E:M1 1h2"]);
    assert.deepEqual(iconFrame("acme-img"), { viewBox: "0 0 64 32", image: "https://cdn.example/a.png", width: 64, height: 32 });
    const svg = iconSvg("acme-two", { size: 20 });
    assert.match(svg, /viewBox="0 0 32 32"/);
    assert.match(svg, /<path fill="#ff0000" d="M0 0h32"\/><path fill-rule="evenodd" clip-rule="evenodd" d="M1 1h2"\/>/);
    assert.match(
      iconSvg("acme-img"),
      /<image href="https:\/\/cdn\.example\/a\.png" x="0" y="0" width="64" height="32" preserveAspectRatio="xMidYMid meet"\/>/,
    );
    const el = iconElement("acme-img", { label: "Acme" });
    assert.equal(el.getAttribute("viewBox"), "0 0 64 32");
    assert.equal(el.querySelector("image")?.getAttribute("href"), "https://cdn.example/a.png");
    assert.equal(el.getAttribute("role"), "img");
    const two = iconElement("acme-two");
    assert.equal(two.querySelectorAll("path").length, 2);
    assert.equal(two.querySelector("path")?.getAttribute("fill"), "#ff0000");
  });
  test("propiedad: ningún texto arbitrario sale como trazado fuera del alfabeto de trazado", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (d) => {
        try {
          const def = defineIcon({ name: "acme-prop", paths: [d] });
          assert.match(String(def.o[0]).replace(/^E:/, ""), /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/);
        } catch (e) {
          assert.ok(e instanceof TypeError);
        }
      }),
    );
  });
});
