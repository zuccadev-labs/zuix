// zudocs: rutas locales en el sitio compilado (scripts/leaks.mjs), la copia de la documentación de un proyecto
// externo (mirrorDocs) y lo que llega al navegador de la configuración (clientSite y client-config-loader.cjs).
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { CONFIG_NAME, clientSite, loadZudocs, mirrorDocs, realDocPath, templateDir } from "../../zudocs/scripts/config.mjs";
import { describeLeaks, findLocalPaths, localRoots } from "../../zudocs/scripts/leaks.mjs";

const clientConfig = createRequire(import.meta.url)("../../zudocs/scripts/client-config-loader.cjs");
const own = JSON.parse(readFileSync(join(templateDir, CONFIG_NAME), "utf8"));

let dir;
let saved;
beforeEach(() => {
  saved = { INIT_CWD: process.env.INIT_CWD, ZUDOCS_CONFIG: process.env.ZUDOCS_CONFIG };
  delete process.env.ZUDOCS_CONFIG;
  dir = realpathSync(mkdtempSync(join(tmpdir(), "zudocs-leaks-")));
  process.env.INIT_CWD = dir;
});
afterEach(() => {
  for (const [key, value] of Object.entries(saved))
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  rmSync(dir, { recursive: true, force: true });
});

const write = (path, text) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
};

describe("localRoots", () => {
  test("la carpeta personal, la de trabajo, la plantilla y las del proyecto, de la más larga a la más corta", () => {
    const roots = localRoots({ configDir: join(dir, "site"), docsDir: join(dir, "docs") });
    for (const d of [process.cwd(), templateDir, join(dir, "site"), join(dir, "docs")]) assert.ok(roots.includes(d), d);
    if (homedir().split(/[\\/]/).filter(Boolean).length >= 2) assert.ok(roots.includes(homedir()));
    assert.deepEqual(
      roots,
      [...roots].sort((a, b) => b.length - a.length),
    );
  });
  test("descarta las de menos de dos niveles: aparecen en cualquier texto", () => {
    const roots = localRoots({ configDir: "/", docsDir: "/tmp", staticDir: "/srv/" });
    for (const r of ["/", "/tmp", "/srv", ""]) assert.ok(!roots.includes(r), r);
  });
});

describe("findLocalPaths", () => {
  test("encuentra la ruta tal cual, escapada en JSON y con barras normales, y nombra el archivo", () => {
    const root = join(dir, "proyecto");
    write(join(dir, "build/index.html"), "<p>nada</p>");
    write(join(dir, "build/assets/js/a.js"), `x={"source":"@site/../../..${root}/docs/guia.md"}`);
    write(join(dir, "build/assets/js/b.js"), JSON.stringify({ path: "C:\\Users\\ana\\proyecto\\docs" }));
    write(join(dir, "build/img/c.png"), Buffer.concat([Buffer.from([0, 255, 1]), Buffer.from("C:/Users/ana/proyecto/x")]));
    const found = findLocalPaths(join(dir, "build"), [root, "C:\\Users\\ana\\proyecto"]);
    assert.deepEqual(found.map((f) => f.file).sort(), ["assets/js/a.js", "assets/js/b.js", "img/c.png"]);
    assert.equal(found.find((f) => f.file === "assets/js/a.js").root, root);
    assert.match(found[0].excerpt, /proyecto/);
    const [line] = describeLeaks(
      found.filter((f) => f.file === "assets/js/a.js"),
      "build",
    );
    assert.match(line, /^build\/assets\/js\/a\.js: contiene la ruta local /);
  });
  test("una carpeta de nombre más largo no cuenta: /home/ana no es /home/anabel", () => {
    write(join(dir, "build/a.js"), '"/home/anabel/x" "/home/ana.bak"');
    assert.deepEqual(findLocalPaths(join(dir, "build"), ["/home/ana"]), []);
    write(join(dir, "build/b.js"), '"/home/ana/x"');
    assert.deepEqual(
      findLocalPaths(join(dir, "build"), ["/home/ana"]).map((f) => f.file),
      ["b.js"],
    );
  });
  test("un sitio limpio o una carpeta que no existe no dan hallazgos", () => {
    write(join(dir, "build/index.html"), '<a href="/docs/guia">guía</a>');
    assert.deepEqual(findLocalPaths(join(dir, "build"), localRoots({ docsDir: join(dir, "docs") })), []);
    assert.deepEqual(findLocalPaths(join(dir, "no-hay"), [dir]), []);
  });
});

