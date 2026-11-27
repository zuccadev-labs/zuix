// Un proyecto externo compilado con zudocs, como lo compila quien lo use: la configuración en `site/`, la
// documentación fuera de ella (`docs.path: "../docs"`), estáticos, una fuente local y una ruta con espacios,
// en una carpeta temporal fuera del repositorio. Comprueba que el sitio no lleva ninguna ruta de esta máquina
// y que siguen funcionando el buscador, llms.txt y las copias .md, las anclas y la salvaguarda de `verify`.
// La usa tests/site/run.mjs; sola: node tests/site/external.mjs
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadZudocs } from "../../zudocs/scripts/config.mjs";
import { describeLeaks, findLocalPaths, localRoots } from "../../zudocs/scripts/leaks.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const bin = join(root, "zudocs/bin/zudocs.mjs");
const WORD = "zudocsexterno";

/** @returns {Promise<{ problems: string[], notes: string[] }>} */
export async function externalProject() {
  const problems = [];
  const notes = [];
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "zudocs-externo-")));
  const project = join(tmp, "mi proyecto");
  const write = (path, text) => {
    mkdirSync(dirname(join(project, path)), { recursive: true });
    writeFileSync(join(project, path), text);
  };
  const own = JSON.parse(readFileSync(join(root, "zudocs/zudocs.config.json"), "utf8"));
  write(
    "site/zudocs.config.json",
    JSON.stringify({
      name: "Proyecto externo",
      brand: own.brand,
      url: "https://example.org",
      baseUrl: "/externo/",
      logo: { src: "img/logo.svg" },
      fonts: ["fonts/fonts.css"],
      docs: { path: "../docs", areas: [{ id: "users", label: "Uso", icon: "book", description: "Cómo se usa." }] },
      search: { enabled: true, languages: ["es"] },
      repository: "https://github.com/example/externo",
    }),
  );
  write("site/static/img/logo.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>');
  const font = readdirSync(join(root, "zudocs/src/fonts")).find((f) => f.endsWith(".woff2"));
  mkdirSync(join(project, "site/fonts"), { recursive: true });
  copyFileSync(join(root, "zudocs/src/fonts", font), join(project, "site/fonts", font));
  write("site/fonts/fonts.css", `@font-face { font-family: Externa; src: url("./${font}") format("woff2"); }\n`);
  write("docs/users/README.md", "# Uso del proyecto\n\nPortada del área.\n\n## Empezar\n\nSigue [la guía](./01-guia.md#segunda-parte).\n");
  write(
    "docs/users/01-guia.md",
    `# Cómo seguir la guía\n\nUna tarea concreta.\n\n## Segunda parte\n\nTexto con la palabra ${WORD}.\n\n![Diagrama](./img/diagrama.svg)\n`,
  );
  write("docs/users/img/diagrama.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle r="4" cx="4" cy="4"/></svg>');

  const config = join(project, "site/zudocs.config.json");
  const ctx = loadZudocs({ config });
  const build = join(project, "site/build");
  const env = { ...process.env, INIT_CWD: project };
  for (const key of ["ZUDOCS_CONFIG", "ZUDOCS_OUT_DIR", "ZUDOCS_URL", "ZUDOCS_BASE_URL"]) delete env[key];
  const zudocs = (...args) => spawnSync(process.execPath, [bin, ...args, "--config", config], { env, encoding: "utf8", timeout: 600_000 });
  try {
    const started = Date.now();
    const r = zudocs("build");
    notes.push(`compilado en ${((Date.now() - started) / 1000).toFixed(0)} s`);
    if (r.status !== 0) {
      problems.push(`build falla (${r.status ?? r.signal}):\n${`${r.stdout}\n${r.stderr}`.trim().split("\n").slice(-15).join("\n")}`);
      return { problems, notes };
    }
    const roots = [...new Set([project, tmp, ...localRoots(ctx)])];
    const leaks = findLocalPaths(build, roots);
    problems.push(...describeLeaks(leaks));
    notes.push(`${roots.length} rutas buscadas en el sitio compilado, ${leaks.length} encontradas`);

    const read = (p) => (existsSync(join(build, p)) ? readFileSync(join(build, p), "utf8") : "");
    const index = readdirSync(build).find((f) => /^search-index.*\.json$/.test(f));
    if (!index || !read(index).includes(WORD)) problems.push(`el índice del buscador no tiene «${WORD}»`);
    const llms = read("llms.txt");
    for (const route of ["docs/users.md", "docs/users/guia.md"]) {
      if (!llms.includes(`https://example.org/externo/${route}`)) problems.push(`llms.txt no enlaza ${route}`);
      if (!read(route).includes("#")) problems.push(`no hay copia ${route}`);
    }
    if (!/href="?\/externo\/docs\/users\/guia#segunda-parte/.test(read("docs/users.html")))
      problems.push("el enlace con ancla entre documentos no se resolvió");
    if (!/id="?segunda-parte/.test(read("docs/users/guia.html"))) problems.push("la página de la guía no tiene el ancla");
    if (!existsSync(join(build, "img/logo.svg"))) problems.push("faltan los estáticos del proyecto");

    // La salvaguarda: una ruta local en el sitio compilado hace fallar verify, que nombra el archivo.
    writeFileSync(join(build, "assets/js/fuga.js"), `x={"source":"${join(ctx.docsDir, "users/README.md")}"}`);
    const v = zudocs("verify");
    if (v.status !== 1 || !v.stderr.includes("assets/js/fuga.js"))
      problems.push(`verify no detecta una ruta local en el sitio (${v.status}): ${v.stderr.trim().split("\n")[0] ?? ""}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(ctx.workDir, { recursive: true, force: true });
  }
  return { problems, notes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { problems, notes } = await externalProject();
  for (const n of notes) console.log(`  · ${n}`);
  for (const p of problems) console.log(`✗ ${p}`);
  console.log(problems.length ? `✗ proyecto externo: ${problems.length} problema(s)` : "✓ proyecto externo");
  process.exit(problems.length ? 1 : 0);
}
