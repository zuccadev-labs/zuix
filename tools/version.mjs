#!/usr/bin/env node
// Versionado de la suite (`pnpm bump …`). Los cinco paquetes publicables comparten versión:
// tokens, zicon, zui, zout y el paraguas @zuccadev-labs/zuix (carpeta suite/).
//   pnpm bump check                     misma versión en los cinco y entrada de esa versión en cada CHANGELOG.md
//   pnpm bump patch|minor|major|X.Y.Z   sube la versión y cierra la sección "Sin publicar" de cada CHANGELOG.md
//   … --dry-run                         muestra lo que haría sin escribir
// No crea commits ni etiquetas ni publica: publica el workflow release cuando la versión nueva llega a main,
// y es él quien crea la etiqueta (docs/package/02-publicacion.md).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["tokens", "zicon", "zui", "zout", "suite"];
const UNRELEASED = "## [Sin publicar]";
const USAGE = "uso: pnpm bump check | patch | minor | major | X.Y.Z [--dry-run]";
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** Partes de una versión `X.Y.Z[-pre]`, o `null` si no es semver. Los metadatos de build (`+…`) no se admiten. */
export function parseVersion(version) {
  const m = SEMVER.exec(String(version));
  if (!m) return null;
  // semver § 2 y § 9: sin ceros a la izquierda en los números.
  if ([m[1], m[2], m[3]].some((n) => n.length > 1 && n.startsWith("0"))) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ? m[4].split(".") : [] };
}

/** Orden de precedencia de semver § 11: negativo si a < b, 0 si son iguales, positivo si a > b. */
export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  if (!x || !y) throw new Error(`versión no válida: ${!x ? a : b}`);
  for (const key of ["major", "minor", "patch"]) if (x[key] !== y[key]) return x[key] - y[key];
  // Una versión con prerelease es anterior a la misma sin él.
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const [p, q] = [x.pre[i], y.pre[i]];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const [pn, qn] = [/^\d+$/.test(p), /^\d+$/.test(q)];
    if (pn && qn) {
      if (Number(p) !== Number(q)) return Number(p) - Number(q);
    } else if (pn !== qn) return pn ? -1 : 1;
    else if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

/**
 * Versión que resulta de `kind` (patch, minor, major o una versión exacta) sobre `current`.
 * Desde un prerelease, la subida que ya cubre su número lo cierra (0.2.0-rc.1 + minor = 0.2.0), como `npm version`.
 * Lanza un error con el motivo si `kind` no vale o si la versión exacta no es posterior a la actual.
 */
export function nextVersion(current, kind) {
  const now = parseVersion(current);
  if (!now) throw new Error(`la versión actual "${current}" no es semver`);
  const pre = now.pre.length > 0;
  if (kind === "major") return pre && now.minor === 0 && now.patch === 0 ? `${now.major}.0.0` : `${now.major + 1}.0.0`;
  if (kind === "minor") return pre && now.patch === 0 ? `${now.major}.${now.minor}.0` : `${now.major}.${now.minor + 1}.0`;
  if (kind === "patch") return pre ? `${now.major}.${now.minor}.${now.patch}` : `${now.major}.${now.minor}.${now.patch + 1}`;
  if (!parseVersion(kind)) throw new Error(USAGE);
  if (compareVersions(kind, current) === 0) throw new Error(`la versión ya es ${current}`);
  if (compareVersions(kind, current) < 0) throw new Error(`${kind} es anterior a la versión actual ${current}`);
  return kind;
}

/**
 * Cierra la sección "Sin publicar" de un CHANGELOG.md bajo `version` con fecha `date` (AAAA-MM-DD).
 * Devuelve el texto nuevo y el cuerpo que tenía la sección (cadena vacía si no había cambios).
 * Conserva el fin de línea del archivo (LF o CRLF). Lanza un error si falta la sección o si la versión ya tiene entrada.
 */
