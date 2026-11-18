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
  test("un valor que no se puede convertir a texto no lanza: queda vacío", () => {
    const svg = iconSvg("t-plain", { label: Object.create(null), className: { toString: [] } });
    assert.match(svg, /role="img" aria-label="" /);
    assert.match(svg, /class="z-icon "/);
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
  test("size: solo un número o una longitud CSS; lo demás vale 16", () => {
    const width = (size) => /width="([^"]*)" height="\1"/.exec(iconSvg("t-plain", { size }))?.[1];
    for (const ok of ["0", "24", "1.5", ".5", "1.5em", "100%", "2rem", "10vmin", " 20px "]) assert.equal(width(ok), ok.trim(), ok);
    assert.equal(width(0), "0");
    assert.equal(width(12.5), "12.5");
    for (const bad of [
      "",
      " ",
      "1.",
      ".",
      "1..2",
      "-1",
      "+1",
      "1e3",
      "1 px",
      "12pxx",
      "px",
      "calc(1px)",
      "var(--x)",
      '16" onload="alert(1)',
      "16'",
      "16>",
      "1\n2",
      "１６",
      "9".repeat(33),
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      null,
      true,
      {},
      [],
      ["24"],
      { toString: () => '"><script>' },
    ])
      assert.equal(width(bad), "16", String(bad));
  });
  test("size hostil y largo: tiempo lineal, sin retroceso polinómico", () => {
    // Con /^\d*\.?\d+(unidad)?$/ una cadena de cifras seguida de un carácter inválido costaba O(n²). El tope de
    // longitud la descarta antes de evaluar la expresión; estas entradas tardarían minutos si no fuera así.
    const inputs = [
      "9".repeat(1_000_000),
      `${"9".repeat(1_000_000)}!`,
      `${"9".repeat(500_000)}.${"9".repeat(500_000)}x`,
      " ".repeat(1_000_000),
    ];
    const start = performance.now();
    for (const size of inputs) assert.match(iconSvg("t-plain", { size }), /width="16" height="16"/);
    assert.ok(performance.now() - start < 1000, `tardó ${Math.round(performance.now() - start)} ms`);
  });
  test("nombre, label y className largos y hostiles: tiempo lineal y nada sin escapar", () => {
    const long = `${"\"><svg onload=alert(1)>&'".repeat(50_000)}`;
    const start = performance.now();
    const svg = iconSvg(long, { label: long, className: long });
    assert.ok(performance.now() - start < 2000, `tardó ${Math.round(performance.now() - start)} ms`);
    assert.equal(svg.match(/</g).length, 2, "solo <svg y </svg>: el nombre no está registrado y no hay trazados");
    assert.equal(svg.match(/>/g).length, 2);
    assert.doesNotMatch(svg, /'/);
    // Las únicas comillas dobles son las que delimitan los once atributos de <svg>.
    assert.equal(svg.match(/"/g).length, 22);
  });
  test("comillas simples y valores que no son cadena (JavaScript sin tipos) se escapan sin lanzar", () => {
    assert.match(iconSvg("t-plain", { label: "L'Hôpital" }), /aria-label="L&#39;Hôpital"/);
    assert.match(iconSvg("t-plain", { label: 7, className: 8 }), /aria-label="7".* class="z-icon 8"/);
    assert.match(iconSvg(null), /data-icon="null" data-variant="outline" class="z-icon"><\/svg>$/);
    assert.match(iconSvg("t-plain", { label: { toString: () => '"><b>' } }), /aria-label="&quot;&gt;&lt;b&gt;"/);
  });
  test("los trazados registrados también se escapan", () => {
    registerIcons([{ name: "t-hostile", o: ['M0 0"/><script>alert(1)</script><path d="'], s: ["E:M0 0'<"] }]);
    assert.match(iconSvg("t-hostile"), /<path d="M0 0&quot;\/&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;&lt;path d=&quot;"\/><\/svg>$/);
    assert.match(iconSvg("t-hostile", { variant: "solid" }), /d="M0 0&#39;&lt;"\/>/);
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
