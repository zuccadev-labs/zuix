// Opiniones (core/reviews): distribución por estrellas con porcentajes que suman 100, media, corte del texto largo;
// el marcado de ReviewSummary y ReviewCard, y el «Read more» del modo DOM sobre un DOM mínimo.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { excerpt, foldedValue, ratingAverage, ratingDistribution, ratingTotal } from "../../zui/src/core/reviews.ts";
import { ReviewCard } from "../../zui/src/components/data/ReviewCard.tsx";
import { ReviewSummary } from "../../zui/src/components/data/ReviewSummary.tsx";
import { dataModule, setReviewExpanded } from "../../zui/src/dom/families/data.ts";
import { init } from "../../zui/src/dom/core.ts";
import "../../zicon/src/all.ts";
import { render } from "./helpers/react.mjs";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261123), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300) });

describe("distribución", () => {
  test("filas de 5 a 1, porcentajes por mayor resto y media", () => {
    const rows = ratingDistribution({ 5: 873, 4: 241, 3: 90, 2: 31, 1: 49 });
    assert.deepEqual(
      rows.map((r) => [r.star, r.count, r.percent]),
      [
        [5, 873, 68],
        [4, 241, 19],
        [3, 90, 7],
        [2, 31, 2],
        [1, 49, 4],
      ],
    );
    assert.equal(ratingTotal(rows), 1284);
    assert.equal(ratingAverage(rows), 4.4);
    // Tres tercios: 33 + 33 + 33 = 99 redondeando cada uno; por mayor resto, el primero se lleva el punto.
    assert.deepEqual(
      ratingDistribution([1, 1, 1], 3).map((r) => r.percent),
      [34, 33, 33],
    );
    // Lista con 1 estrella primero, valores no válidos a 0, sin opiniones.
    assert.deepEqual(
      ratingDistribution([2, -1, Number.NaN, 0, 3.7]).map((r) => r.count),
      [3, 0, 0, 0, 2],
    );
    assert.deepEqual(
      ratingDistribution({}).map((r) => r.percent),
      [0, 0, 0, 0, 0],
    );
    assert.equal(ratingAverage(ratingDistribution({})), 0);
    assert.equal(ratingDistribution({}, 0).length, 1);
  });
  test("propiedad: con opiniones los porcentajes suman 100 y no se alejan más de un punto del exacto", () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 1e6 }), { minLength: 1, maxLength: 10 }), (counts) => {
        const rows = ratingDistribution(counts, counts.length);
        const total = ratingTotal(rows);
        const sum = rows.reduce((a, r) => a + r.percent, 0);
        assert.equal(sum, total ? 100 : 0);
        for (const r of rows) if (total) assert.ok(Math.abs(r.percent - (r.count * 100) / total) < 1);
        const avg = ratingAverage(rows);
        assert.ok(avg === 0 || (avg >= 1 && avg <= counts.length));
      }),
    );
  });
});

describe("texto plegable", () => {
  test("corta en un espacio, no pliega lo corto ni un resto pequeño", () => {
    const text = "word ".repeat(100).trim();
    const { head, tail } = excerpt(text, 50);
    assert.ok(head.length <= 50 && !head.endsWith("wor"));
    assert.ok(tail.startsWith(" "));
    assert.deepEqual(excerpt("short", 50), { head: "short", tail: "" });
    assert.equal(excerpt("a".repeat(80), 50, 40).tail, "", "resto de 30 < slack");
    assert.equal(excerpt(text, 0).tail, "");
    // Sin espacios cerca: corta en el límite.
    assert.equal(excerpt("x".repeat(200), 50).head.length, 50);
  });
  test("propiedad: principio + resto es siempre el texto, y el principio no pasa del límite", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 600, unit: "grapheme" }), fc.integer({ min: 0, max: 400 }), (text, limit) => {
        const { head, tail } = excerpt(text, limit);
        assert.equal(head + tail, text);
        if (tail) assert.ok([...head].length <= limit);
      }),
    );
  });
});

