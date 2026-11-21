// @zuccadev-labs/zuix-zui/dom/content — FormatNumber, FormatByte, FormatDate, Highlight, Marquee, JsonTree, Stepper
// con paneles, Timer y RelativeTime sin framework. Registro: init(contentModule) o use(contentModule) junto a @zuccadev-labs/zuix-zui/dom/core.
import * as content from "../content";
import * as reading from "../reading";
import * as time from "../time";
import type { DomModule } from "../shared";

export { setJsonTreeValue, setStep } from "../content";
export { setHighlightQuery } from "../reading";
export { pauseTimer, resetTimer, startTimer, updateRelativeTime } from "../time";

export const contentModule: DomModule = {
  name: "content",
  parts: [
    { rank: 41, setup: time.setup, hydrate: time.hydrate },
    { rank: 50, setup: content.setup, hydrate: content.hydrate },
    { rank: 51, setup: reading.setup, hydrate: reading.hydrate },
  ],
};
