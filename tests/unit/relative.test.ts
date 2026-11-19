// Tiempo relativo: unidad elegida, cadencia de repintado y texto con Intl.RelativeTimeFormat.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { formatRelative, nextUpdate, relativeParts, toInstant } from "../../zui/src/core/relative.ts";

const now = Date.parse("2026-11-19T12:00:00Z");

describe("tiempo relativo", () => {
  test("instantes de entrada", () => {
    assert.equal(toInstant("2026-11-19T12:00:00Z"), now);
    assert.equal(toInstant(new Date(now)), now);
    assert.equal(toInstant(now), now);
    assert.equal(toInstant("nope"), null);
    assert.equal(toInstant(null), null);
  });
  test("unidad más grande que cabe y unidad mínima", () => {
    assert.deepEqual(relativeParts(now - 3 * 60_000, now), { value: -3, unit: "minute" });
    assert.deepEqual(relativeParts(now + 2 * 86_400_000, now), { value: 2, unit: "day" });
    assert.deepEqual(relativeParts(now - 400 * 86_400_000, now), { value: -1, unit: "year" });
    assert.deepEqual(relativeParts(now - 5_000, now, "minute"), { value: -0, unit: "minute" });
  });
  test("texto localizado", () => {
    assert.equal(formatRelative(now - 3 * 60_000, now, "en-US"), "3 minutes ago");
    assert.equal(formatRelative(now - 86_400_000, now, "es"), "ayer");
    assert.equal(formatRelative(now + 2 * 3_600_000, now, "en-US", { style: "short" }), "in 2 hr.");
    assert.equal(formatRelative(now, now, "en-US"), "now");
    assert.match(formatRelative(now - 86_400_000, now, "bad locale!!", { numeric: "always" }), /1/, "locale no válido: el del entorno");
  });
  test("cadencia: más a menudo cerca de ahora", () => {
    assert.equal(nextUpdate(now - 10_000, now), 1000);
    assert.equal(nextUpdate(now - 10 * 60_000, now), 15_000);
    assert.equal(nextUpdate(now - 5 * 3_600_000, now), 300_000);
    assert.equal(nextUpdate(now - 5 * 86_400_000, now), 3_600_000);
  });
  test("propiedad: el signo del valor es el de la distancia y la cadencia nunca baja de un segundo", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e12, max: 1e12 }), (diff) => {
        const { value } = relativeParts(now + diff, now);
        assert.ok(value === 0 || Math.sign(value) === Math.sign(diff));
        assert.ok(nextUpdate(now + diff, now) >= 1000);
      }),
    );
  });
});

describe("RelativeTime en React y sin framework", () => {
  test("mismo texto y mismos atributos", async () => {
    await import("./helpers/dom.mjs");
    const { render } = await import("./helpers/react.mjs");
    const { RelativeTime } = await import("../../zui/src/components/content/RelativeTime.tsx");
    const html = render(RelativeTime, { value: now - 3 * 60_000, now, locale: "en-US" });
    assert.match(html, /<time[^>]*class="z-relative-time"[^>]*datetime="2026-11-19T11:57:00.000Z"[^>]*>3 minutes ago<\/time>/i);
    document.body.setAttribute("data-z-dom", "");
    const dom = await import("../../zui/src/dom/time.ts");
    document.body.innerHTML = `<time class="z-relative-time" datetime="${new Date(Date.now() - 3 * 60_000).toISOString()}" data-locale="en-US"></time>`;
    dom.hydrate(document.body);
    const el = document.querySelector("time")!;
    assert.equal(el.textContent, "3 minutes ago");
    assert.ok(el.title.length > 0);
    el.setAttribute("datetime", "not a date");
    dom.updateRelativeTime(el as HTMLElement);
    dom.setup(() => {});
    document.body.innerHTML = "";
  });
});
