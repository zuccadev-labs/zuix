// El modo sin framework en navegadores anteriores a su mínimo: las comprobaciones de existencia de la Popover API
// (zui/src/core/popover.ts y su copia en zout/src/popover.ts) y que los módulos de /dom se puedan cargar en Chromium 109, Firefox 115 y Safari 15.4.
import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build, transform } from "esbuild";
import * as zuiPopover from "../../zui/src/core/popover.ts";
import * as zoutPopover from "../../zout/src/popover.ts";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("modo sin framework en el objetivo", () => {
  test("los módulos de /dom no llevan sintaxis que el objetivo no lea al cargar", async () => {
    // Una aserción hacia atrás en un literal (Safari < 16.4) es un error de sintaxis: el módulo entero no carga.
    for (const entry of ["zui/src/dom/index.ts", "zout/src/dom/index.ts", "zicon/src/element.ts"]) {
      const r = await build({ entryPoints: [join(root, entry)], bundle: true, write: false, format: "esm", logLevel: "silent" });
      const code = r.outputFiles[0].text;
      assert.doesNotMatch(code, /\(\?<[!=]/, `${entry}: aserción hacia atrás`);
      await transform(code, { target: ["chrome109", "firefox115", "safari15.4"], format: "esm", logLevel: "silent" });
    }
  });

  for (const [label, { closestOpenPopover, popoverOpen, showPopover }] of [
    ["zui/src/core/popover.ts", zuiPopover],
    ["zout/src/popover.ts", zoutPopover],
  ])
    test(`${label}: sin Popover API no lanza; con el polyfill lee su clase`, () => {
      const syntax = () => {
        throw new SyntaxError("':popover-open' is not a valid selector");
      };
      const classes = new Set();
      const el = {
        matches: syntax,
        closest: (sel) => (sel === ":popover-open" ? syntax() : sel === ".\\:popover-open" && classes.has(":popover-open") ? el : null),
        classList: { contains: (c) => classes.has(c) },
      };
      assert.equal(popoverOpen(el), false);
      assert.equal(popoverOpen(null), false);
      assert.equal(closestOpenPopover(el), null);
      assert.equal(showPopover(el), false);
      classes.add(":popover-open");
      assert.equal(popoverOpen(el), true);
      assert.equal(closestOpenPopover(el), el);

      const calls = [];
      const native = { isConnected: true, matches: (s) => s === ":popover-open", closest: () => native, showPopover: (o) => calls.push(o) };
      assert.equal(popoverOpen(native), true);
      assert.equal(closestOpenPopover(native), native);
      const source = {};
      assert.equal(showPopover(native), true);
      assert.equal(showPopover(native, source), true);
      assert.deepEqual(calls, [undefined, { source }]);
      // Fuera del documento no se intenta: `showPopover` lanzaría («Element is not connected» en WebKit).
      const detached = { ...native, isConnected: false };
      assert.equal(showPopover(detached), false);
      assert.equal(calls.length, 2);
    });
});
