#!/usr/bin/env node
// Pruebas unitarias de la lógica pura (`pnpm test:unit`). Runner nativo de Node (node:test) con tsx para importar
// el TypeScript y el TSX reales de los paquetes; cobertura de V8 con umbral sobre los módulos de lógica.
//   pnpm test:unit                  todas, con cobertura y umbral
//   pnpm test:unit calendar         solo los archivos cuyo nombre contiene "calendar" (sin umbral)
//   pnpm test:unit --no-coverage    sin medir
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const argv = process.argv.slice(2);
const filters = argv.filter((a) => !a.startsWith("--"));
const all = readdirSync(here)
  .filter((f) => /\.test\.(mjs|ts)$/.test(f))
  .sort();
const files = all.filter((f) => !filters.length || filters.some((x) => f.includes(x)));
if (!files.length) {
  console.error(
    `✗ ninguna prueba coincide con: ${filters.join(", ")}\n  disponibles: ${all.map((f) => f.replace(/\.test\.(mjs|ts)$/, "")).join(", ")}`,
  );
  process.exit(2);
}

// Lógica pura que debe quedar cubierta. Un módulo nuevo de lógica se añade aquí con su prueba.
const COVERED = [
  "tokens/src/color.mjs",
  "tokens/src/schema.mjs",
  "tokens/src/pairs.mjs",
  "tools/version.mjs",
  "tools/build.mjs",
  "tools/audit.mjs",
  "tools/check-barrels.mjs",
  "tools/use-client.mjs",
  "tools/compat.mjs",
  "zout/src/logic.ts",
  "zout/src/edges.ts",
  "zout/src/pages.ts",
  "zui/src/core/edges.ts",
  "zicon/src/svg.ts",
  "zicon/src/registry.ts",
  "zui/src/components/carousel/lens.ts",
  "zui/src/components/carousel/engine.ts",
  "zui/src/components/navigation/Pagination.tsx",
  "zui/src/components/data/DataTable.tsx",
  "zui/src/core/accept.ts",
  "zui/src/core/money.ts",
  "zui/src/core/reviews.ts",
  "zui/src/core/notifications.ts",
  "zui/src/core/notification-center-widget.ts",
  "zui/src/core/filters.ts",
  "zui/src/core/filter-bar-widget.ts",
  "zui/src/core/reorder.ts",
  "zui/src/core/agenda.ts",
  "zui/src/core/idle.ts",
  "zui/src/core/freebusy.ts",
  "zui/src/core/heatmap.ts",
  "zui/src/core/perpetual.ts",
  "zui/src/core/slots.ts",
  "zui/src/core/timeline.ts",
  "zui/src/core/virtual.ts",
  "zui/src/core/anchor.ts",
  "zui/src/core/calendar.ts",
  "zui/src/core/chart.ts",
  "zui/src/core/chart-widget.ts",
  "zui/src/core/sparkline.ts",
  "zui/src/core/format.ts",
  "zui/src/core/clipboard.ts",
  "zui/src/core/compare.ts",
  "zui/src/core/color.ts",
  "zui/src/core/carousel.ts",
  "zui/src/core/announcer.ts",
  "zui/src/core/carousel-effects.ts",
  "zui/src/core/carousel-loop.ts",
  "zui/src/core/keylines.ts",
  "zui/src/core/stories.ts",
  "zui/src/core/zoom.ts",
  "zui/src/core/skeleton.ts",
  "zui/src/core/qr.ts",
  "zui/src/core/circular.ts",
  "zui/src/core/compare-slider.ts",
  "zui/src/core/crop.ts",
  "zui/src/core/signature.ts",
  "zui/src/core/shortcut.ts",
  "zui/src/core/confetti.ts",
  "zui/src/core/date.ts",
  "zui/src/core/dir.ts",
  "zui/src/core/focus.ts",
  "zui/src/core/interest.ts",
  "zui/src/core/keys.ts",
  "zui/src/core/layers.ts",
  "zui/src/core/long-press.ts",
  "zui/src/core/menu-aim.ts",
  "zui/src/core/menubar.ts",
  "zui/src/core/number.ts",
  "zui/src/core/pagination.ts",
  "zui/src/core/password.ts",
  "zui/src/core/place.ts",
  "zui/src/core/presence.ts",
  "zui/src/core/ref.ts",
  "zui/src/core/relative.ts",
  "zui/src/core/rrule.ts",
  "zui/src/core/roving.ts",
  "zui/src/core/scroll-lock.ts",
  "zui/src/core/segments.ts",
  "zui/src/core/sheet.ts",
  "zui/src/core/selection.ts",
  "zui/src/core/search.ts",
  "zui/src/core/slider.ts",
  "zui/src/core/spatial.ts",
  "zui/src/core/stopwatch.ts",
  "zui/src/core/swipe.ts",
  "zui/src/core/tags.ts",
  "zui/src/core/time.ts",
  "zui/src/core/timer.ts",
  "zui/src/core/toolbar.ts",
  "zui/src/core/tour.ts",
  "zui/src/core/tree.ts",
  "zui/src/core/json-tree.ts",
  "zui/src/core/typeahead.ts",
  "zui/src/core/validity.ts",
  "zui/src/core/zone.ts",
  "zui/src/core/clock.ts",
  "zui/src/core/countdown.ts",
  "zui/src/core/duration.ts",
  "zui/src/core/ticker.ts",
  "zui/src/core/timezones.ts",
  "zui/src/core/ansi.ts",
  "zui/src/core/code-tokens.ts",
  "zui/src/core/popover.ts",
  "zout/src/popover.ts",
  "zui/src/core/diff.ts",
  "zui/src/core/history.ts",
  "zui/src/core/log-filter.ts",
  "zui/src/core/dotmatrix.ts",
  "zui/src/core/effects.ts",
  "zui/src/core/visibility.ts",
  "zui/src/core/chat-group.ts",
  "zui/src/core/chat-anchor.ts",
  "zui/src/core/chat-tree.ts",
  "zui/src/core/delivery.ts",
  "zui/src/core/linkify.ts",
  "zui/src/core/mentions.ts",
  "zui/src/core/waveform.ts",
  "zui/src/core/emoji-data.ts",
  "zui/src/core/markdown-lite.ts",
  "zui/src/core/stream-text.ts",
  "zui/src/core/agent-state.ts",
  "zui/src/core/branches.ts",
  "zui/src/core/usage.ts",
  "zout/src/chat-layout.ts",
  "zui/src/core/metric.ts",
  "zui/src/core/gauge.ts",
  "zui/src/core/funnel.ts",
  "zui/src/core/dashboard-trees.ts",
  "zui/src/core/tracker.ts",
  "zui/src/core/grid-layout.ts",
  "zui/src/core/kanban.ts",
  "zui/src/core/activity.ts",
  "zui/src/core/initials.ts",
  "zui/src/core/user-presence.ts",
  "zui/src/core/members.ts",
  "zui/src/core/profile.ts",
  "zui/src/core/member-list-widget.ts",
  "zui/src/core/viewport.ts",
  "zui/src/core/edge-path.ts",
  "zui/src/core/graph.ts",
  "zui/src/core/graph-edit.ts",
  "zui/src/core/ports.ts",
  "zui/src/core/undo.ts",
  "zui/src/core/layout-layers.ts",
  "zui/src/core/minimap.ts",
  "zui/src/core/node-view.ts",
  "zui/src/core/transfer.ts",
  "zui/src/core/datagrid.ts",
  "zui/src/primitives/slot.ts",
  "zui/src/dom/shared.ts",
  "zui/src/dom/forms-calendar.ts",
  "zui/src/dom/forms-datefield.ts",
  "zui/src/dom/collections.ts",
  "zui/src/dom/datatable.ts",
  "zui/src/dom/time.ts",
  "zudocs/scripts/config.mjs",
];
// Umbrales sobre el conjunto anterior. El motor del carrusel y los módulos DOM incluyen ramas que solo existen
// en un navegador real (WebGL, captura de puntero, capa superior); esas las cubren tests/html y tests/browser.
const THRESHOLD = { lines: 80, branches: 70, functions: 75 };