describe("marcado", () => {
  test("ReviewSummary: estrellas con nombre, cifra oculta y texto por barra", () => {
    const html = render(ReviewSummary, { distribution: { 5: 3, 4: 1 }, locale: "en-US", title: "Reviews" });
    assert.match(html, /<h3 class="z-review-summary__title">Reviews<\/h3>/);
    assert.match(html, /aria-label="Average rating: 4.8 out of 5"/);
    assert.match(html, /class="z-review-summary__average" aria-hidden="true">4.8</);
    assert.match(html, /<span class="z-sr-only">5 stars: 3 reviews, 75%<\/span>/);
    assert.match(html, /<span class="z-sr-only">1 star: 0 reviews, 0%<\/span>/);
    assert.match(html, /--z-review-share:75.00%/);
    const empty = render(ReviewSummary, { distribution: {} });
    assert.match(empty, /data-empty=""/);
    assert.match(empty, /No reviews yet/);
    assert.match(render(ReviewSummary, { distribution: { 3: 1 } }), />1 review</);
  });
  test("ReviewCard: plegado con resto hidden, botón con aria-controls, fotos y respuesta", () => {
    const text = `${"Lovely place to stay. ".repeat(20)}End.`;
    const html = render(ReviewCard, {
      id: "r1",
      author: { name: "Ana López" },
      rating: 4,
      date: "2026-10-12",
      locale: "en-GB",
      text,
      photos: [{ src: "a.jpg", alt: "Room" }],
      onPhotoSelect: () => {},
      reply: { text: "Thanks!", author: "Marta" },
    });
    assert.match(html, /<article id="r1" class="z-review-card" data-state="closed" data-read-more="Read more" data-read-less="Show less">/);
    assert.match(html, /<span class="z-review-card__rest" id="r1-rest" hidden="">/);
    assert.match(html, /aria-expanded="false" aria-controls="r1-rest">Read more</);
    assert.match(html, /aria-label="Open photo 1 of 1"/);
    assert.match(html, /Response from Marta/);
    assert.match(html, /<time class="z-review-card__date" dateTime="2026-10-12">12 Oct 2026<\/time>/);
    const short = render(ReviewCard, {
      author: { name: "Y" },
      rating: 5,
      text: "Spotless.",
      photos: [{ src: "b.jpg", alt: "Bath" }],
      reply: { text: "Thanks" },
    });
    assert.doesNotMatch(short, /z-review-card__more|data-state/);
    assert.match(short, /<span class="z-review-card__photo"><img/);
    assert.match(short, /Response from the owner/);
  });
});

describe("modo DOM", () => {
  test("Read more despliega, Show less pliega con until-found, beforematch abre y la foto avisa", () => {
    init(dataModule);
    document.body.innerHTML = `<div data-z-dom><article class="z-review-card" data-state="closed" data-read-less="Less">
      <p class="z-review-card__text">Head<span class="z-review-card__ellipsis" aria-hidden="true">…</span><span class="z-review-card__rest" id="rest" hidden>tail</span></p>
      <button type="button" class="z-review-card__more" aria-expanded="false" aria-controls="rest">Read more</button>
      <button type="button" class="z-review-card__photo" data-index="2"></button></article></div>`;
    const card = document.querySelector<HTMLElement>(".z-review-card")!;
    const rest = card.querySelector<HTMLElement>(".z-review-card__rest")!;
    const more = card.querySelector<HTMLButtonElement>(".z-review-card__more")!;
    const changes: unknown[] = [];
    card.addEventListener("z:change", (e) => changes.push((e as CustomEvent).detail));
    card.addEventListener("z:photoselect", (e) => changes.push((e as CustomEvent).detail));
    more.click();
    assert.equal(card.dataset.state, "open");
    assert.equal(more.getAttribute("aria-expanded"), "true");
    assert.equal(more.textContent, "Less");
    assert.equal(rest.hasAttribute("hidden"), false);
    more.click();
    assert.equal(rest.getAttribute("hidden"), foldedValue());
    assert.equal(more.textContent, "Read more");
    rest.dispatchEvent(new Event("beforematch", { bubbles: true }));
    assert.equal(card.dataset.state, "open");
    setReviewExpanded(card, true);
    card.querySelector<HTMLButtonElement>(".z-review-card__photo")!.click();
    assert.deepEqual(changes, [{ open: true }, { open: false }, { open: true }, { index: 2 }]);
  });
});
