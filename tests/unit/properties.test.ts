// Pruebas basadas en propiedades de la lógica pura: en vez de casos elegidos a mano, fast-check genera las
// entradas (también las hostiles) y cada prueba afirma algo que debe cumplirse para todas. La semilla es
// fija, así que un fallo se reproduce igual en cualquier máquina; ZUIX_FC_SEED y ZUIX_FC_RUNS la cambian y
// alargan la búsqueda (`ZUIX_FC_RUNS=20000 pnpm test:unit properties`).
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { contrast, luminance, over, parseColor, toHex } from "../../tokens/src/color.mjs";
import { compareVersions, nextVersion, parseVersion } from "../../tools/version.mjs";
import { registerIcons } from "../../zicon/src/registry.ts";
import { iconSvg } from "../../zicon/src/svg.ts";
import { addDays, addMonths, daysInMonth, format, parse, parseRange, valid } from "../../zui/src/core/date.ts";
import { clampPage, pageRange, pageTotal } from "../../zui/src/core/pagination.ts";
import { computePlace, type Placement, type Side } from "../../zui/src/core/place.ts";
import { fold, score } from "../../zui/src/core/search.ts";
import { snap } from "../../zui/src/core/slider.ts";
import { stripTags } from "../../zudocs/scripts/docs.mjs";

fc.configureGlobal({
  seed: Number(process.env.ZUIX_FC_SEED ?? 20261118),
  numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300),
});

const text = fc.string({ unit: "binary", maxLength: 40 });
/** Cadenas con mucha más probabilidad de romper un marcado que las aleatorias. */
const hostile = fc.oneof(
  text,
  fc
    .array(fc.constantFrom("<", ">", '"', "'", "&", "/", "=", " ", "script", "svg", "onload", "&quot;", "a", "\n", "\0"), { maxLength: 24 })
    .map((a) => a.join("")),
);
const anything = fc.oneof(
  hostile,
  fc.double(),
  fc.integer(),
  fc.constantFrom(null, undefined, true, false, Number.NaN, Object.create(null), Symbol("s")),
  fc.object({ maxDepth: 1 }),
);
/** Como `String`, para comparar: un objeto que no se deja convertir es texto vacío. */
const asText = (value: unknown) => {
  try {
    return String(value);
  } catch {
    return "";
  }
};

