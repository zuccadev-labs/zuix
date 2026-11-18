// zudocs/scripts: lectura de una hoja de fuentes remota (font-sheet.mjs) y texto de los títulos (docs.mjs).
// Lo que llega de la red o de un documento no es de confianza: estas pruebas son las entradas hostiles.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { headings, stripTags } from "../../zudocs/scripts/docs.mjs";
import {
  cssComment,
  familySlug,
  fontFaceCss,
  fontFaces,
  fontFileName,
  isWoff2,
  MAX_FONT_BYTES,
  remoteUrl,
} from "../../zudocs/scripts/font-sheet.mjs";

const GOOGLE = `/* latin-ext */
@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/dmsans/v15/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5;
}
/* latin */
@font-face {
  font-family: 'DM Sans';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/dmsans/v15/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
/* cyrillic */
@font-face {
  font-family: 'DM Sans';
  src: url(https://fonts.gstatic.com/s/dmsans/v15/cyr.woff2) format('woff2');
}
`;

describe("font-sheet: remoteUrl", () => {
  test("solo https y sin credenciales", () => {
    assert.equal(remoteUrl("https://fonts.googleapis.com/css2?family=A").hostname, "fonts.googleapis.com");
    for (const bad of ["http://fonts.googleapis.com/css2", "file:///etc/passwd", "javascript:alert(1)", "//x.test/a", "fonts.css", ""])
      assert.throws(() => remoteUrl(bad), /Solo se descargan URL https|URL inválida/, bad);
    assert.throws(() => remoteUrl("https://user:secreto@x.test/a.css"), /credenciales/);
    assert.doesNotMatch(
      String(
        (() => {
          try {
            remoteUrl("https://user:secreto@x.test/a.css");
          } catch (e) {
            return e.message;
          }
        })(),
      ),
      /secreto/,
    );
  });
});

