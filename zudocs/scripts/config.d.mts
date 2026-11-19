// Tipos de scripts/config.mjs, para docusaurus.config.ts y sidebars.ts.
export interface ZudocsArea {
  id: string;
  label: string;
  icon?: string;
  description?: string;
}
export interface ZudocsConfig {
  name: string;
  tagline?: string;
  brand: string;
  defaultTheme?: "dark" | "light";
  locale?: string;
  url?: string;
  baseUrl?: string;
  trailingSlash?: boolean;
  logo?: { src: string; srcDark?: string; alt?: string };
  favicon?: string;
  image?: string;
  fonts?: string[];
  static?: string;
  outDir?: string;
  docs: { path: string; areas: ZudocsArea[] };
  pages?: { components?: boolean; icons?: boolean; tokens?: boolean };
  home?: { eyebrow?: string; title?: string; emphasis?: string; suite?: boolean };
  markdown?: { mermaid?: boolean; untrusted?: boolean };
  search?: { enabled?: boolean; languages?: string[] };
  navbar?: { label: string; to?: string; href?: string }[];
  footer?: string;
  repository?: string;
  cta?: { label: string; to: string };
  llms?: { append?: string; full?: boolean };
}
export interface ZudocsContext {
  site: ZudocsConfig;
  configPath: string;
  configDir: string;
  isDefault: boolean;
  slug: string;
  workDir: string;
  docsDir: string;
  outDir: string;
  pages: Record<"components" | "icons" | "tokens", boolean>;
  areas: ZudocsArea[];
  mermaid: boolean;
  staticDir: string;
  generatedStaticDir: string;
  staticDirs: string[];
  llmsPath: string;
  llmsAppend?: string;
  url?: string;
  baseUrl: string;
  trailingSlash: boolean;
  remoteFonts: string[];
  localFonts: string[];
  stagingDir: string;
  generatedDirName: string;
  bundlerCacheDir?: string;
  rel(path: string): string;
  href(route?: string): string;
}
export const templateDir: string;
export const repoDir: string;
export const PAGES: readonly ("components" | "icons" | "tokens")[];
export function callerDir(): string;
export const CONFIG_NAME: string;
export class ZudocsError extends Error {}
export function parseArgs(argv?: string[]): {
  config?: string;
  outDir?: string;
  strict: boolean;
  headers: boolean;
  help: boolean;
  rest: string[];
};
export function validateSchema(value: unknown, schema: object, path?: string): string[];
export function unsafeOutDir(outDir: string, protectedDirs: [string, string | undefined][]): string | undefined;
export function findConfig(explicit?: string): string;
export function loadZudocs(options?: { config?: string; outDir?: string }): ZudocsContext;