describe("propiedades: iconSvg", () => {
  const decode = (s: string) =>
    s
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  const ATTR = /([a-zA-Z-]+)="([^"]*)"/g;
  const SHAPE = /^<svg((?: [a-zA-Z-]+="[^"<>']*")+)>((?:<path(?: [a-z-]+="[^"<>']*")+\/>)*)<\/svg>$/;
  const ALLOWED = new Set([
    "xmlns",
    "viewbox",
    "width",
    "height",
    "fill",
    "focusable",
    "role",
    "aria-label",
    "aria-hidden",
    "data-icon",
    "data-variant",
    "class",
  ]);

  test("cualquier entrada da un único <svg> bien formado, sin marcado ni atributos de más", () => {
    fc.assert(
      fc.property(
        hostile,
        fc.array(hostile, { maxLength: 3 }),
        anything,
        anything,
        anything,
        anything,
        (name, paths, size, label, className, variant) => {
          registerIcons([{ name, o: paths, s: paths.map((d) => `E:${d}`) }]);
          const svg = iconSvg(name, { size, label, className, variant } as never);
          const shape = SHAPE.exec(svg);
          assert.ok(shape, svg);
          // Un `&` solo aparece como principio de una de las cinco entidades que escribe `esc`.
          assert.doesNotMatch(svg, /&(?!amp;|quot;|#39;|lt;|gt;)/);
          const attrs = new Map([...shape[1]!.matchAll(ATTR)].map((m) => [m[1]!, decode(m[2]!)]));
          assert.equal(attrs.get("data-icon"), name);
          assert.ok(attrs.get("data-variant") === "outline" || attrs.get("data-variant") === "solid");
          assert.match(attrs.get("width")!, /^(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)[a-z%]{0,4}$/);
          assert.equal(attrs.get("height"), attrs.get("width"));
          if (label) assert.equal(attrs.get("aria-label"), asText(label));
          else assert.equal(attrs.get("aria-hidden"), "true");
          assert.equal(attrs.get("class"), className ? `z-icon ${asText(className)}` : "z-icon");
          assert.equal((shape[2]!.match(/<path /g) ?? []).length, paths.length);

          // El mismo marcado, leído por un analizador de HTML: un solo elemento, solo trazados dentro.
          const host = document.createElement("div");
          host.innerHTML = svg;
          assert.equal(host.children.length, 1);
          const root = host.firstElementChild!;
          assert.equal(root.tagName.toLowerCase(), "svg");
          assert.equal(host.querySelectorAll("*").length, 1 + paths.length);
          for (const el of host.querySelectorAll("*"))
            for (const attr of el.getAttributeNames())
              assert.ok(ALLOWED.has(attr.toLowerCase()) || ["d", "fill-rule", "clip-rule"].includes(attr), attr);
        },
      ),
    );
  });
});

describe("propiedades: computePlace", () => {
  const SIDES: Side[] = ["top", "right", "bottom", "left"];
  const placement = fc.tuple(fc.constantFrom(...SIDES), fc.constantFrom("", "-start", "-end")).map(([s, a]) => `${s}${a}` as Placement);
  const input = fc.record({
    anchor: fc.record({
      left: fc.integer({ min: -500, max: 2500 }),
      top: fc.integer({ min: -500, max: 2500 }),
      width: fc.nat(600),
      height: fc.nat(600),
    }),
    size: fc.record({ width: fc.nat(1200), height: fc.nat(1200) }),
    viewport: fc.record({ width: fc.integer({ min: 1, max: 2000 }), height: fc.integer({ min: 1, max: 2000 }) }),
    placement,
    gap: fc.nat(24),
    padding: fc.nat(24),
    rtl: fc.boolean(),
  });

  test("la capa que cabe queda dentro de la ventana, con su margen", () => {
    fc.assert(
      fc.property(input, (p) => {
        const r = computePlace(p);
        assert.ok(
          Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.availableWidth) && Number.isInteger(r.availableHeight),
        );
        assert.ok(r.availableWidth >= 0 && r.availableHeight >= 0);
        assert.ok(SIDES.includes(r.side));
        assert.ok(r.x >= p.padding && r.y >= p.padding);
        if (p.size.width + 2 * p.padding <= p.viewport.width) assert.ok(r.x + p.size.width <= p.viewport.width - p.padding);
        if (p.size.height + 2 * p.padding <= p.viewport.height) assert.ok(r.y + p.size.height <= p.viewport.height - p.padding);
      }),
    );
  });

  test("solo voltea al lado opuesto, y solo si en el pedido no cabía", () => {
    const opposite: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
    fc.assert(
      fc.property(input, (p) => {
        const wanted = p.placement.split("-")[0] as Side;
        const { side } = computePlace(p);
        if (side === wanted) return;
        assert.equal(side, opposite[wanted]);
        const { anchor: a, size, viewport, gap } = p;
        const fits = {
          top: a.top - gap - size.height >= 0,
          bottom: a.top + a.height + gap + size.height <= viewport.height,
          left: a.left - gap - size.width >= 0,
          right: a.left + a.width + gap + size.width <= viewport.width,
        };
        assert.equal(fits[wanted], false);
      }),
    );
  });

  test("lockSide se respeta y RTL intercambia start y end en el eje horizontal", () => {
    fc.assert(
      fc.property(input, fc.constantFrom(...SIDES), (p, lockSide) => {
        assert.equal(computePlace({ ...p, lockSide }).side, lockSide);
        const [side, align] = p.placement.split("-") as [Side, string?];
        if (!align || side === "left" || side === "right") return;
        const mirrored = `${side}-${align === "start" ? "end" : "start"}` as Placement;
        assert.deepEqual({ ...computePlace({ ...p, rtl: !p.rtl, placement: mirrored }), align }, computePlace(p));
      }),
    );
  });
});

