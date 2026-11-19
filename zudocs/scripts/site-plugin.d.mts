import type { Plugin, LoadContext } from "@docusaurus/types";
import type { ZudocsContext } from "./config.mjs";
export function zudocsSite(ctx: ZudocsContext): (context: LoadContext) => Plugin;
