// Oleada 7: ShortcutInput (core/shortcut): normalización portable, etiquetas por plataforma, aria-keyshortcuts y
// comparación con eventos.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  ariaKeyshortcuts,
  formatShortcutValue,
  isApplePlatform,
  isCompleteShortcut,
  keyName,
  matchesShortcut,
  normalizeShortcut,
  parseShortcut,
  shortcutFromEvent,
  shortcutLabels,
  shortcutSpoken,
} from "../../zui/src/core/shortcut.ts";

const ev = (key: string, code: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}) => ({
  key,
  code,
  ctrlKey: Boolean(mods.ctrl),
  altKey: Boolean(mods.alt),
  shiftKey: Boolean(mods.shift),
  metaKey: Boolean(mods.meta),
});

describe("ShortcutInput · normalización", () => {
  test("plataforma", () => {
    assert.equal(isApplePlatform({ platform: "MacIntel" }), true);
    assert.equal(isApplePlatform({ userAgentData: { platform: "macOS" } }), true);
    assert.equal(isApplePlatform({ platform: "iPhone" }), true);
    assert.equal(isApplePlatform({ platform: "Win32" }), false);
    assert.equal(isApplePlatform(null), false);
  });
  test("tecla por su posición física y nombres", () => {
    assert.equal(keyName({ key: "å", code: "KeyA" }), "A");
    assert.equal(keyName({ key: "¡", code: "Digit1" }), "1");
    assert.equal(keyName({ key: "3", code: "Numpad3" }), "3");
    assert.equal(keyName({ key: " ", code: "Space" }), "Space");
    assert.equal(keyName({ key: "Esc", code: "" }), "Escape");
    assert.equal(keyName({ key: "/", code: "Slash" }), "/");
    assert.equal(keyName({ key: "ArrowUp", code: "ArrowUp" }), "ArrowUp");
  });
  test("Mod es ⌘ en Apple y Ctrl en el resto: el mismo valor en los dos", () => {
    const apple = shortcutFromEvent(ev("k", "KeyK", { meta: true, shift: true }), true);
    const other = shortcutFromEvent(ev("K", "KeyK", { ctrl: true, shift: true }), false);
    assert.equal(formatShortcutValue(apple), "Mod+Shift+K");
    assert.equal(formatShortcutValue(other), "Mod+Shift+K");
    assert.equal(formatShortcutValue(shortcutFromEvent(ev("k", "KeyK", { ctrl: true }), true)), "Ctrl+K");
    assert.equal(formatShortcutValue(shortcutFromEvent(ev("k", "KeyK", { meta: true }), false)), "Meta+K");
    assert.equal(shortcutFromEvent(ev("Shift", "ShiftLeft", { shift: true }), false).key, "");
  });
  test("lectura y forma canónica", () => {
    assert.equal(normalizeShortcut("shift+mod+k"), "Mod+Shift+K");
    assert.equal(normalizeShortcut("Cmd+Option+arrowUp"), "Alt+Meta+ArrowUp");
    assert.equal(normalizeShortcut("Control+Alt+Delete"), "Ctrl+Alt+Delete");
    assert.equal(normalizeShortcut("CmdOrCtrl+S"), "Mod+S");
    assert.equal(normalizeShortcut("Win+Space"), "Meta+Space");
    assert.equal(normalizeShortcut("Ctrl+Shift"), "");
    assert.equal(normalizeShortcut("A+B"), "");
    assert.equal(normalizeShortcut(""), "");
    assert.equal(parseShortcut("f5")!.key, "F5");
  });
  test("propiedad: normalizar dos veces no cambia nada", () => {
    const mod = fc.subarray(["Mod", "Ctrl", "Alt", "Shift", "Meta"]);
    const key = fc.constantFrom("K", "1", "ArrowUp", "Space", "F5", "/", "Enter");
    fc.assert(
      fc.property(mod, key, (mods, k) => {
        const once = normalizeShortcut([...mods].reverse().concat(k).join("+"));
        assert.equal(normalizeShortcut(once), once);
      }),
    );
  });
});

describe("ShortcutInput · vista y uso", () => {
  test("etiquetas y palabras por plataforma", () => {
    const s = parseShortcut("Mod+Shift+K")!;
    assert.deepEqual(shortcutLabels(s, true), ["⇧", "⌘", "K"]);
    assert.deepEqual(shortcutLabels(s, false), ["Ctrl", "Shift", "K"]);
    assert.deepEqual(shortcutLabels(parseShortcut("Ctrl+Alt+ArrowUp")!, true), ["⌃", "⌥", "↑"]);
    assert.deepEqual(shortcutLabels(parseShortcut("Meta+Escape")!, false), ["Win", "Esc"]);
    assert.deepEqual(shortcutLabels({ mod: true, ctrl: false, alt: false, shift: false, meta: false, key: "" }, true), ["⌘"]);
    assert.equal(shortcutSpoken(s, true), "Shift Command K");
    assert.equal(shortcutSpoken(s, false), "Ctrl Shift K");
  });
  test("aria-keyshortcuts", () => {
    assert.equal(ariaKeyshortcuts(parseShortcut("Mod+Shift+K")!, true), "Shift+Meta+K");
    assert.equal(ariaKeyshortcuts(parseShortcut("Mod+Shift+K")!, false), "Control+Shift+K");
    assert.equal(ariaKeyshortcuts(parseShortcut("Ctrl+Space")!, true), "Control+Space");
  });
  test("comparar con un evento y completitud", () => {
    assert.equal(matchesShortcut(ev("k", "KeyK", { meta: true }), "Mod+K", true), true);
    assert.equal(matchesShortcut(ev("k", "KeyK", { ctrl: true }), "Mod+K", true), false);
    assert.equal(matchesShortcut(ev("k", "KeyK", { ctrl: true }), "mod+k", false), true);
    assert.equal(matchesShortcut(ev("k", "KeyK"), "nope+", false), false);
    assert.equal(isCompleteShortcut(parseShortcut("Shift+K")!), false);
    assert.equal(isCompleteShortcut(parseShortcut("Shift+K")!, false), true);
    assert.equal(isCompleteShortcut(parseShortcut("F12")!), true);
    assert.equal(isCompleteShortcut({ mod: true, ctrl: false, alt: false, shift: false, meta: false, key: "" }), false);
  });
});