describe("documentación fuera de zuix", () => {
  function project() {
    write(join(dir, "docs/guia/README.md"), "# Guía\n\nPortada.\n");
    write(join(dir, "docs/guia/01-uno.md"), "# Uno\n\nTexto.\n");
    write(join(dir, "docs/guia/.git/HEAD"), "ref");
    write(
      join(dir, "site", CONFIG_NAME),
      JSON.stringify({
        name: "Externo",
        brand: own.brand,
        static: "static",
        outDir: "out",
        fonts: ["fonts/f.css"],
        llms: { append: "extra.md", full: false },
        docs: { path: "../docs", areas: [{ ...own.docs.areas[0], id: "guia" }] },
      }),
    );
    return loadZudocs({ config: join(dir, "site") });
  }
  test("se compila desde una copia dentro de la plantilla, que se rehace entera", (t) => {
    const ctx = project();
    t.after(() => rmSync(ctx.workDir, { recursive: true, force: true }));
    assert.equal(ctx.docsMirror, true);
    assert.ok(ctx.siteDocsDir.startsWith(join(templateDir, ".zudocs", ctx.slug)));
    mirrorDocs(ctx);
    assert.equal(readFileSync(join(ctx.siteDocsDir, "guia/01-uno.md"), "utf8"), "# Uno\n\nTexto.\n");
    assert.ok(!existsSync(join(ctx.siteDocsDir, "guia/.git")));
    rmSync(join(dir, "docs/guia/01-uno.md"));
    mirrorDocs(ctx);
    assert.ok(!existsSync(join(ctx.siteDocsDir, "guia/01-uno.md")));
    assert.equal(realDocPath(ctx, join(ctx.siteDocsDir, "guia/README.md")), join(dir, "docs/guia/README.md"));
    assert.equal(realDocPath(ctx, join(templateDir, "src/pages/index.tsx")), join(templateDir, "src/pages/index.tsx"));
  });
  test("la documentación de zuix se lee en su sitio, sin copia", () => {
    const ctx = loadZudocs({ config: join(templateDir, CONFIG_NAME) });
    assert.equal(ctx.docsMirror, false);
    assert.equal(ctx.siteDocsDir, ctx.docsDir);
    mirrorDocs(ctx);
    assert.ok(!existsSync(join(templateDir, ".zudocs", "_zuix", "docs")));
  });
  test("al navegador no llegan las rutas locales de la configuración", (t) => {
    const ctx = project();
    t.after(() => rmSync(ctx.workDir, { recursive: true, force: true }));
    const client = clientSite(ctx.site);
    for (const key of ["$schema", "static", "outDir", "fonts"]) assert.ok(!(key in client), key);
    assert.deepEqual(client.docs, { areas: ctx.site.docs.areas });
    assert.deepEqual(client.llms, { full: false });
    assert.equal(client.name, "Externo");
    assert.ok(!("llms" in clientSite({ ...ctx.site, llms: undefined })));
  });
});

describe("client-config-loader", () => {
  const generated = (config) => `/*\n * AUTOGENERATED - DON'T EDIT\n */\nexport default ${JSON.stringify(config, null, 2)};\n`;
  test("vacía presets, plugins, temas, módulos de cliente y estáticos y conserva lo demás", () => {
    const out = clientConfig(
      generated({
        title: "Sitio",
        baseUrl: "/x/",
        presets: [["classic", { docs: { path: "/home/ana/proyecto/docs" } }]],
        plugins: [null],
        themes: [["/home/ana/zuix/node_modules/search", { docsDir: "/home/ana/proyecto/docs" }]],
        clientModules: ["/home/ana/zuix/icons.js"],
        staticDirectories: ["/home/ana/proyecto/static"],
        themeConfig: { navbar: { title: "Sitio" } },
        customFields: { zudocs: { name: "Sitio" } },
      }),
    );
    assert.ok(!out.includes("/home/ana"));
    const config = JSON.parse(out.replace(/^export default /, "").replace(/;\s*$/, ""));
    assert.deepEqual([config.presets, config.plugins, config.themes, config.clientModules, config.staticDirectories], [[], [], [], [], []]);
    assert.equal(config.baseUrl, "/x/");
    assert.deepEqual(config.themeConfig, { navbar: { title: "Sitio" } });
  });
  test("un formato inesperado es un error, no una configuración vacía", () => {
    assert.throws(() => clientConfig("module.exports = {}"), /formato esperado/);
  });
});
