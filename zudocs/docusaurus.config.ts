// La plantilla se adapta desde zudocs.config.json. Este archivo no debería necesitar cambios.
// Qué configuración se usa (la de zuix o la de otro proyecto) lo decide scripts/config.mjs.
import type { Config, Plugin } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes as prism } from "prism-react-renderer";
import { join } from "node:path";
import { loadZudocs, PAGES, templateDir } from "./scripts/config.mjs";

const zudocs = loadZudocs();
const { site, areas, pages, docsDir } = zudocs;
const search = site.search;

// Un proyecto externo guarda la caché del empaquetador en su carpeta de trabajo, no en la común.
const bundlerCache = (): Plugin => ({
  name: "zudocs-bundler-cache",
  configureWebpack: () => ({ experiments: { cache: { type: "persistent", storage: { type: "filesystem", directory: zudocs.bundlerCacheDir } } } }) as object,
});

// Diagramas Mermaid (`markdown.mermaid` en la configuración). El tema oficial pone el renderizador y
// el nuestro, registrado después, sustituye su componente por el que toma los colores de los tokens.
// Desactivado no se registra ninguno de los dos y Mermaid no entra en el sitio.
const mermaidTokens = (): Plugin => ({ name: "zudocs-mermaid", getThemePath: () => join(templateDir, "src", "mermaid", "theme") });
const mermaidThemes = zudocs.mermaid ? [require.resolve("@docusaurus/theme-mermaid"), mermaidTokens] : [];

const config: Config = {
  title: site.name,
  tagline: site.tagline,
  url: site.url ?? "https://example.com",
  baseUrl: site.baseUrl ?? "/",
  favicon: site.logo?.src,
  onBrokenLinks: "throw",
  future: { v4: true, faster: true },
  markdown: { format: "detect", mermaid: zudocs.mermaid, hooks: { onBrokenMarkdownLinks: "throw" } },
  i18n: { defaultLocale: site.locale ?? "es", locales: [site.locale ?? "es"] },
  stylesheets: site.fonts ?? [],
  staticDirectories: zudocs.staticDirs,
  customFields: { zudocs: { ...site, docs: { ...site.docs, areas }, pages } },
  presets: [
    [
      "classic",
      {
        docs: { path: docsDir, routeBasePath: "docs", sidebarPath: "./sidebars.ts", exclude: ["**/*.pptx", "**/_*"] },
        blog: false,
        // Las páginas de catálogo se activan con `pages` en la configuración; las demás no se enrutan.
        pages: { exclude: ["**/_*.{js,jsx,ts,tsx,md,mdx}", "**/_*/**", "**/*.test.{js,jsx,ts,tsx}", "**/__tests__/**", ...PAGES.filter((p) => !pages[p]).map((p) => `${p}.tsx`)] },
        theme: {
          customCss: [
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
  plugins: zudocs.bundlerCacheDir && !process.env.DOCUSAURUS_NO_PERSISTENT_CACHE ? [bundlerCache] : [],
  themes: [...mermaidThemes, ...(search?.enabled === false ? [] : [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      { hashed: true, language: search?.languages ?? ["es", "en"], indexBlog: false, docsRouteBasePath: "docs", docsDir, searchBarPosition: "right", highlightSearchTermsOnTargetPage: true, explicitSearchResultPath: true },
    ] as [string, object],
  ])],
  clientModules: ["./src/clientModules/icons.ts"],
  themeConfig: {
    colorMode: { defaultMode: site.defaultTheme ?? "dark", respectPrefersColorScheme: false },
    navbar: {
      title: site.name,
      logo: site.logo ? { src: site.logo.src, srcDark: site.logo.srcDark ?? site.logo.src, alt: site.logo.alt ?? site.name } : undefined,
      items: [
        ...areas.map((a) => ({ type: "docSidebar" as const, sidebarId: a.id, label: a.label, position: "left" as const })),
        ...(site.navbar ?? []).map((n) => ({ ...n, position: "right" as const })),
      ],
    },
    footer: site.footer ? { copyright: site.footer } : undefined,
    prism: { theme: prism.github, darkTheme: prism.vsDark, additionalLanguages: ["bash", "json", "css", "tsx"] },
    // Los dos modos usan el tema "base" de Mermaid: los colores los pone src/mermaid/tokens.ts.
    ...(zudocs.mermaid ? { mermaid: { theme: { light: "base", dark: "base" } } } : {}),
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
  } satisfies Preset.ThemeConfig,
};

export default config;
