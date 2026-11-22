// @zuccadev-labs/zuix-zui/dom/nodes — NodeCanvas (nodos, puertos, aristas, grupos, minimapa, controles y vista en
// lista) sin framework. Registro: init(nodesModule) o use(nodesModule) junto a @zuccadev-labs/zuix-zui/dom/core (los
// controles son una Toolbar del núcleo).
import { nodesPart } from "../nodes";
import type { DomModule } from "../shared";

export { destroyNodeCanvas, nodeCanvas, setNodeGraph } from "../nodes";
export { layeredLayout } from "../../core/layout-layers";
export { describeGraph, parseGraph, serializeGraph } from "../../core/graph";

export const nodesModule: DomModule = { name: "nodes", parts: [nodesPart] };
