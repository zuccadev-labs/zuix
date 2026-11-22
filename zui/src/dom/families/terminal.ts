// @zuccadev-labs/zuix-zui/dom/terminal — Terminal, LogConsole, CodeViewer y DiffViewer sin framework. Registro:
// init(terminalModule) o use(terminalModule) junto a @zuccadev-labs/zuix-zui/dom/core.
import type { DomModule } from "../shared";
import { terminalWidgets } from "../widgets-terminal";

export { terminal } from "../widgets-terminal";
export { appendLogEntries } from "../../core/log-widget";
export { destroyWidget, setWidgetProps } from "../widgets";
export { createAnsiScreen, parseAnsi, stripAnsi } from "../../core/ansi";

export const terminalModule: DomModule = { name: "terminal", parts: [terminalWidgets] };
