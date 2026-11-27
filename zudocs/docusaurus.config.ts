// La plantilla se adapta desde zudocs.config.json. Este archivo no debería necesitar cambios.
// Qué configuración se usa (la de zuix o la de otro proyecto) lo decide scripts/config.mjs.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type * as Preset from "@docusaurus/preset-classic";
import type { Config, Plugin } from "@docusaurus/types";
import { clientSite, loadZudocs, mirrorDocs, PAGES, templateDir } from "./scripts/config.mjs";
import { iconsModule } from "./scripts/icons.mjs";
import remarkLead from "./scripts/remark-lead.mjs";
import { zudocsSite } from "./scripts/site-plugin.mjs";

const zudocs = loadZudocs();
const { site, areas, pages } = zudocs;
const search = site.search;
const locale = site.locale ?? "es";
const development = process.env.NODE_ENV === "development";

// La documentación de otro proyecto se compila desde una copia dentro de la plantilla: así ninguna
// ruta del sitio sube hasta la raíz del disco (scripts/config.mjs). En desarrollo se lee la carpeta original,
// para que los cambios se vean al guardar; el servidor de desarrollo no publica nada.
if (!development) mirrorDocs(zudocs);
const docsDir = development ? zudocs.docsDir : zudocs.siteDocsDir;

// Un proyecto externo guarda la caché del empaquetador en su carpeta de trabajo, no en la común.
const bundlerCache = (): Plugin => ({
  name: "zudocs-bundler-cache",
  configureWebpack: () =>
    ({ experiments: { cache: { type: "persistent", storage: { type: "filesystem", directory: zudocs.bundlerCacheDir } } } }) as object,
});

// Iconos del paquete común: solo los que el sitio puede dibujar (scripts/icons.mjs). El módulo se escribe
// en la carpeta de archivos generados del proyecto antes de que Docusaurus resuelva los módulos de cliente.
const iconsFile = join(dirname(zudocs.generatedStaticDir), "icons.js");
mkdirSync(dirname(iconsFile), { recursive: true });
writeFileSync(iconsFile, iconsModule(zudocs, { all: development }));

// Diagramas Mermaid (`markdown.mermaid` en la configuración). El tema oficial pone el renderizador y
// el nuestro, registrado después, sustituye su componente por el que toma los colores de los tokens.
// Desactivado no se registra ninguno de los dos y Mermaid no entra en el sitio.
const mermaidTokens = (): Plugin => ({ name: "zudocs-mermaid", getThemePath: () => join(templateDir, "src", "mermaid", "theme") });
const mermaidThemes = zudocs.mermaid ? [require.resolve("@docusaurus/theme-mermaid"), mermaidTokens] : [];

// Código: Prism solo pone las clases de cada token (`token keyword`…) y los colores salen de los tokens de la
// marca en src/css/zudocs.css, los mismos en claro y oscuro, medidos por el validador de contraste.
const prismTokens = { plain: {}, styles: [] };

const favicon = site.favicon ?? site.logo?.src;