describe("propiedades: fechas", () => {
  // Dentro de 0001-9999 con margen para sumar: el formato ISO de cuatro cifras no cubre más.
  const iso = fc
    .tuple(fc.integer({ min: 300, max: 9700 }), fc.integer({ min: 0, max: 11 }), fc.integer({ min: 1, max: 31 }))
    .map(([y, m, d]) => {
      const date = new Date(0);
      date.setUTCFullYear(y, m, Math.min(d, daysInMonth(y, m)));
      return format(date);
    });

  test("formato y lectura son inversos, y toda fecha generada es válida", () => {
    fc.assert(
      fc.property(iso, (d) => {
        assert.ok(valid(d), d);
        assert.equal(format(parse(d)), d);
      }),
    );
  });
  test("sumar y restar los mismos días devuelve la fecha; el orden de las fechas es el de los días", () => {
    fc.assert(
      fc.property(iso, fc.integer({ min: -100_000, max: 100_000 }), (d, n) => {
        const moved = addDays(d, n);
        assert.ok(valid(moved), moved);
        assert.equal(addDays(moved, -n), d);
        assert.equal(Math.sign(n), moved < d ? -1 : moved > d ? 1 : 0);
      }),
    );
  });
  test("sumar meses cae en el mes esperado y nunca pasa del día de partida", () => {
    fc.assert(
      fc.property(iso, fc.integer({ min: -3000, max: 3000 }), (d, n) => {
        const moved = addMonths(d, n);
        assert.ok(valid(moved), moved);
        const months = (s: string) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7));
        assert.equal(months(moved) - months(d), n);
        const [from, to] = [Number(d.slice(8)), Number(moved.slice(8))];
        assert.ok(to === from || (to < from && to === daysInMonth(Number(moved.slice(0, 4)), Number(moved.slice(5, 7)) - 1)));
      }),
    );
  });
  test("ninguna cadena hace fallar la validación ni cuela una fecha inexistente en un rango", () => {
    const loose = fc.oneof(
      text,
      iso,
      fc
        .tuple(fc.nat(9999), fc.nat(19), fc.nat(39))
        .map(([y, m, d]) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`),
    );
    fc.assert(
      fc.property(loose, loose, (a, b) => {
        if (valid(a)) assert.equal(format(parse(a)), a);
        const range = parseRange(`${a}/${b}`);
        for (const end of [range.from, range.to]) assert.ok(end === null || valid(end));
      }),
    );
  });
});

describe("propiedades: paginación", () => {
  const number = fc.oneof(fc.double(), fc.integer({ min: -50, max: 5000 }));

  test("clampPage devuelve siempre una página entera que existe", () => {
    fc.assert(
      fc.property(number, number, number, (page, count, fallback) => {
        const total = pageTotal(count);
        const got = clampPage(page, count, fallback);
        assert.ok(Number.isInteger(total) && total >= 1);
        assert.ok(Number.isInteger(got) && got >= 1 && got <= total, `${got} de ${total}`);
      }),
    );
  });
  test("pageRange empieza en 1, acaba en la última, contiene la actual y sus vecinas y no deja huecos vacíos", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3000 }), fc.nat(4), fc.nat(), (count, siblings, seed) => {
        const page = (seed % count) + 1;
        const range = pageRange(page, count, siblings);
        const slots = siblings * 2 + 5;
        assert.equal(range.length, Math.min(count, slots));
        assert.equal(range[0], 1);
        assert.equal(range.at(-1), count);
        assert.ok(range.includes(page));
        for (let n = page - siblings; n <= page + siblings; n++) if (n >= 1 && n <= count) assert.ok(range.includes(n), `falta ${n}`);
        range.forEach((n, i) => {
          if (i === 0) return;
          const prev = range[i - 1]!;
          if (n === 0) assert.ok(prev !== 0 && range[i + 1]! - prev > 1, "un hueco oculta al menos una página");
          else if (prev !== 0) assert.equal(n, prev + 1);
        });
      }),
    );
  });
});

describe("propiedades: búsqueda", () => {
  const words = fc.string({ unit: "grapheme", maxLength: 16 });

  test("fold es idempotente y no distingue mayúsculas ni acentos compuestos", () => {
    fc.assert(
      fc.property(words, (s) => {
        assert.equal(fold(fold(s)), fold(s));
        assert.equal(fold(s.normalize("NFC")), fold(s.normalize("NFD")));
      }),
    );
  });
  test("prefijo puntúa 3, fragmento al menos 2 y subsecuencia al menos 1", () => {
    fc.assert(
      fc.property(words, fc.nat(16), fc.nat(16), fc.array(fc.boolean(), { minLength: 16, maxLength: 16 }), (s, a, b, keep) => {
        const chars = [...fold(s)];
        const [from, to] = [Math.min(a, b), Math.max(a, b)];
        // Un trozo cuyas marcas combinantes se reordenan al normalizar ya no es el mismo texto: no se comprueba.
        const stable = (q: string, least: number) => fold(q) !== q || assert.ok(score(q, s) >= least, `"${q}" en "${s}"`);
        stable(chars.slice(0, to).join(""), 3);
        stable(chars.slice(from, to).join(""), 2);
        stable(chars.filter((_, i) => keep[i]).join(""), 1);
        assert.equal(score(s, s), 3);
      }),
    );
  });
  test("la puntuación es 0, 1, 2 o 3 para cualquier par", () => {
    fc.assert(fc.property(words, words, (q, t) => assert.ok([0, 1, 2, 3].includes(score(q, t)))));
  });
});

describe("propiedades: snap del Slider", () => {
  // Decimales exactos (enteros a escala), como los que se escriben en `min`, `max` y `step`.
  const grid = fc
    .record({
      digits: fc.nat(3),
      min: fc.integer({ min: -5000, max: 5000 }),
      steps: fc.integer({ min: 0, max: 400 }),
      step: fc.integer({ min: 1, max: 500 }),
      extra: fc.nat(499),
    })
    .map(({ digits, min, steps, step, extra }) => {
      const unit = 10 ** digits;
      return { min: min / unit, step: step / unit, max: (min + steps * step + (extra % step)) / unit, last: (min + steps * step) / unit };
    });

  test("el resultado está en el recorrido, es estable y queda a medio paso como mucho del valor", () => {
    fc.assert(
      fc.property(grid, fc.double({ noNaN: true, min: -1e6, max: 1e6 }), ({ min, max, step, last }, value) => {
        const got = snap(value, min, max, step);
        assert.ok(got >= min && got <= max, `${got} fuera de [${min}, ${max}]`);
        assert.equal(snap(got, min, max, step), got, "volver a ajustar no lo mueve");
        const steps = (got - min) / step;
        assert.ok(Math.abs(steps - Math.round(steps)) < 1e-6, `${got} no es un paso desde ${min}`);
        if (value >= min && value <= last) assert.ok(Math.abs(got - value) <= step / 2 + 1e-9);
      }),
    );
  });
  test("un valor que no es un número no saca al tirador del recorrido", () => {
    fc.assert(
      fc.property(
        grid,
        fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
        fc.double(),
        ({ min, max, step }, value, badStep) => {
          for (const s of [step, badStep]) {
            const got = snap(value, min, max, s);
            assert.ok(got >= min && got <= max, `${got}`);
          }
        },
      ),
    );
  });
});

describe("propiedades: color", () => {
  const byte = fc.integer({ min: 0, max: 255 });
  const opaque = fc.tuple(byte, byte, byte).map(([r, g, b]) => [r, g, b, 1]);
  const layer = fc.tuple(byte, byte, byte, fc.double({ min: 0, max: 1, noNaN: true }));
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  // Valores con la forma de los que usan los tokens, con números y trozos que no deberían valer.
  const piece = fc.oneof(
    fc.double().map(String),
    fc.integer({ min: -400, max: 400 }).map(String),
    fc.constantFrom("", ".", "..", "-", "e", "1e999", "%", "50%", "none"),
  );
  const colorish: fc.Arbitrary<string> = fc.letrec((tie) => ({
    color: fc.oneof(
      { depthSize: "small" },
      fc.constantFrom("white", "black", "transparent", "red", ""),
      fc.array(fc.constantFrom(..."0123456789abcdefABCDEFg"), { maxLength: 9 }).map((a) => `#${a.join("")}`),
      fc.tuple(fc.array(piece, { maxLength: 5 }), fc.constantFrom(", ", " ", " / ")).map(([p, sep]) => `rgb(${p.join(sep)})`),
      fc
        .tuple(fc.constantFrom("in srgb", "in oklch", ""), tie("color"), piece, tie("color"), piece)
        .map(([space, a, p, b, q]) => `color-mix(${space}, ${a} ${p}%, ${b} ${q})`),
      text,
    ),
  })).color as fc.Arbitrary<string>;

  test("parseColor devuelve null o cuatro números finitos, sin lanzar", () => {
    fc.assert(
      fc.property(colorish, (value) => {
        const c = parseColor(value);
        if (c === null) return;
        assert.equal(c.length, 4);
        assert.ok(c.every(Number.isFinite), `${value} → ${c}`);
      }),
    );
  });
  test("un hexadecimal se lee y se vuelve a escribir igual, en sus cuatro formas", () => {
    fc.assert(
      fc.property(byte, byte, byte, byte, (r, g, b, a) => {
        const six = `#${hex(r)}${hex(g)}${hex(b)}`;
        assert.deepEqual(parseColor(six), [r, g, b, 1]);
        assert.equal(toHex(parseColor(six.toUpperCase())), six);
        assert.deepEqual(parseColor(`${six}${hex(a)}`), [r, g, b, a / 255]);
        const short = [r, g, b].map((n) => (n % 16).toString(16));
        assert.equal(toHex(parseColor(`#${short.join("")}`)), `#${short.map((c) => c + c).join("")}`);
        assert.deepEqual(parseColor(`rgb(${r}, ${g}, ${b})`), [r, g, b, 1]);
        assert.deepEqual(parseColor(`rgb(${r} ${g} ${b} / 50%)`), [r, g, b, 0.5]);
      }),
    );
  });
  test("el contraste es simétrico, va de 1 a 21 y crece cuando un color se aleja del otro en luminancia", () => {
    fc.assert(
      fc.property(opaque, opaque, (a, b) => {
        const ratio = contrast(a, b);
        assert.equal(ratio, contrast(b, a));
        assert.ok(ratio >= 1 && ratio <= 21 + 1e-9, `${ratio}`);
        assert.equal(contrast(a, a), 1);
        assert.ok(luminance(a) >= 0 && luminance(a) <= 1 + 1e-12);
        const brighter = a.map((v, i) => (i < 3 ? Math.min(255, v + 16) : v));
        assert.ok(luminance(brighter) >= luminance(a));
        const [dark, light] = luminance(a) <= luminance(b) ? [a, b] : [b, a];
        assert.ok(contrast(dark, [255, 255, 255, 1]) >= contrast(light, [255, 255, 255, 1]) - 1e-12);
      }),
    );
  });
  test("componer capas: una opaca tapa, una transparente no cambia nada y el resultado queda entre las dos", () => {
    fc.assert(
      fc.property(layer, opaque, (top, bottom) => {
        const out = over(top, bottom);
        assert.equal(out[3], 1);
        for (const i of [0, 1, 2]) assert.ok(out[i] >= Math.min(top[i], bottom[i]) - 1e-9 && out[i] <= Math.max(top[i], bottom[i]) + 1e-9);
        assert.deepEqual(over([top[0], top[1], top[2], 1], bottom), [top[0], top[1], top[2], 1]);
        assert.deepEqual(over([top[0], top[1], top[2], 0], bottom), bottom);
      }),
    );
  });
});

