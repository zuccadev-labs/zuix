// Plugin del sitio: lo que el tema necesita saber de todo el sitio en cualquier página.
//   · Una ruta por componente (`/components/<grupo>/<slug>`), generada de los manifiestos (scripts/components.mjs).
//   · Datos globales: áreas con sus documentos en el orden de su barra lateral, grupos y componentes para la
//     barra lateral, y por documento el tiempo de lectura y la fecha de actualización.
//   · La copia de la configuración que llega al navegador, sin rutas locales (scripts/client-config-loader.cjs).
// Corre en `allContentLoaded`, cuando el plugin de documentación ya ha calculado rutas, títulos y barras.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { componentMarkdown, groupsOf, loadCatalog } from "./components.mjs";
import { realDocPath } from "./config.mjs";
import { stripCode, parseFrontMatter } from "./docs.mjs";

/** ¿Hay un historial de git completo? Con un clon superficial todas las fechas serían la del último commit. */
function gitDates(dir) {
  try {
    const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (shallow.trim() !== "false") return undefined;
    return (file) => {
      try {
        const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], {
          cwd: dirname(file),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        return out || undefined;
      } catch {
        return undefined;
      }
    };
  } catch {
    return undefined;
  }
}

/** Minutos de lectura a 200 palabras por minuto, sin contar el código. */
const minutesOf = (text) => Math.max(1, Math.round((stripCode(text).match(/[\p{L}\p{N}]+/gu)?.length ?? 0) / 200));

/** Fecha declarada en el front matter (`last_update.date` no se lee aquí: Docusaurus lo trata aparte). */
const declaredDate = (data) => (/^\d{4}-\d{2}-\d{2}/.test(data.fecha ?? "") ? data.fecha : undefined);

/** @param {import("./config.d.mts").ZudocsContext} ctx */
export function zudocsSite(ctx) {
  return (context) => ({
    name: "zudocs-site",
    configureWebpack() {
      const clientConfig = join(context.generatedFilesDir, "docusaurus.config.mjs");
      const loader = join(dirname(fileURLToPath(import.meta.url)), "client-config-loader.cjs");
      return { module: { rules: [{ test: (path) => path === clientConfig, use: [{ loader }] }] } };
    },
    async allContentLoaded({ allContent, actions }) {
      const version = allContent["docusaurus-plugin-content-docs"]?.default?.loadedVersions?.[0];
      const docsById = new Map((version?.docs ?? []).map((d) => [d.id, d]));
      const dateOf = gitDates(ctx.docsDir);
      const meta = {};
      const areas = ctx.areas.map((area) => {
        const items = [];
        const walk = (list = []) => {
          for (const item of list) {
            if (item.type === "doc" || item.type === "ref") {
              const doc = docsById.get(item.id);
              if (!doc) continue;
              items.push({ title: item.label ?? doc.title, path: doc.permalink, badge: item.customProps?.badge ?? doc.frontMatter?.badge });
            } else if (item.type === "category") walk(item.items);
          }
        };
        walk(version?.sidebars?.[area.id]);
        return { ...area, items };
      });
      for (const doc of version?.docs ?? []) {
        const file = realDocPath(ctx, join(context.siteDir, doc.source.replace(/^@site\//, "")));
        let text = "";
        try {
          text = readFileSync(file, "utf8");
        } catch {
          continue;
        }
        const { data, body } = parseFrontMatter(text);
        meta[doc.permalink] = { minutes: minutesOf(body), updated: declaredDate(data) ?? dateOf?.(file) };
      }

      const base = `${ctx.baseUrl}components`.replace(/\/{2,}/g, "/");
      const catalog = ctx.pages.components ? loadCatalog({ base: "/components" }) : [];
      const groups = groupsOf(catalog);
      for (const [i, c] of catalog.entries()) {
        const neighbour = (n) => (n ? { title: n.name, path: n.path } : undefined);
        const data = await actions.createData(
          `component-${c.slug}.json`,
          JSON.stringify({
            ...c,
            groupLabel: groups.find((g) => g.id === c.group)?.label ?? c.group,
            related: catalog
              .filter((o) => o.group === c.group && o.name !== c.name)
              .map((o) => ({ name: o.name, path: o.path, description: o.description })),
            previous: neighbour(catalog[i - 1]),
            next: neighbour(catalog[i + 1]),
            markdown: componentMarkdown(c, { href: ctx.href }),
          }),
        );
        // Rutas con alias (@site, @generated), no absolutas: el registro de módulos de la ruta llega al
        // navegador con cada ruta tal cual se escribe aquí.
        actions.addRoute({
          path: `${base}/${c.group}/${c.slug}`,
          component: "@site/src/components/ComponentPage/index.tsx",
          modules: { data: `@generated/${relative(context.generatedFilesDir, data).split(/[\\/]/).join("/")}` },
          exact: true,
        });
      }
      actions.setGlobalData({
        areas,
        meta,
        groups,
        components: catalog.map((c) => ({
          name: c.name,
          group: c.group,
          path: c.path,
          description: c.description,
          status: c.status,
          behavior: c.behavior,
        })),
      });
    },
  });
}