const config: Config = {
  title: site.name,
  tagline: site.tagline,
  url: zudocs.url ?? "https://example.com",
  baseUrl: zudocs.baseUrl,
  trailingSlash: zudocs.trailingSlash,
  favicon,
  // Sin `url` el sitio no tiene dirección pública conocida: no se ofrece a los buscadores con una inventada.
  noIndex: !zudocs.url,
  // El aviso de baseUrl de Docusaurus es un script en línea de depuración: fuera, y la CSP queda más corta.
  baseUrlIssueBanner: false,
  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",
  onDuplicateRoutes: "throw",
  future: { v4: true, faster: true },
  markdown: { format: "detect", mermaid: zudocs.mermaid, hooks: { onBrokenMarkdownLinks: "throw", onBrokenMarkdownImages: "throw" } },
  i18n: { defaultLocale: locale, locales: [locale], localeConfigs: { [locale]: { htmlLang: locale } } },
  stylesheets: zudocs.remoteFonts,
  staticDirectories: zudocs.staticDirs,
  customFields: { zudocs: { ...clientSite(site), docs: { areas }, pages } },
  presets: [
    [
      "classic",
      {
        docs: {
          path: docsDir,
          routeBasePath: "docs",
          sidebarPath: "./sidebars.ts",
          beforeDefaultRemarkPlugins: [remarkLead],
          exclude: ["**/*.pptx", "**/_*", "**/_*/**"],
          // La portada del área (README) va la primera de su barra lateral; por orden alfabético quedaría la última.
          sidebarItemsGenerator: async ({ defaultSidebarItemsGenerator, ...args }) => {
            const items = await defaultSidebarItemsGenerator(args);
            const cover = (i: (typeof items)[number]) => i.type === "doc" && /(^|\/)(README|index)$/i.test(i.id);
            return [...items.filter(cover), ...items.filter((i) => !cover(i))];
          },
        },
        blog: false,
        // Las páginas de catálogo se activan con `pages` en la configuración; las demás no se enrutan.
        pages: {
          exclude: [
            "**/_*.{js,jsx,ts,tsx,md,mdx}",
            "**/_*/**",
            "**/*.test.{js,jsx,ts,tsx}",
            "**/__tests__/**",
            ...PAGES.filter((p) => !pages[p]).map((p) => `${p}.tsx`),
          ],
        },
        // changefreq y priority no los usa ningún buscador; lastmod pediría el historial de git de un proyecto ajeno.
        sitemap: { changefreq: null, priority: null, lastmod: null, ignorePatterns: ["**/search", "**/search/"] },
        theme: {
          customCss: [
            ...zudocs.localFonts.filter((f) => existsSync(f)),
            require.resolve(`@zuccadev-labs/zuix-tokens/css/${site.brand}.css`),
            require.resolve("@zuccadev-labs/zuix-tokens/docusaurus.css"),
            require.resolve("@zuccadev-labs/zuix-zui/styles.css"),
            require.resolve("@zuccadev-labs/zuix-zout/styles.css"),
            "./src/css/zudocs.css",
          ],
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [zudocsSite(zudocs), ...(zudocs.bundlerCacheDir && !process.env.DOCUSAURUS_NO_PERSISTENT_CACHE ? [bundlerCache] : [])],
  themes: [
    ...mermaidThemes,
    ...(search?.enabled === false
      ? []
      : [
          [
            require.resolve("@easyops-cn/docusaurus-search-local"),
            {
              hashed: true,
              language: search?.languages ?? ["es", "en"],
              indexBlog: false,
              docsRouteBasePath: "docs",
              docsDir,
              searchBarPosition: "right",
              highlightSearchTermsOnTargetPage: true,
              explicitSearchResultPath: true,
            },
          ] as [string, object],
        ]),
  ],
  clientModules: [iconsFile],
  themeConfig: {
    colorMode: { defaultMode: site.defaultTheme ?? "dark", respectPrefersColorScheme: false },
    image: site.image,
    metadata: [
      { property: "og:site_name", content: site.name },
      { property: "og:type", content: "website" },
    ],
    navbar: {
      title: site.name,
      logo: site.logo
        ? { src: site.logo.src, srcDark: site.logo.srcDark ?? site.logo.src, alt: site.logo.alt ?? "", width: 32, height: 32 }
        : undefined,
      items: [
        ...areas.map((a) => ({ type: "docSidebar" as const, sidebarId: a.id, label: a.label, position: "left" as const })),
        ...(site.navbar ?? []).map((n) => ({ ...n, position: "right" as const })),
      ],
    },
    footer: site.footer ? { copyright: site.footer } : undefined,
    prism: { theme: prismTokens, darkTheme: prismTokens, additionalLanguages: ["bash", "json", "css", "tsx"] },
    // Los dos modos usan el tema "base" de Mermaid: los colores los pone src/mermaid/tokens.ts.
    ...(zudocs.mermaid ? { mermaid: { theme: { light: "base", dark: "base" } } } : {}),
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
  } satisfies Preset.ThemeConfig,
};

export default config;