const coverage = !argv.includes("--no-coverage");
const gate = coverage && !filters.length;
const args = [
  "--import",
  "tsx",
  "--test",
  ...(coverage ? ["--experimental-test-coverage", ...COVERED.map((f) => `--test-coverage-include=${f}`)] : []),
  ...(gate ? Object.entries(THRESHOLD).map(([key, value]) => `--test-coverage-${key}=${value}`) : []),
  ...(process.env.CI ? ["--test-reporter=spec", "--test-reporter-destination=stdout"] : []),
  ...files.map((f) => join("tests/unit", f)),
];
// Temporales (cobertura de V8, carpetas de las pruebas) dentro de .tmp/ del repositorio, que git ignora: la
// suite no depende del espacio libre de la carpeta temporal del sistema y no deja nada fuera del repositorio.
const temp = join(root, ".tmp/unit");
rmSync(temp, { recursive: true, force: true });
mkdirSync(temp, { recursive: true });
// tokens/dist no se versiona y varias pruebas lo leen (la generación de tokens, tools/audit.mjs): la suite lo
// genera antes de empezar, igual que `pnpm tokens`, y así pasa en un checkout recién clonado sin pasos previos.
const tokens = spawnSync(process.execPath, ["tokens/src/build.mjs"], { cwd: root, encoding: "utf8" });
if (tokens.status !== 0) {
  console.error(`✗ no se pudo generar tokens/dist antes de las pruebas:\n${tokens.error?.message ?? (tokens.stderr || tokens.stdout)}`);
  process.exit(1);
}
const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
  // tsx lee de aquí `jsx: react-jsx` (la raíz no tiene tsconfig.json). Zona fija: las pruebas de fechas no dependen de la máquina.
  env: {
    ...process.env,
    TSX_TSCONFIG_PATH: join(root, "tsconfig.base.json"),
    TZ: process.env.TZ ?? "UTC",
    NODE_ENV: "test",
    TMPDIR: temp,
    TEMP: temp,
    TMP: temp,
  },
});
rmSync(temp, { recursive: true, force: true });
if (result.error) {
  console.error(`✗ no se pudo lanzar node: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
