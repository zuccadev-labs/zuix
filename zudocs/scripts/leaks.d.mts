// Tipos de scripts/leaks.mjs.
import type { ZudocsContext } from "./config.d.mts";
export function localRoots(ctx?: Partial<ZudocsContext>): string[];
export function findLocalPaths(dir: string, roots: string[]): { file: string; root: string; excerpt: string }[];
export function describeLeaks(found: { file: string; root: string; excerpt: string }[], label?: string): string[];
