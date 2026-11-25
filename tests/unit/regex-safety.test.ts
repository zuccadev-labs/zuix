// Lectura de texto sin retroceso polinómico: enlaces en texto plano, duraciones cortas y menciones de una vista
// previa, más la fuente de imagen del avatar. Cada recorrido a mano se compara con la expresión que sustituye (la de
// antes, copiada aquí como referencia) y se prueba con una entrada patológica larga que debe acabar en tiempo acotado.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { ARRIVAL_LABELS, messagePreview, type ChatMessage } from "../../zui/src/core/chat-group.ts";
import { partsToMs, toMs } from "../../zui/src/core/duration.ts";
import { linkify, safeHref, safeSrc, type TextPart } from "../../zui/src/core/linkify.ts";

// Una entrada de 100 000 caracteres tarda milisegundos en lineal y minutos en cuadrático: 1 s deja margen de sobra.
const N = 100_000;
const BUDGET = 1000;
function fast(name: string, run: () => unknown) {
  const start = performance.now();
  run();
  const ms = performance.now() - start;
  assert.ok(ms < BUDGET, `${name}: ${Math.round(ms)} ms`);
}
const from = (chars: string, maxLength = 40) => fc.string({ unit: fc.constantFrom(...chars), maxLength });

// Referencias: las expresiones de antes.
const OLD_TRAILING = /[.,;:!?'"’”»]+$/;
function oldTrim(raw: string): string {
  let s = raw;
  for (;;) {
    const before = s;
    s = s.replace(OLD_TRAILING, "");
    if (s.endsWith(")")) {
      const open = (s.match(/\(/g) ?? []).length;
      const close = (s.match(/\)/g) ?? []).length;
      if (close > open) s = s.slice(0, -1);
    }
    if (s === before) return s;
  }
}
const OLD_CANDIDATE = /\b(?:https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/gi;
function oldLinkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  const push = (t: string) => {
    if (!t) return;
    const prev = parts[parts.length - 1];
    if (prev?.type === "text") prev.text += t;
    else parts.push({ type: "text", text: t });
  };
  for (const m of text.matchAll(OLD_CANDIDATE)) {
    const start = m.index ?? 0;
    const shown = oldTrim(m[0]);
    if (!shown) continue;
    const email = !/^(?:https?:\/\/|www\.)/i.test(shown);
    const href = safeHref(email ? `mailto:${shown}` : /^www\./i.test(shown) ? `https://${shown}` : shown);
    if (!href || (email && !shown.includes("@"))) continue;
    push(text.slice(last, start));
    parts.push({ type: "link", text: shown, href });
    last = start + shown.length;
  }
  push(text.slice(last));
  return parts;
}
function oldShort(text: string): number | null {
  const short = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(w|d|h|m(?:in)?|s)\b/gi)];
  if (!short.length || short.map((s) => s[0]).join("").replace(/\s/g, "") !== text.replace(/\s/g, "")) return null;
  const unit: Record<string, "weeks" | "days" | "hours" | "minutes" | "seconds"> = {
    w: "weeks",
    d: "days",
    h: "hours",
    m: "minutes",
    min: "minutes",
    s: "seconds",
  };
  const parts: Record<string, number> = {};
  for (const [, num, u] of short) {
    const key = unit[u!.toLowerCase()]!;
    parts[key] = (parts[key] ?? 0) + Number(num!.replace(",", "."));
  }
  return partsToMs(parts);
}
const msg = (text: string): ChatMessage => ({ id: "m", authorId: "a", createdAt: "2026-11-21T09:00:00Z", text });

describe("enlaces: puntuación final sin expresión", () => {
  test("propiedad: mismos trozos que con las expresiones de antes", () => {
    fc.assert(
      fc.property(from("ab.,;:!?'\"’”»()/@+- w", 50), fc.constantFrom("", "https://", "http://x.io/", "www."), (tail, head) => {
        const text = head + tail;
        assert.deepEqual(linkify(text), oldLinkify(text), JSON.stringify(text));
      }),
      { numRuns: 3000 },
    );
  });
  test("propiedad: concatenar los trozos devuelve el original", () => {
    fc.assert(
      fc.property(from("a.@w:/ !)(-", 60), (text) => {
        assert.equal(
          linkify(text)
            .map((p) => p.text)
            .join(""),
          text,
        );
      }),
    );
  });
  test("entradas patológicas largas", () => {
    fast("muchos signos finales", () => linkify(`https://a.com/${"!".repeat(N)}`));
    fast("signos sin cerrar en medio", () => linkify(`https://a.com/${"!".repeat(N)}x`));
    fast("paréntesis de cierre", () => linkify(`https://a.com/${")".repeat(N)}`));
    fast("palabras con punto sin @", () => linkify("a.".repeat(N)));
    fast("palabras con guion sin @", () => linkify("a-".repeat(N)));
    assert.deepEqual(
      linkify(`https://a.com/x${"!".repeat(N)}`).find((p) => p.type === "link"),
      { type: "link", text: "https://a.com/x", href: "https://a.com/x" },
    );
  });
  test("un correo con parte local de hasta 64 caracteres sigue siendo enlace", () => {
    const local = "a".repeat(64);
    assert.deepEqual(
      linkify(`write to ${local}@example.org.`).find((p) => p.type === "link"),
      { type: "link", text: `${local}@example.org`, href: `mailto:${local}@example.org` },
    );
  });
});