export function closeUnreleased(log, version, date) {
  const start = log.indexOf(UNRELEASED);
  if (start < 0) throw new Error(`no tiene la sección "${UNRELEASED}"`);
  if (log.includes(`## [${version}]`)) throw new Error(`ya tiene una entrada [${version}]`);
  const eol = log.includes("\r\n") ? "\r\n" : "\n";
  const bodyStart = start + UNRELEASED.length;
  const found = log.slice(bodyStart).search(/\r?\n## \[/);
  const nextHeading = found < 0 ? -1 : bodyStart + found;
  const body = log.slice(bodyStart, nextHeading < 0 ? log.length : nextHeading).trim();
  const entry = body || "Sin cambios en este paquete. La versión sube para seguir alineada con la suite.";
  const rest = nextHeading < 0 ? "" : log.slice(nextHeading);
  return { body, log: `${log.slice(0, bodyStart)}${eol}${eol}## [${version}] - ${date}${eol}${eol}${entry}${eol}${rest}` };
}

/** Sustituye solo el valor del campo "version" de primer nivel; el resto del package.json queda byte a byte igual. */
export function setPackageVersion(raw, version) {
  // Primer nivel: la clave va con la sangría del objeto raíz, no dentro de otro objeto.
  const indent = /^([ \t]+)"/m.exec(raw)?.[1] ?? "";
  const re = new RegExp(`^(${indent}"version":\\s*")[^"]+(")`, "m");
  if (!re.test(raw)) throw new Error("no se encontró el campo version");
  return raw.replace(re, `$1${version}$2`);
}

/** Fecha local de hoy como AAAA-MM-DD (la del calendario de quien versiona, no la de UTC). */
export function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function main(argv) {
  const dry = argv.includes("--dry-run");
  const unknown = argv.filter((a) => a.startsWith("--") && a !== "--dry-run");
  const positional = argv.filter((a) => !a.startsWith("--"));
  const cmd = positional[0];
  const fail = (msg) => {
    console.error(`✗ ${msg}`);
    process.exit(1);
  };
  const pkgFile = (p) => join(root, p, "package.json");
  const logFile = (p) => join(root, p, "CHANGELOG.md");
  const readPkg = (p) => {
    try {
      return JSON.parse(readFileSync(pkgFile(p), "utf8"));
    } catch (error) {
      return fail(`${p}/package.json: ${error.message}`);
    }
  };

  if (unknown.length) fail(`opción desconocida: ${unknown.join(", ")}\n${USAGE}`);
  if (!cmd || positional.length > 1) fail(USAGE);

  const versions = Object.fromEntries(PACKAGES.map((p) => [p, readPkg(p).version]));
  const current = versions[PACKAGES[0]];

  function check() {
    const errors = [];
    if (new Set(Object.values(versions)).size !== 1)
      errors.push(`versiones distintas: ${PACKAGES.map((p) => `${p} ${versions[p]}`).join(", ")}`);
    for (const p of PACKAGES) {
      if (!parseVersion(versions[p])) errors.push(`${p}/package.json: "${versions[p]}" no es una versión semver`);
      if (!existsSync(logFile(p))) {
        errors.push(`${p}/CHANGELOG.md no existe`);
        continue;
      }
      if (!readFileSync(logFile(p), "utf8").includes(`## [${versions[p]}]`))
        errors.push(`${p}/CHANGELOG.md no tiene la entrada [${versions[p]}]`);
    }
    if (errors.length) fail(errors.join("\n✗ "));
    console.log(`✓ versión ${current} en ${PACKAGES.length} paquetes, con entrada en cada CHANGELOG.md`);
  }

  check();
  if (cmd === "check") return;

  let version;
  try {
    version = nextVersion(current, cmd);
  } catch (error) {
    fail(error.message);
  }
  const date = today();
  const plan = [];
  for (const p of PACKAGES) {
    try {
      plan.push({ p, ...closeUnreleased(readFileSync(logFile(p), "utf8"), version, date) });
    } catch (error) {
      fail(`${p}/CHANGELOG.md ${error.message}`);
    }
  }
  if (!plan.some(({ body }) => body)) fail(`ningún CHANGELOG.md tiene cambios en "${UNRELEASED}": no hay nada que versionar`);
  // Todo se calcula antes de escribir: un fallo no deja unos paquetes en la versión nueva y otros en la anterior.
  const writes = plan.map(({ p, body, log }) => {
    let pkg;
    try {
      pkg = setPackageVersion(readFileSync(pkgFile(p), "utf8"), version);
    } catch (error) {
      fail(`${p}/package.json: ${error.message}`);
    }
    return { p, body, log, pkg };
  });
  for (const { p, body, log, pkg } of writes) {
    console.log(
      `${dry ? "·" : "✓"} ${readPkg(p).name} ${current} → ${version} · ${body ? `${body.split(/\r?\n/).filter((l) => l.startsWith("- ")).length} cambios anotados` : "sin cambios propios"}`,
    );
    if (dry) continue;
    writeFileSync(logFile(p), log);
    writeFileSync(pkgFile(p), pkg);
  }
  console.log(
    dry
      ? "· --dry-run: no se escribió nada"
      : `✓ versión ${version}. Sigue: pnpm install (actualiza el lockfile), pnpm check, pnpm build, pnpm test:pack`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
