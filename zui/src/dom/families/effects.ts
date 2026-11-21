// @zuccadev-labs/zuix-zui/dom/effects — DotMatrix, Backdrop, BorderBeam, Glow, AttentionRing y TextEffect sin
// framework. Registro: init(effectsModule) o use(effectsModule) junto a @zuccadev-labs/zuix-zui/dom/core.
import * as effects from "../effects";
import type { DomModule } from "../shared";

export { setDotMatrixPattern } from "../effects";

export const effectsModule: DomModule = { name: "effects", parts: [{ rank: 52, setup: effects.setup, hydrate: effects.hydrate }] };