describe("duraciones cortas sin expresión", () => {
  test("ejemplos", () => {
    assert.equal(toMs("1h 30m"), 5_400_000);
    assert.equal(toMs("1,5h"), 5_400_000);
    assert.equal(toMs("90 MIN"), 5_400_000);
    assert.equal(toMs("2w 1d"), 2 * 604_800_000 + 86_400_000);
    assert.equal(toMs("1h30m"), 0, "sin separación entre unidades");
    assert.equal(toMs("10mins"), 0);
    assert.equal(toMs("1. h"), 0);
    assert.equal(toMs("h"), 0);
  });
  test("propiedad: mismo resultado que la expresión de antes", () => {
    fc.assert(
      fc.property(from("0123456789.,  wdhmsinWDHMSINx_:", 24), (text) => {
        const t = text.trim();
        // Lo que antes era ISO o reloj sigue por su camino: aquí solo se compara el texto corto.
        if (/^P/i.test(t) || /^\d+:/.test(t)) return;
        assert.equal(toMs(t), oldShort(t) ?? 0, JSON.stringify(t));
      }),
      { numRuns: 2000 },
    );
  });
  test("entradas patológicas largas", () => {
    fast("muchas cifras sin unidad", () => assert.equal(toMs("0".repeat(N)), 0));
    fast("muchas cifras y una unidad al final", () => toMs(`${"0".repeat(N)}x`));
    fast("muchas cantidades", () => assert.equal(toMs("1s ".repeat(N)), N * 1000));
  });
});

describe("menciones en la vista previa sin expresión", () => {
  test("propiedad: mismo texto que con /<@[^>]+>/g", () => {
    fc.assert(
      fc.property(from("<@>ab ", 40), (text) => {
        const expected = text.replace(/<@[^>]+>/g, "@").replace(/\s+/g, " ").trim();
        assert.equal(messagePreview(msg(text), ARRIVAL_LABELS, 1000), expected);
      }),
      { numRuns: 2000 },
    );
  });
  test("ejemplos", () => {
    assert.equal(messagePreview(msg("hi <@ana> and <@luis>!"), ARRIVAL_LABELS), "hi @ and @!");
    assert.equal(messagePreview(msg("<@> stays"), ARRIVAL_LABELS), "<@> stays");
  });
  test("entradas patológicas largas", () => {
    fast("muchos <@ sin cerrar", () => messagePreview(msg("<@".repeat(N)), ARRIVAL_LABELS));
    fast("muchos <@ y un > al final", () => assert.equal(messagePreview(msg(`${"<@".repeat(N)}>`), ARRIVAL_LABELS), "@"));
  });
});

describe("fuente de imagen del avatar", () => {
  test("rutas, http(s), blob y data:image", () => {
    for (const ok of [
      "/avatars/ana.png",
      "avatars/ana.png",
      "./ana.png",
      "//cdn.example.com/a.png",
      "https://example.com/a.png?x=1",
      "http://example.com/a.png",
      "blob:https://example.com/0f4c",
      "data:image/png;base64,iVBORw0KGgo=",
      "/fotos/mi foto.png",
    ])
      assert.equal(safeSrc(ok), ok);
    assert.equal(safeSrc("  /a.png  "), "/a.png");
  });
  test("fuera otros esquemas, control y marcado", () => {
    for (const bad of [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "java\tscript:alert(1)",
      "vbscript:x",
      "data:text/html,<b>x</b>",
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
      '/a.png" onerror="alert(1)',
      "/a.png><script>",
      "",
      "   ",
      null,
      undefined,
    ])
      assert.equal(safeSrc(bad), null, String(bad));
  });
  test("propiedad: lo que pasa no trae marcado ni un esquema peligroso", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (raw) => {
        const out = safeSrc(raw);
        if (out === null) return;
        assert.ok(!/[<>"]/.test(out));
        assert.ok(!/^\s*(?:javascript|vbscript|file):/i.test(out));
      }),
    );
  });
});
