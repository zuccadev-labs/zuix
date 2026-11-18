// Herramientas del repositorio: versionado, reescritura de especificadores del build, auditoría de estilo y la
// regla de "use client". Se prueban las funciones que exportan; los scripts completos, como procesos.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { auditSource, localNames, strip } from "../../tools/audit.mjs";
import { completeSpecifiers } from "../../tools/build.mjs";
import { checkBarrels, declaredNames, exportedNames, importedNames } from "../../tools/check-barrels.mjs";
import { checkUseClient, clientReasons, hasUseClient } from "../../tools/use-client.mjs";
import { closeUnreleased, compareVersions, nextVersion, parseVersion, setPackageVersion, today } from "../../tools/version.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const run = (script, ...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });

describe("tools/version.mjs", () => {
  test("parseVersion: semver estricto", () => {
    assert.deepEqual(parseVersion("1.2.3"), { major: 1, minor: 2, patch: 3, pre: [] });
    assert.deepEqual(parseVersion("0.2.0-rc.1"), { major: 0, minor: 2, patch: 0, pre: ["rc", "1"] });
    for (const bad of ["1.2", "v1.2.3", "1.2.3.4", "01.2.3", "1.2.3-", "1.2.3+build", "", "1.2.x", " 1.2.3"])
      assert.equal(parseVersion(bad), null, bad);
  });
  test("compareVersions: precedencia de semver § 11", () => {
    const ordered = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "1.0.1",
      "1.1.0",
      "2.0.0",
    ];
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(compareVersions(ordered[i - 1], ordered[i]) < 0, `${ordered[i - 1]} < ${ordered[i]}`);
      assert.ok(compareVersions(ordered[i], ordered[i - 1]) > 0);
    }
    assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
    assert.ok(compareVersions("0.10.0", "0.9.0") > 0, "numérico, no alfabético");
    assert.throws(() => compareVersions("1.2", "1.2.3"), /no válida/);
  });
  test("nextVersion: patch, minor y major", () => {
    assert.equal(nextVersion("0.1.0", "patch"), "0.1.1");
    assert.equal(nextVersion("0.1.9", "patch"), "0.1.10");
    assert.equal(nextVersion("0.1.5", "minor"), "0.2.0");
    assert.equal(nextVersion("0.9.5", "major"), "1.0.0");
  });
  test("nextVersion: desde un prerelease, la subida que ya lo cubre lo cierra", () => {
    assert.equal(nextVersion("0.2.0-rc.1", "patch"), "0.2.0");
    assert.equal(nextVersion("0.2.0-rc.1", "minor"), "0.2.0");
    assert.equal(nextVersion("0.2.1-rc.1", "minor"), "0.3.0");
    assert.equal(nextVersion("1.0.0-rc.1", "major"), "1.0.0");
    assert.equal(nextVersion("1.1.0-rc.1", "major"), "2.0.0");
  });
  test("nextVersion: versión exacta, solo hacia delante", () => {
    assert.equal(nextVersion("0.1.0", "0.2.0"), "0.2.0");
    assert.equal(nextVersion("0.1.0", "0.2.0-rc.1"), "0.2.0-rc.1");
    assert.equal(nextVersion("0.2.0-rc.1", "0.2.0"), "0.2.0");
    assert.throws(() => nextVersion("0.1.0", "0.1.0"), /ya es 0\.1\.0/);
    assert.throws(() => nextVersion("0.2.0", "0.1.9"), /anterior/);
    assert.throws(() => nextVersion("0.2.0", "0.2.0-rc.1"), /anterior/);
  });
  test("nextVersion: argumento no válido", () => {
    for (const bad of ["mayor", "1.2", "", "PATCH"]) assert.throws(() => nextVersion("0.1.0", bad), /uso:/, bad);
    assert.throws(() => nextVersion("cero", "patch"), /no es semver/);
  });

  const LOG = "# Changelog\n\n## [Sin publicar]\n\n### Añadido\n\n- Uno.\n- Dos.\n\n## [0.1.0] - 2026-01-01\n\n- Primera.\n";
  test("closeUnreleased: mueve el cuerpo bajo la versión y deja la sección vacía", () => {
    const { log, body } = closeUnreleased(LOG, "0.2.0", "2026-11-17");
    assert.equal(body, "### Añadido\n\n- Uno.\n- Dos.");
    assert.equal(
      log,
      "# Changelog\n\n## [Sin publicar]\n\n## [0.2.0] - 2026-11-17\n\n### Añadido\n\n- Uno.\n- Dos.\n\n## [0.1.0] - 2026-01-01\n\n- Primera.\n",
    );
  });
  test("closeUnreleased: sin cambios escribe la nota de alineación y devuelve cuerpo vacío", () => {
    const { log, body } = closeUnreleased("## [Sin publicar]\n\n## [0.1.0] - 2026-01-01\n", "0.2.0", "2026-11-17");
    assert.equal(body, "");
    assert.match(log, /## \[0\.2\.0\] - 2026-11-17\n\nSin cambios en este paquete\./);
  });
  test("closeUnreleased: sección al final del archivo, sin versiones anteriores", () => {
    const { log } = closeUnreleased("# C\n\n## [Sin publicar]\n\n- Uno.\n", "0.1.0", "2026-11-17");
    assert.equal(log, "# C\n\n## [Sin publicar]\n\n## [0.1.0] - 2026-11-17\n\n- Uno.\n");
  });
  test("closeUnreleased: conserva CRLF (checkout de Windows)", () => {
    const { log, body } = closeUnreleased(LOG.replace(/\n/g, "\r\n"), "0.2.0", "2026-11-17");
    assert.equal(body, "### Añadido\r\n\r\n- Uno.\r\n- Dos.");
    assert.equal(log.replace(/\r\n/g, "").includes("\n"), false, "no mezcla finales de línea");
    assert.equal(log.replace(/\r\n/g, "\n"), closeUnreleased(LOG, "0.2.0", "2026-11-17").log);
  });
  test("closeUnreleased: es idempotente frente a repetir la versión, y exige la sección", () => {
    const once = closeUnreleased(LOG, "0.2.0", "2026-11-17").log;
    assert.throws(() => closeUnreleased(once, "0.2.0", "2026-11-18"), /ya tiene una entrada \[0\.2\.0\]/);
    assert.throws(() => closeUnreleased("# Changelog\n", "0.2.0", "2026-11-17"), /Sin publicar/);
  });
  test("setPackageVersion: cambia solo el campo de primer nivel", () => {
    const raw =
      '{\n  "name": "x",\n  "version": "0.1.0",\n  "config": {\n    "version": "9.9.9"\n  },\n  "dependencies": { "y": "0.1.0" }\n}\n';
    assert.equal(setPackageVersion(raw, "0.2.0"), raw.replace('"version": "0.1.0"', '"version": "0.2.0"'));
  });
  test('setPackageVersion: un "version" anidado antes del de primer nivel no se toca', () => {
    const raw = '{\n  "config": {\n    "version": "9.9.9"\n  },\n  "version": "0.1.0"\n}\n';
    assert.equal(setPackageVersion(raw, "0.2.0"), raw.replace('"version": "0.1.0"', '"version": "0.2.0"'));
    assert.throws(() => setPackageVersion('{\n  "name": "x"\n}\n', "0.2.0"), /no se encontró/);
  });
  test("today: fecha local con ceros", () => {
    assert.equal(today(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  });
  test("el script: check pasa; argumentos inválidos fallan con el uso y sin escribir", () => {
    const check = run("tools/version.mjs", "check");
    assert.equal(check.status, 0, check.stderr);
    assert.match(check.stdout, /✓ versión \d+\.\d+\.\d+/);
    for (const args of [[], ["mayor"], ["patch", "--force"], ["patch", "minor"]]) {
      const r = run("tools/version.mjs", ...args);
      assert.equal(r.status, 1, args.join(" "));
      assert.match(r.stderr, /uso:/);
    }
  });
});

describe("tools/build.mjs: completeSpecifiers", () => {
  const files = new Set(["./core", "./dir/index", "../cx", "./index", "../index", "./a.b", "./types"]);
  const fix = (source) => completeSpecifiers(source, (spec) => files.has(spec));
  test("archivo y carpeta con index", () => {
    assert.equal(fix('import { a } from "./core";').code, 'import { a } from "./core.js";');
    assert.equal(fix("export * from './dir';").code, "export * from './dir/index.js';");
    assert.equal(fix('import { cx } from "../cx";').code, 'import { cx } from "../cx.js";');
  });
  test("import de efecto, import() dinámico y tipos import()", () => {
    assert.equal(fix('import "./core";').code, 'import "./core.js";');
    assert.equal(fix('const m = await import("./core");').code, 'const m = await import("./core.js");');
    assert.equal(fix('type T = import("./types").T;').code, 'type T = import("./types.js").T;');
    assert.equal(fix("export { x } from\n  './core';").code, "export { x } from\n  './core.js';");
  });
  test("'.' y '..' son el index de la carpeta", () => {
    assert.equal(fix('import { a } from ".";').code, 'import { a } from "./index.js";');
    assert.equal(fix('import { a } from "..";').code, 'import { a } from "../index.js";');
    assert.equal(fix('import { a } from "./dir/";').code, 'import { a } from "./dir/index.js";');
  });
  test("un nombre con punto no se confunde con una extensión", () => {
    assert.equal(fix('import x from "./a.b";').code, 'import x from "./a.b.js";');
  });
  test("lo que ya está completo o no es relativo no se toca", () => {
    for (const source of [
      'import a from "./core.js";',
      'import a from "./x.mjs";',
      'import d from "./data.json";',
      'import "./styles.css";',
      'import { useId } from "react";',
      'import x from "@zuccadev-labs/zuix-zicon/core";',
      'const s = "./core";',
      'import x from "node:fs";',
    ]) {
      const { code, unresolved } = fix(source);
      assert.equal(code, source);
      assert.deepEqual(unresolved, []);
    }
  });
  test("si existen archivo y carpeta con el mismo nombre gana el archivo, como en la resolución de Node", () => {
    const both = completeSpecifiers('import a from "./x";', (spec) => spec === "./x" || spec === "./x/index");
    assert.equal(both.code, 'import a from "./x.js";');
  });
  test("lo que no se resuelve se devuelve, sin tocar el texto", () => {
    const { code, unresolved } = fix('import a from "./nope";\nimport b from "./core";\nimport c from "../zzz";');
    assert.deepEqual(unresolved, ["./nope", "../zzz"]);
    assert.equal(code, 'import a from "./nope";\nimport b from "./core.js";\nimport c from "../zzz";');
  });
  test("varios en una línea y sin cambios en el resto del archivo", () => {
    const source = 'import a from "./core";import b from "./dir";\n//# sourceMappingURL=x.js.map\n';
    assert.equal(fix(source).code, 'import a from "./core.js";import b from "./dir/index.js";\n//# sourceMappingURL=x.js.map\n');
  });
});

describe("tools/audit.mjs", () => {
  const css = (source, extra = {}) => auditSource(source, { css: true, known: new Set(["accent", "fg"]), ...extra });
  test("colores literales: hex de 3, 4, 6 y 8 cifras", () => {
    assert.deepEqual(css("a{color:#fff}\nb{color:#ffff}\nc{color:#a1b2c3}\nd{color:#a1b2c3d4}").color, [1, 2, 3, 4]);
    // Un id o un ancla no son un color.
    assert.deepEqual(css("#header { margin: 0 }\na[href='#top'] { top: 0 }").color, []);
  });
  test("funciones de color de CSS Color 4, también oklch(), lab(), hwb() y color()", () => {
    const source = [
      "rgb(0 0 0)",
      "rgba(0,0,0,.5)",
      "hsl(0 0% 0%)",
      "hsla(0,0%,0%,1)",
      "hwb(0 0% 0%)",
      "lab(50% 0 0)",
      "lch(50% 0 0)",
      "oklab(0.5 0 0)",
      "oklch(0.5 0.1 200)",
      "color(display-p3 1 0 0)",
    ]
      .map((v) => `a { color: ${v}; }`)
      .join("\n");
    assert.deepEqual(css(source).color, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  test("una función cuyos canales vienen de tokens no es un literal", () => {
    assert.deepEqual(
      css(
        "a { color: rgb(var(--z-accent) / 50%); b: oklch(from var(--z-accent) l c h / 0.5); c: color-mix(in srgb, var(--z-accent) 50%, transparent); }",
      ).color,
      [],
    );
    assert.deepEqual(css("a { color: color-mix(in srgb, #ff0000 50%, var(--z-fg)); }").color, [1]);
  });
  test("en TypeScript color( es una función corriente; en CSS, un color", () => {
    assert.deepEqual(auditSource('if (text.startsWith("color(srgb")) color(1);').color, []);
    assert.deepEqual(auditSource('const c = "rgb(0, 0, 0)";').color, [1]);
  });
  test("los comentarios no cuentan y las líneas se conservan", () => {
    assert.deepEqual(css("/* #fff\n rgb(0 0 0) */\na { color: #000; } // #abc").color, [3]);
    assert.equal(strip("a /* b\nc */ d").split("\n").length, 2);
    // Una URL no es un comentario de línea.
    assert.match(strip('const u = "https://example.com/#fff";'), /example\.com/);
  });
  test("primitivos de marca y tokens inexistentes sin respaldo", () => {
    const r = css("a { color: var(--zp-blue-500); b: var(--z-accent); c: var(--z-nope); d: var(--z-nope2, 4px); e: var( --z-local ); }", {
      local: new Set(["local"]),
    });
    assert.deepEqual(r.prim, [1]);
    assert.deepEqual(r.token, ["1:nope"]);
  });
  test("localNames: variables --z-* declaradas en CSS y en style de React", () => {
    assert.deepEqual(localNames('.a { --z-card-pad: 4px; }\nconst s = { "--z-progress": "40%" };'), ["card-pad", "progress"]);
  });
  test("emojis como iconos, con las excepciones tipográficas", () => {
    assert.deepEqual(auditSource('const a = "🚀";\nconst b = "© ® ™ ↔";\nconst c = "✅";').emoji, [1, 3]);
  });
  test("style en línea: solo con propiedades de apariencia", () => {
    assert.deepEqual(
      auditSource(
        '<div style={{ color: "x" }} />\n<div style={{ width: w, gridTemplateColumns: cols }} />\n<div style={{ nested: { a: 1 }, borderRadius: 4 }} />',
      ).inline,
      [1, 3],
    );
  });
  test("colores con nombre solo como valor de una propiedad de color", () => {
    const r = css(
      "a { color: red; }\nb { background: var(--z-accent, white); }\n.red { margin: 0; }\nc { border: 1px solid Black; }\nd { transition: color 1s; color: currentColor; background: transparent; }",
    );
    assert.deepEqual(r.named, [1, 4]);
  });
  test("!important sin justificar y z-index literal", () => {
    const r = css(
      "a { color: var(--z-fg) !important; b: x ! important; }\nb { z-index: 10; }\nc { z-index: var(--z-layer-popup); z-index: auto; z-index: calc(var(--z-layer-raised) + 1); }",
    );
    assert.deepEqual(r.important, [1, 1]);
    assert.deepEqual(r.justified, []);
    assert.deepEqual(r.zindex, [2]);
  });
  test("!important justificado: comentario que lo nombra en la regla, antes de ella o antes de su bloque condicional", () => {
    const inside = css("a {\n  /* !important: gana al display del componente. */\n  display: none !important;\n}");
    assert.deepEqual([inside.important, inside.justified], [[], [3]]);
    const before = css(
      "/* `!important`: la preferencia manda. */\na[hidden] {\n  display: none !important;\n}\nb { color: var(--z-fg) !important; }",
    );
    assert.deepEqual([before.important, before.justified], [[5], [3]], "el comentario justifica su regla, no la siguiente");
    const media = css(
      "/* !important: movimiento reducido. */\n@media (prefers-reduced-motion: reduce) {\n  a { transition: none !important; }\n  b { animation: none !important; }\n}",
    );
    assert.deepEqual([media.important, media.justified], [[], [3, 4]]);
  });
  test("!important: un comentario sin nombrarlo, o al principio de un @layer, no justifica", () => {
    assert.deepEqual(css("/* Oculto. */\na { display: none !important; }").important, [2]);
    const layer = css(
      "/* !important en toda la hoja. */\n@layer x {\n  a { display: none !important; }\n  @media print {\n    b { color: var(--z-fg) !important; }\n  }\n}",
    );
    assert.deepEqual(layer.important, [3, 5]);
    assert.deepEqual(layer.justified, []);
  });
  test("px: radio, fuente e interletrado siempre; espacio solo si el valor es de la escala", () => {
    const spaces = new Map([
      [8, "space-2"],
      [12, "space-3"],
    ]);
    const r = css(
      "a { border-radius: 6px; font-size: 13px; letter-spacing: 3px; }\nb { padding: 12px var(--z-space-2); margin: 0 1px; gap: var(--z-space-1, 4px); }\nc { padding: 7px 9px; top: -8px; }\nd { width: 8px; height: calc(100% - 24px); line-height: 16px; }",
      { spaces },
    );
    assert.deepEqual(r.px, [1, 1, 1, 2, 3]);
    assert.deepEqual(r.size, [3, 3, 4, 4, 4], "fuera de la escala y dimensiones: informativo");
  });
  test("px: sin la escala de espacio, un valor de espacio es informativo; 1px y 2px son trazos", () => {
    const r = css("a { padding: 12px; border: 1px solid; inset: 2px; }");
    assert.deepEqual([r.px, r.size], [[], [1]]);
  });
  test("px: los puntos de corte de @media y @container no son medidas del componente", () => {
    const r = css(
      "@media (max-width: 640px) {\n  a { max-width: 320px; }\n}\n@container stage (max-width: 760px) {\n  b { min-height: 54px }\n}",
    );
    assert.deepEqual([r.px, r.size], [[], [2, 5]]);
  });
  test("las columnas de hoja no se calculan fuera de una hoja CSS", () => {
    const r = auditSource('const s = "z-index: 10 !important; padding: 20px; color: red; border-radius: 4px";', {
      spaces: new Map([[20, "space-5"]]),
    });
    assert.deepEqual([r.named, r.important, r.zindex, r.px, r.size], [[], [], [], [], []]);
  });
  test("el script: una ruta inexistente o una opción desconocida fallan con código 2, no dan cero archivos", () => {
    const missing = run("tools/audit.mjs", "no/existe");
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /no existe: no\/existe/);
    assert.equal(run("tools/audit.mjs", "--estricto").status, 2);
  });
  test("el script: la suite está en cero y --json es JSON con los totales", () => {
    const r = run("tools/audit.mjs", "--json");
    const report = JSON.parse(r.stdout);
    assert.equal(r.status, 0, r.stdout.slice(0, 400));
    assert.ok(report.files > 50);
    assert.deepEqual([report.total.color, report.total.prim, report.total.token, report.total.emoji, report.total.inline], [0, 0, 0, 0, 0]);
    // Las columnas de hoja también bloquean: ningún color con nombre, !important sin motivo, z-index literal ni medida de la escala a mano.
    assert.deepEqual([report.total.named, report.total.important, report.total.zindex, report.total.px], [0, 0, 0, 0]);
    assert.ok(report.justified > 0, "los !important de la suite llevan su motivo");
  });
  test("el script: --strict añade la columna informativa `size`", () => {
    const report = JSON.parse(run("tools/audit.mjs", "--json", "--strict").stdout);
    assert.equal(report.strict, true);
    assert.equal(typeof report.total.size, "number");
  });
});

describe("tools/check-barrels.mjs", () => {
  /** Paquete de mentira en la carpeta temporal de la suite: { "ruta/relativa": "contenido" }. */
  const pkg = (files) => {
    const dir = mkdtempSync(join(tmpdir(), "barrels-"));
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), typeof content === "string" ? content : JSON.stringify(content));
    }
    return dir;
  };
  const GROUP = "src/components/actions";
  const base = {
    "src/index.ts": 'export * from "./components/actions";\n',
    [`${GROUP}/index.ts`]: 'export { Button, type ButtonProps } from "./Button";\n',
    [`${GROUP}/Button.tsx`]: "export interface ButtonProps {}\nexport function Button() { return null; }\n",
    [`${GROUP}/Button.manifest.json`]: { name: "Button", import: 'import { Button } from "pkg"' },
  };

  test("un paquete completo no tiene problemas", () => {
    assert.deepEqual(checkBarrels(pkg(base)), []);
  });
  test("detecta el componente con manifiesto que el barrel de su grupo no reexporta", () => {
    const dir = pkg({
      ...base,
      [`${GROUP}/Link.tsx`]: "export function Link() { return null; }\n",
      [`${GROUP}/Link.manifest.json`]: { name: "Link", import: 'import { Link } from "pkg"' },
    });
    assert.deepEqual(checkBarrels(dir), ['src/components/actions/Link.manifest.json: src/components/actions/index.ts no reexporta "Link"']);
  });
  test("detecta la carpeta con barrel que el index raíz no reexporta", () => {
    const [problem, ...rest] = checkBarrels(
      pkg({ ...base, "src/index.ts": 'export { cx } from "./cx";\n', "src/cx.ts": "export const cx = 1;\n" }),
    );
    assert.match(problem, /Button\.manifest\.json: src\/index\.ts no reexporta la carpeta de src\/components\/actions\/index\.ts/);
    assert.deepEqual(rest, []);
  });
  test("exportar solo el tipo no es exportar el componente; un export comentado tampoco", () => {
    const typeOnly = pkg({
      ...base,
      [`${GROUP}/index.ts`]: 'export { type Button } from "./Button";\nexport type { ButtonProps } from "./Button";\n',
    });
    assert.equal(checkBarrels(typeOnly).length, 1);
    const commented = pkg({ ...base, [`${GROUP}/index.ts`]: '// export { Button } from "./Button";\n/* export * from "./Button"; */\n' });
    assert.equal(checkBarrels(commented).length, 1);
  });
  test("`export *`, alias y un grupo sin barrel propio (exportado desde la raíz)", () => {
    const star = pkg({ ...base, [`${GROUP}/index.ts`]: 'export * from "./Button";\n' });
    assert.deepEqual(checkBarrels(star), []);
    const alias = pkg({
      ...base,
      [`${GROUP}/index.ts`]: 'export { Btn as Button } from "./Button";\n',
      [`${GROUP}/Button.tsx`]: "export const Btn = () => null;\n",
    });
    assert.deepEqual(checkBarrels(alias), []);
    const flat = pkg({
      "src/index.ts": 'export { Page, Grid } from "./layouts/Page";\n',
      "src/layouts/Page.tsx": "export function Page() {}\nexport function Grid() {}\nexport function Hidden() {}\n",
      "src/layouts/Page.manifest.json": { name: "Page" },
      // Un manifiesto sin archivo propio: el componente vive en Page.tsx.
      "src/layouts/Grid.manifest.json": { name: "Grid" },
      "src/layouts/Hidden.manifest.json": { name: "Hidden" },
    });
    assert.deepEqual(checkBarrels(flat), ['src/layouts/Hidden.manifest.json: src/index.ts no reexporta "Hidden"']);
  });
  test("`exports` sustituye a `name`, y la línea `import` documentada también debe poder importarse", () => {
    assert.deepEqual(
      declaredNames({ name: "Toast", exports: ["ToastProvider", "useToast"], import: 'import { ToastProvider, useToast } from "pkg"' }),
      ["ToastProvider", "useToast"],
    );
    assert.deepEqual(declaredNames({ name: "Tree", import: 'import { Tree, type TreeNode, helper as h } from "pkg"' }), ["Tree", "helper"]);
    assert.deepEqual(importedNames(undefined), []);
    const dir = pkg({
      ...base,
      [`${GROUP}/Button.manifest.json`]: { name: "Button", exports: ["Button", "ButtonGroup"], import: 'import { Button } from "pkg"' },
    });
    assert.deepEqual(checkBarrels(dir), [
      'src/components/actions/Button.manifest.json: src/components/actions/index.ts no reexporta "ButtonGroup"',
    ]);
  });
  test("exportedNames no se pierde en un ciclo entre barrels ni con un módulo inexistente", () => {
    const dir = pkg({
      "src/index.ts": 'export * from "./a";\nexport * from "./nada";\nexport * as ns from "./b";\n',
      "src/a.ts": 'export * from "./b";\nexport const A = 1;\n',
      "src/b.ts": 'export * from "./a";\nexport const B = 2;\n',
    });
    assert.deepEqual([...exportedNames(join(dir, "src/index.ts"))].sort(), ["A", "B", "ns"]);
  });
  test("un manifiesto ilegible o sin nombre es un problema, no una excepción; sin src/index.ts también", () => {
    const dir = pkg({ ...base, [`${GROUP}/Roto.manifest.json`]: "{ no es json", [`${GROUP}/Vacio.manifest.json`]: {} });
    const problems = checkBarrels(dir);
    assert.equal(problems.length, 2);
    assert.match(problems[0], /Roto\.manifest\.json: JSON no válido/);
    assert.match(problems[1], /Vacio\.manifest\.json: el manifiesto no declara ningún nombre/);
    assert.match(checkBarrels(pkg({ "src/x.ts": "" }))[0], /src\/index\.ts: no existe el punto de entrada/);
  });
  test("el script: zui y zout están completos; un paquete inexistente falla con código 2", () => {
    const r = run("tools/check-barrels.mjs");
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /✓ barrels: \d+ componentes con manifiesto exportados \(zui, zout\)/);
    assert.equal(run("tools/check-barrels.mjs", "no-existe").status, 2);
  });
});