describe("font-sheet: fontFaces", () => {
  test("una hoja de Google Fonts: un bloque por subconjunto pedido, con sus descriptores", () => {
    const faces = fontFaces(GOOGLE, ["latin", "latin-ext"]);
    assert.deepEqual(
      faces.map((f) => [f.subset, f.family, f.src.href]),
      [
        ["latin-ext", "DM Sans", "https://fonts.gstatic.com/s/dmsans/v15/ext.woff2"],
        ["latin", "DM Sans", "https://fonts.gstatic.com/s/dmsans/v15/latin.woff2"],
      ],
    );
    assert.deepEqual(faces[1].descriptors, [
      ["font-family", "'DM Sans'"],
      ["font-style", "normal"],
      ["font-weight", "400 700"],
      ["font-display", "swap"],
      ["src", ""],
      ["unicode-range", "U+0000-00FF, U+0131"],
    ]);
  });
  test("sin comentario de subconjunto, o con un comentario que no lo es, el bloque entra", () => {
    const block = "@font-face { font-family: A; src: url('https://x.test/a.woff2'); }";
    assert.equal(fontFaces(block, ["latin"])[0].subset, undefined);
    assert.equal(fontFaces(`/* Licencia: OFL 1.1, (c) alguien */ ${block}`, ["latin"])[0].subset, undefined);
  });
  test("solo woff2 por https: ni http, ni data:, ni otros formatos, ni rutas relativas", () => {
    for (const src of [
      "url(http://x.test/a.woff2)",
      "url(https://x.test/a.ttf)",
      "url(data:font/woff2;base64,AAAA)",
      "url(../../a.woff2)",
      "url(file:///etc/passwd.woff2)",
      "local('Arial')",
      "url(https://user:pw@x.test/a.woff2)",
    ])
      assert.deepEqual(fontFaces(`@font-face { font-family: A; src: ${src}; }`, []), [], src);
    // Con varias fuentes en el descriptor, la primera que sirve.
    const [face] = fontFaces(
      "@font-face { font-family: A; src: local('A'), url(https://x.test/a.ttf), url(\"https://x.test/b.woff2?v=1\") format('woff2'); }",
      [],
    );
    assert.equal(face.src.href, "https://x.test/b.woff2?v=1");
  });
  test("hoja hostil: nada del texto remoto llega a la hoja local ni al nombre del archivo", () => {
    const sheet = `/* latin */
@font-face {
  font-family: '../../../../etc/cron.d/x';
  font-weight: 400; } body { background: url(https://evil.test/pixel) } @font-face { x: y;
  font-style: url(https://evil.test/track);
  font-display: swap</style><script>alert(1)</script>;
  behavior: url(https://evil.test/x.htc);
  src: url(https://x.test/a.woff2);
  src: url(https://evil.test/second.woff2);
  unicode-range: U+0000-00FF */ @import "https://evil.test/a.css";
}`;
    const faces = fontFaces(sheet, ["latin"]);
    assert.equal(faces.length, 1);
    const [face] = faces;
    assert.equal(face.src.href, "https://x.test/a.woff2");
    assert.deepEqual(
      face.descriptors.map(([name]) => name),
      ["src"],
    );
    const name = fontFileName(face, "0123456789abcdef");
    // El primer bloque se cierra antes de su `src` y se descarta; el segundo ya no tiene comentario de subconjunto.
    assert.equal(name, "fuente-all-01234567.woff2");
    const css = fontFaceCss(face, name);
    assert.equal(css, '@font-face {\n  src: url("./fuente-all-01234567.woff2") format("woff2");\n}\n');
  });
  test("el nombre del archivo no tiene separadores de ruta, puntos de más ni caracteres de control", () => {
    for (const family of [
      "../../x",
      "..\\..\\x",
      "/etc/passwd",
      "a\u0000b",
      "C:\\x",
      "Ñandú Sans",
      "",
      " ",
      "-",
      "a".repeat(500),
      "%2e%2e%2f",
      "con",
      "x.woff2/../y",
    ]) {
      const name = fontFileName({ family, subset: "latin" }, "deadbeefcafe");
      assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*-latin-deadbeef\.woff2$/, family);
      assert.ok(name.length < 70, family);
    }
    assert.equal(familySlug("DM Sans"), "dm-sans");
    assert.equal(fontFileName({ family: "JetBrains Mono" }, "4f27206c00"), "jetbrains-mono-all-4f27206c.woff2");
    assert.throws(() => fontFileName({ family: "A" }, "../../x"), /resumen inválido/);
  });
  test("un subconjunto con caracteres fuera de [\\w-] no clasifica el bloque", () => {
    const [face] = fontFaces("/* ../x */ @font-face { font-family: A; src: url(https://x.test/a.woff2); }", ["../x"]);
    assert.equal(face.subset, undefined);
  });
  test("una hoja larga y hostil se lee en tiempo lineal", () => {
    const inputs = [
      "/*".repeat(400_000),
      `${"/* a */ ".repeat(100_000)}${" ".repeat(400_000)}x`,
      `@font-face {${"a:b;".repeat(200_000)}`,
      `@font-face { src: ${"url(".repeat(200_000)}; }`,
    ];
    const start = performance.now();
    for (const sheet of inputs) assert.deepEqual(fontFaces(sheet, ["latin"]), []);
    assert.ok(performance.now() - start < 2000, `tardó ${Math.round(performance.now() - start)} ms`);
  });
});

describe("font-sheet: contenido y comentarios", () => {
  test("isWoff2 comprueba la firma y el tamaño", () => {
    const font = Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(100)]);
    assert.equal(isWoff2(font), true);
    assert.equal(isWoff2(Buffer.concat([Buffer.from("<html>"), Buffer.alloc(100)])), false);
    assert.equal(isWoff2(Buffer.from("wOF2")), false);
    assert.equal(isWoff2(Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(MAX_FONT_BYTES)])), false);
  });
  test("cssComment no deja cerrar el comentario", () => {
    assert.equal(cssComment("https://x.test/a*/ body{} /*\nb"), "https://x.test/a*%2F body{} /* b");
    assert.doesNotMatch(cssComment("*/".repeat(1000)), /\*\//);
  });
});

describe("docs: texto de los títulos", () => {
  test("stripTags quita etiquetas anidadas hasta que no queda ninguna", () => {
    assert.equal(stripTags("Uso de <code>Button</code>"), "Uso de Button");
    assert.equal(stripTags("<scr<b>ipt>alert(1)</scr</b>ipt>"), "alert(1)");
    assert.equal(stripTags("<<<a>b>c>d"), "d");
    assert.equal(stripTags("a < b"), "a < b");
    assert.doesNotMatch(stripTags(`${"<a".repeat(50_000)}${"<b>".repeat(50_000)}${">".repeat(50_000)}`), /<[^>]+>/);
  });
  test("el título de un encabezado sale sin etiquetas, también si venían partidas", () => {
    assert.deepEqual(
      headings("# Hola <Badge>nuevo</Badge>\n\n## <scr<i>ipt>x").map((h) => h.title),
      ["Hola nuevo", "x"],
    );
  });
});
