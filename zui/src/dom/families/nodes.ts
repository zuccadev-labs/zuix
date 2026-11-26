// @zuccadev-labs/zuix-zui/dom/nodes — NodeCanvas (nodos, puertos, aristas, grupos, minimapa, controles y vista en
// lista) y las piezas de diagrama (PortPanel, enmascarado, exportar) sin framework. Registro: init(nodesModule) o
// use(nodesModule) junto a @zuccadev-labs/zuix-zui/dom/core (los controles son una Toolbar del núcleo).
import { diagramPart } from "../diagram";
import { nodesPart } from "../nodes";
import type { DomModule } from "../shared";

export { destroyNodeCanvas, nodeCanvas, setNodeGraph } from "../nodes";
export { applyRedaction } from "../diagram";
export { layeredLayout } from "../../core/layout-layers";
export { describeGraph, parseGraph, serializeGraph } from "../../core/graph";
export { exportPNG, exportSVG, svgToPNG, type ExportOptions } from "../../core/export-image";
export { isRedacted, onRedactionChange, redactText, setRedaction, type RedactOptions, type SensitiveKind } from "../../core/redact";
export { legendFromGraph, type LegendEntry, type LegendOptions } from "../../core/diagram";
export { diagramFromInventory, INVENTORY_SCHEMA, validateInventory, type Inventory } from "../../core/inventory";
export { routeOrthogonal, type OrthogonalOptions } from "../../core/orthogonal-route";
export { SPEED_SCALE } from "../../core/edge-style";

export const nodesModule: DomModule = { name: "nodes", parts: [nodesPart, diagramPart] };