describe("tools/use-client.mjs", () => {
  test("la directiva debe ser lo primero, con cualquier comilla, tras comentarios", () => {
    assert.equal(hasUseClient('"use client";\nimport x from "y";'), true);
    assert.equal(hasUseClient("// nota\n/* otra */\n'use client'\n"), true);
    assert.equal(hasUseClient('import x from "y";\n"use client";'), false);
    assert.equal(hasUseClient('// "use client";\nimport x from "y";'), false);
  });
  test("motivos: hooks, contexto, primitivas propias y manejadores propios", () => {
    assert.deepEqual(clientReasons('import { useState } from "react";\nconst [a] = useState(0);'), ["hooks de React"]);
    assert.deepEqual(clientReasons("const r = useRef<HTMLDivElement>(null);"), ["hooks de React"]);
    assert.deepEqual(clientReasons('import { useTrack } from "./useTrack";\nuseTrack();'), ["hooks propios (use…)"]);
    assert.deepEqual(clientReasons("export const Ctx = createContext(null);"), ["createContext"]);
    assert.deepEqual(clientReasons('import { DialogSurface } from "../../primitives/dialog";'), ["primitivas propias"]);
    assert.deepEqual(clientReasons('import { Popup } from "../primitives/popup";'), ["primitivas propias"]);
    assert.deepEqual(clientReasons('import { slot } from "../../primitives/slot";'), [], "slot es una función pura");
    assert.deepEqual(clientReasons("<button onClick={() => go(1)} />"), ["manejadores de eventos"]);
    assert.deepEqual(clientReasons("<button onClick={async (e) => go(e)} />"), ["manejadores de eventos"]);
  });
  test("no pide la directiva por reenviar una prop, por un comentario o por un nombre parecido", () => {
    assert.deepEqual(clientReasons("<a onClick={disabled ? undefined : onClick} />"), []);
    assert.deepEqual(clientReasons("// useState(0) se quitó\nexport const a = 1;"), []);
    assert.deepEqual(clientReasons("const user = userName(x); reuseState();"), []);
    assert.deepEqual(
      clientReasons(
        'import type { Ref } from "react";\nexport function Box({ ref }: { ref?: Ref<HTMLDivElement> }) { return <div ref={ref} />; }',
      ),
      [],
    );
  });
  test("checkUseClient: null si cumple, mensaje con los motivos si no", () => {
    assert.equal(checkUseClient('"use client";\nconst [a] = useState(0);'), null);
    assert.equal(checkUseClient("export const a = 1;"), null);
    assert.match(
      checkUseClient("const [a] = useState(0);\n<i onClick={() => 1} />"),
      /falta "use client" \(hooks de React, manejadores de eventos\)/,
    );
  });
});
