// zudocs/scripts: texto de los títulos (docs.mjs). Lo que llega de un documento no es de confianza: estas
// pruebas son las entradas hostiles.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { headings, stripTags } from "../../zudocs/scripts/docs.mjs";

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
