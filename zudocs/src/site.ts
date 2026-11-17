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
  docs: { path: string; areas: ZudocsArea[] };
  /** Páginas de catálogo activas (`pages` en la configuración). */
  pages: { components: boolean; icons: boolean; tokens: boolean };
  home?: { eyebrow?: string; title?: string; emphasis?: string; suite?: boolean };
}

/** Configuración del sitio (zudocs.config.json) tal como la expone docusaurus.config.ts. */
export function useZudocs(): ZudocsSite {
  return useDocusaurusContext().siteConfig.customFields?.zudocs as ZudocsSite;
}