describe("propiedades: versiones", () => {
  const num = fc.oneof(fc.nat(3), fc.nat(1_000_000));
  const ident = fc.oneof(fc.nat(30).map(String), fc.stringMatching(/^[0-9A-Za-z-]{1,6}$/));
  const version = fc
    .tuple(
      num,
      num,
      num,
      fc.oneof(
        { weight: 2, arbitrary: fc.constant([] as string[]) },
        { weight: 3, arbitrary: fc.array(ident, { minLength: 1, maxLength: 4 }) },
      ),
    )
    .map(([major, minor, patch, pre]) => `${major}.${minor}.${patch}${pre.length ? `-${pre.join(".")}` : ""}`);

  test("compareVersions es un orden total: reflexivo, antisimétrico y transitivo", () => {
    fc.assert(
      fc.property(version, version, version, (a, b, c) => {
        assert.equal(compareVersions(a, a), 0);
        assert.equal(Math.sign(compareVersions(a, b)) + Math.sign(compareVersions(b, a)), 0);
        const sorted = [a, b, c].sort(compareVersions);
        assert.ok(
          compareVersions(sorted[0], sorted[1]) <= 0 &&
            compareVersions(sorted[1], sorted[2]) <= 0 &&
            compareVersions(sorted[0], sorted[2]) <= 0,
        );
        if (compareVersions(a, b) === 0 && compareVersions(b, c) === 0) assert.equal(compareVersions(a, c), 0);
      }),
    );
  });
  test("patch, minor y major dan una versión estable y posterior, en ese orden", () => {
    fc.assert(
      fc.property(version, (v) => {
        const [patch, minor, major] = ["patch", "minor", "major"].map((kind) => nextVersion(v, kind));
        for (const next of [patch, minor, major]) {
          assert.deepEqual(parseVersion(next)?.pre, []);
          assert.ok(compareVersions(next, v) > 0, `${v} → ${next}`);
        }
        assert.ok(compareVersions(patch, minor) <= 0 && compareVersions(minor, major) <= 0);
      }),
    );
  });
  test("una versión exacta solo se acepta si es posterior a la actual", () => {
    fc.assert(
      fc.property(version, version, (current, wanted) => {
        if (compareVersions(wanted, current) > 0) assert.equal(nextVersion(current, wanted), wanted);
        else assert.throws(() => nextVersion(current, wanted));
      }),
    );
  });
  test("lo que no es semver se rechaza sin lanzar", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          text,
          version.map((v) => `${v}+build`),
          version.map((v) => `0${v}`),
          version.map((v) => `v${v}`),
        ),
        (s) => {
          const parsed = parseVersion(s);
          if (parsed)
            assert.equal(`${parsed.major}.${parsed.minor}.${parsed.patch}${parsed.pre.length ? `-${parsed.pre.join(".")}` : ""}`, s);
        },
      ),
    );
  });
});

describe("propiedades: stripTags", () => {
  const markup = fc.oneof(
    text,
    fc.array(fc.constantFrom("<", ">", "<", ">", "a", "b", " ", "/", "script", '"', "\n", "é"), { maxLength: 40 }).map((a) => a.join("")),
  );

  test("no queda ninguna etiqueta, solo se quita texto y repetirlo no cambia nada", () => {
    fc.assert(
      fc.property(markup, (s) => {
        const out = stripTags(s);
        assert.doesNotMatch(out, /<[^<>]+>/);
        assert.equal(stripTags(out), out);
        // Lo que queda son caracteres del original, en su orden.
        let at = 0;
        for (const ch of out) {
          at = s.indexOf(ch, at);
          assert.ok(at >= 0);
          at += ch.length;
        }
        if (!s.includes("<") || !s.includes(">")) assert.equal(out, s);
      }),
    );
  });
});
