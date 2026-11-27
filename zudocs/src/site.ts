import { usePluginData } from "@docusaurus/useGlobalData";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import type { IconName } from "@zuccadev-labs/zuix-zicon/core";

export interface ZudocsArea {
  id: string;
  label: string;
  icon?: IconName;
  description?: string;
}
export interface ZudocsSite {
  name: string;
  tagline?: string;
  brand: string;
  logo?: { src: string; srcDark?: string; alt?: string };
  repository?: string;
  cta?: { label: string; to: string };
  /** Solo las áreas: las rutas locales de la configuración no llegan al navegador (`clientSite`). */
  docs: { areas: ZudocsArea[] };
  /** Páginas de catálogo activas (`pages` en la configuración). */
  pages: { components: boolean; icons: boolean; tokens: boolean; loaders?: boolean; effects?: boolean; carousels?: boolean };
  home?: { eyebrow?: string; title?: string; emphasis?: string; suite?: boolean };
  navbar?: { label: string; to?: string; href?: string }[];
  footer?: string;
  search?: { enabled?: boolean };
  llms?: { full?: boolean };
}

/** Configuración del sitio (zudocs.config.json) tal como la expone docusaurus.config.ts. */
export function useZudocs(): ZudocsSite {
  return useDocusaurusContext().siteConfig.customFields?.zudocs as ZudocsSite;
}

export interface NavItem {
  title: string;
  path: string;
  badge?: string;
}
export interface SiteArea extends ZudocsArea {
  items: NavItem[];
}
export interface SiteGroup {
  id: string;
  label: string;
  icon: IconName;
  count: number;
}
export interface SiteComponent {
  name: string;
  group: string;
  path: string;
  description: string;
  status?: string;
  behavior: string;
}
export interface SiteData {
  areas: SiteArea[];
  groups: SiteGroup[];
  components: SiteComponent[];
  /** Por ruta de documento: minutos de lectura y fecha de la última modificación (ISO), si se conoce. */
  meta: Record<string, { minutes: number; updated?: string }>;
}

/** Datos de todo el sitio calculados en el build (scripts/site-plugin.mjs). */
export function useSiteData(): SiteData {
  return usePluginData("zudocs-site") as SiteData;
}
