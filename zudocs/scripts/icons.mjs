// Decide qué iconos entran en el paquete común del sitio. El set completo de zicon pesa más que todo el
// resto del JavaScript junto; solo las páginas de catálogo (/icons y /components) lo cargan entero.
// El resto del sitio registra los iconos que de verdad puede dibujar: los de las áreas, los que nombran
// los componentes de zui y zout, los de las páginas de la plantilla y los escritos en documentos .mdx.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoDir, templateDir } from "./config.mjs";

const walk = (dir, test) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? e.name === "node_modules" || e.name === "dist"
            ? []
            : walk(join(dir, e.name), test)
          : test(e.name)
            ? [join(dir, e.name)]
            : [],
      )
    : [];

/** Nombres de iconos que el sitio puede necesitar fuera de las páginas de catálogo, ordenados. */
export function siteIcons(ctx) {
  const known = new Set(JSON.parse(readFileSync(join(repoDir, "zicon/manifest.json"), "utf8")).icons.map((i) => i.name));
  const names = new Set(["document-text", ...ctx.site.docs.areas.map((a) => a.icon).filter(Boolean)]);
  // Las páginas de catálogo (iconos y la página de cada componente) importan el set completo por su cuenta: sus
  // demos no cuentan aquí.
  const CATALOG = /(pages[\\/]icons\.tsx|components[\\/]ComponentPage[\\/].*)$/;
  const sources = [
    ...walk(join(repoDir, "zui/src"), (n) => /\.tsx?$/.test(n)),
    ...walk(join(repoDir, "zout/src"), (n) => /\.tsx?$/.test(n)),
    ...walk(join(templateDir, "src"), (n) => /\.tsx?$/.test(n)).filter((f) => !CATALOG.test(f)),
    // Iconos de los grupos de componentes (barra lateral, índice, portada).
    join(templateDir, "scripts/components.mjs"),
    ...walk(ctx.docsDir, (n) => n.endsWith(".mdx")),
  ];
  // Cualquier cadena literal que sea el nombre de un icono cuenta: sobra alguno, no falta ninguno.
  for (const file of sources)
    for (const m of readFileSync(file, "utf8").matchAll(/["'`]([a-z0-9]+(?:-[a-z0-9]+)*)["'`]/g)) if (known.has(m[1])) names.add(m[1]);
  return [...names].filter((n) => known.has(n)).sort();
}

/** Módulo de cliente que registra esos iconos. En desarrollo registra todos: un icono nuevo en un .mdx se ve sin reiniciar. */
export function iconsModule(ctx, { all = false } = {}) {
  if (all) return 'import "@zuccadev-labs/zuix-zicon/all";\n';
  const names = siteIcons(ctx);
  return `// GENERADO por zudocs (scripts/icons.mjs): iconos del paquete común del sitio.\nimport { registerIcons } from "@zuccadev-labs/zuix-zicon/core";\n${names.map((n, i) => `import * as i${i} from "@zuccadev-labs/zuix-zicon/icons/${n}";`).join("\n")}\nregisterIcons([${names.map((_, i) => `...Object.values(i${i})`).join(", ")}]);\n`;
}
