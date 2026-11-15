#!/usr/bin/env node
// Versionado de la suite (`pnpm bump …`). Los cinco paquetes publicables comparten versión:
// tokens, zicon, zui, zout y el paraguas @zuccadev-labs/zuix (carpeta suite/).
//   pnpm bump check                     misma versión en los cinco y entrada de esa versión en cada CHANGELOG.md
//   pnpm bump patch|minor|major|X.Y.Z   sube la versión y cierra la sección "Sin publicar" de cada CHANGELOG.md
//   … --dry-run                         muestra lo que haría sin escribir
// No crea commits ni etiquetas ni publica: eso es manual (docs/package/02-publicacion.md).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["tokens", "zicon", "zui", "zout", "suite"];
const UNRELEASED = "## [Sin publicar]";
const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const cmd = argv.find((a) => !a.startsWith("--"));
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const pkgFile = (p) => join(root, p, "package.json");
const logFile = (p) => join(root, p, "CHANGELOG.md");
const readPkg = (p) => JSON.parse(readFileSync(pkgFile(p), "utf8"));

const versions = Object.fromEntries(PACKAGES.map((p) => [p, readPkg(p).version]));
const current = versions[PACKAGES[0]];

function check() {
  const errors = [];
  if (new Set(Object.values(versions)).size !== 1) errors.push(`versiones distintas: ${PACKAGES.map((p) => `${p} ${versions[p]}`).join(", ")}`);
  for (const p of PACKAGES) {
    if (!existsSync(logFile(p))) { errors.push(`${p}/CHANGELOG.md no existe`); continue; }
    if (!readFileSync(logFile(p), "utf8").includes(`## [${versions[p]}]`)) errors.push(`${p}/CHANGELOG.md no tiene la entrada [${versions[p]}]`);
  }
  if (errors.length) fail(errors.join("\n✗ "));
  console.log(`✓ versión ${current} en ${PACKAGES.length} paquetes, con entrada en cada CHANGELOG.md`);
}

function next(kind) {
  if (/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(kind)) return kind;
  const [major, minor, patch] = current.split("-")[0].split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  if (kind === "patch") return `${major}.${minor}.${patch + 1}`;
  fail(`uso: pnpm bump check | patch | minor | major | X.Y.Z [--dry-run]`);
}

if (!cmd) fail(`uso: pnpm bump check | patch | minor | major | X.Y.Z [--dry-run]`);
if (cmd === "check") { check(); process.exit(0); }

check();
const version = next(cmd);
if (version === current) fail(`la versión ya es ${current}`);
const today = new Date().toISOString().slice(0, 10);
const plan = [];
let withChanges = 0;
for (const p of PACKAGES) {
  const log = readFileSync(logFile(p), "utf8");
  const start = log.indexOf(UNRELEASED);
  if (start < 0) fail(`${p}/CHANGELOG.md no tiene la sección "${UNRELEASED}"`);
  const bodyStart = start + UNRELEASED.length;
  const nextHeading = log.indexOf("\n## [", bodyStart);
  const body = log.slice(bodyStart, nextHeading < 0 ? log.length : nextHeading).trim();
  if (body) withChanges += 1;
  const entry = body || "Sin cambios en este paquete. La versión sube para seguir alineada con la suite.";
  plan.push({ p, body, log: `${log.slice(0, bodyStart)}\n\n## [${version}] - ${today}\n\n${entry}\n${nextHeading < 0 ? "" : log.slice(nextHeading)}` });
}
if (!withChanges) fail(`ningún CHANGELOG.md tiene cambios en "${UNRELEASED}": no hay nada que versionar`);
for (const { p, body, log } of plan) {
  console.log(`${dry ? "·" : "✓"} ${readPkg(p).name} ${current} → ${version} · ${body ? `${body.split("\n").filter((l) => l.startsWith("- ")).length} cambios anotados` : "sin cambios propios"}`);
  if (dry) continue;
  writeFileSync(logFile(p), log);
  // Solo cambia el campo "version"; el resto del archivo queda byte a byte igual.
  const raw = readFileSync(pkgFile(p), "utf8");
  const out = raw.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);
  if (out === raw) fail(`${p}/package.json: no se encontró el campo version`);
  writeFileSync(pkgFile(p), out);
}
console.log(dry ? "· --dry-run: no se escribió nada" : `✓ versión ${version}. Sigue: pnpm install (actualiza el lockfile), pnpm check, pnpm build, pnpm test:pack`);
