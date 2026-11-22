// Familia de terminal y código sin framework: Terminal, LogConsole, CodeViewer y DiffViewer se pintan con el mismo
// árbol que el binding de React (core/widget + core/vnode) y la misma interacción. La salida de la terminal y los
// mensajes de los logs entran siempre como nodos de texto, nunca como marcado.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowDown } from "@zuccadev-labs/zuix-zicon/icons/arrow-down";
import { arrowDownTray } from "@zuccadev-labs/zuix-zicon/icons/arrow-down-tray";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { chevronUpDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-up-down";
import { commandLine } from "@zuccadev-labs/zuix-zicon/icons/command-line";
import { copy } from "@zuccadev-labs/zuix-zicon/icons/copy";
import { documentText } from "@zuccadev-labs/zuix-zicon/icons/document-text";
import { magnifyingGlass } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass";
import { trash } from "@zuccadev-labs/zuix-zicon/icons/trash";
import { codeViewerWidget } from "../core/code-viewer-widget";
import { diffViewerWidget } from "../core/diff-widget";
import { logConsoleWidget } from "../core/log-widget";
import { terminalApi, terminalWidget, type TerminalApi } from "../core/terminal-widget";
import { widgetPart } from "./widgets";

registerIcons([arrowDown, arrowDownTray, check, chevronUpDown, commandLine, copy, documentText, magnifyingGlass, trash]);

export const terminalWidgets = /* @__PURE__ */ widgetPart(45.7, [terminalWidget, logConsoleWidget, codeViewerWidget, diffViewerWidget]);

/**
 * API de una Terminal montada (`write`, `writeln`, `clear`, `focus`, `text`), o `null` si `el` no lo es. Las órdenes
 * llegan como `z:command { command }`; para responderlas con un flujo, `setWidgetProps(el, { onCommand })`.
 */
export const terminal = (el: HTMLElement): TerminalApi | null => terminalApi(el);
