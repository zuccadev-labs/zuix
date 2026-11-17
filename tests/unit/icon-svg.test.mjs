import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getIcon, registeredIconNames, registerIcons } from "../../zicon/src/registry.ts";
import { iconPaths, iconSvg } from "../../zicon/src/svg.ts";

registerIcons([
  { name: "t-plain", o: ["M1 1h2"], s: ["M2 2h4", "E:M3 3h6"] },
  { name: "t-empty", o: [], s: [] },
]);

describe("registro de iconos", () => {
  test("registrar es idempotente y el último gana", () => {
    registerIcons([{ name: "t-twice", o: ["M0 0"], s: [] }]);
    registerIcons([{ name: "t-twice", o: ["M9 9"], s: [] }]);
    assert.deepEqual(getIcon("t-twice")?.o, ["M9 9"]);
    assert.equal(registeredIconNames().filter((n) => n === "t-twice").length, 1);
  });
  test("los nombres salen ordenados", () => {
    const names = registeredIconNames();
    assert.deepEqual(names, [...names].sort());
  });
  test("un icono sin registrar no existe", () => {
    assert.equal(getIcon("no-such-icon"), undefined);
    assert.deepEqual(iconPaths("no-such-icon"), []);
  });
});

describe("iconSvg", () => {
  test("contrato por defecto: 16 px, outline, decorativo", () => {
    assert.equal(
      iconSvg("t-plain"),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" focusable="false" aria-hidden="true" data-icon="t-plain" data-variant="outline" class="z-icon"><path d="M1 1h2"/></svg>',
    );
  });
  test("solid y trazados evenodd (prefijo E:)", () => {
    const svg = iconSvg("t-plain", { variant: "solid" });
    assert.match(svg, /data-variant="solid"/);
    assert.match(svg, /<path d="M2 2h4"\/><path fill-rule="evenodd" clip-rule="evenodd" d="M3 3h6"\/>/);
    assert.doesNotMatch(svg, /E:/);
  });
  test("con label es una imagen con nombre accesible, sin aria-hidden", () => {
    const svg = iconSvg("t-plain", { label: "Cerrar" });
    assert.match(svg, /role="img" aria-label="Cerrar"/);
    assert.doesNotMatch(svg, /aria-hidden/);
  });
  test("label vacío es decorativo", () => {
    assert.match(iconSvg("t-plain", { label: "" }), /aria-hidden="true"/);
  });
  test("size admite número y longitud CSS", () => {
    assert.match(iconSvg("t-plain", { size: 24 }), /width="24" height="24"/);
    assert.match(iconSvg("t-plain", { size: "1.5em" }), /width="1.5em" height="1.5em"/);
  });
  test("escapa todo lo que interpola: un valor hostil no cierra atributos ni añade elementos", () => {
    const hostile = '"><script>alert(1)</script>&<img src=x onerror=alert(1)>';
    const svg = iconSvg(hostile, { label: hostile, className: hostile, size: hostile });
    assert.doesNotMatch(svg, /<script|<img/);
    assert.equal(svg.match(/<svg/g).length, 1);
    // Al analizarlo, cada atributo recupera el valor original y no aparece ningún atributo ni hijo de más.
    const host = document.createElement("div");
    host.innerHTML = svg;
    assert.equal(host.children.length, 1);
    const el = host.firstElementChild;
    assert.equal(el.children.length, 0);
    assert.equal(el.getAttribute("aria-label"), hostile);
    assert.equal(el.getAttribute("data-icon"), hostile);
    // `size` no se escapa: se valida. Lo que no es una longitud (número o número con unidad) cae al tamaño por defecto.
    assert.equal(el.getAttribute("width"), "16");
    assert.equal(el.getAttribute("class"), `z-icon ${hostile}`);
    assert.equal(el.getAttribute("onerror"), null);
  });
  test("una variante desconocida (JavaScript sin tipos) se reduce a outline", () => {
    assert.match(iconSvg("t-plain", { variant: '"><b>' }), /data-variant="outline"/);
  });
  test("no escapa dos veces una entidad ya escrita por quien llama", () => {
    assert.match(iconSvg("t-plain", { label: "A & B" }), /aria-label="A &amp; B"/);
  });
  test("icono inexistente o sin trazados: SVG vacío válido, sin lanzar", () => {
    assert.match(iconSvg("no-such-icon"), /class="z-icon"><\/svg>$/);
    assert.match(iconSvg("t-empty", { variant: "solid" }), /class="z-icon"><\/svg>$/);
  });
  test("className se añade tras z-icon", () => {
    assert.match(iconSvg("t-plain", { className: "a b" }), /class="z-icon a b"/);
  });
});
