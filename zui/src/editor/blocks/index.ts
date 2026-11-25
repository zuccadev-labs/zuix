// Bloques de serie del conector: los del propio conector, los de zui y los de maquetación de zout.
import type { BlockSpec } from "../render";
import { CORE_BLOCKS } from "./core";
import { ZOUT_BLOCKS } from "./zout";
import { ZUI_BLOCKS } from "./zui";

export { CORE_BLOCKS, ZOUT_BLOCKS, ZUI_BLOCKS };
export const BUILTIN_BLOCKS: readonly BlockSpec[] = [...CORE_BLOCKS, ...ZUI_BLOCKS, ...ZOUT_BLOCKS];
