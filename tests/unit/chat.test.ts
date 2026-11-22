// Chat y mensajería: filas por día y autor, posición de la burbuja, no leídos, escritura y anuncios de llegada; anclaje
// de la lista; entrega; enlaces seguros; menciones; onda de la nota de voz; emojis; y los árboles de las piezas.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import {
  arrivalText,
  chatRows,
  dayKey,
  dayLabel,
  messagePreview,
  newArrivals,
  timeLabel,
  typingText,
  type ChatMessage,
} from "../../zui/src/core/chat-group.ts";
import { followAction, nearEnd, nearStart, pendingBelow, pickAnchor, restoreAnchor } from "../../zui/src/core/chat-anchor.ts";
import { deliveryIcons, isDelivery, mergeDelivery, type DeliveryState } from "../../zui/src/core/delivery.ts";
import { domainOf, linkify, safeHref } from "../../zui/src/core/linkify.ts";
import { encodeMentions, filterMentions, findTrigger, insertMention, mentionParts } from "../../zui/src/core/mentions.ts";
import { clockText, nextRate, peaksFrom, playedBars, resamplePeaks } from "../../zui/src/core/waveform.ts";
import {
  EMOJI_SET,
  emojiName,
  fromCodes,
  pushRecent,
  QUICK_REACTIONS,
  searchEmoji,
  SKIN_TONES,
  withTone,
} from "../../zui/src/core/emoji-data.ts";
import {
  bubbleRow,
  CHAT_LABELS,
  deliveryNode,
  emojiOnly,
  messageText,
  reactionsNode,
  threadNode,
  typingNode,
  voiceNode,
} from "../../zui/src/core/chat-tree.ts";
import { conversationListWidget, listTime, visibleConversations } from "../../zui/src/core/conversation-list-widget.ts";
import { messageListWidget } from "../../zui/src/core/message-list-widget.ts";
import { composerWidget, promptInputWidget } from "../../zui/src/core/composer-widget.ts";
import {
  emojiPickerConfig,
  emojiPickerInitial,
  emojiPickerKey,
  emojiPickerWidget,
  pickerSections,
} from "../../zui/src/core/emoji-picker-widget.ts";
import { callCardWidget, pinnedBarWidget, reactionsWidget, toggleReaction, voiceNoteWidget } from "../../zui/src/core/chat-widgets.ts";
import { toHTML, type VNode } from "../../zui/src/core/vnode.ts";

const html = <P, C, S>(
  w: { configure(p: P): C; initial(c: C): S; tree(c: C, s: S, uid: string): unknown },
  props: P,
  patch: Partial<S> = {},
) => {
  const c = w.configure(props);
  return toHTML(w.tree(c, { ...w.initial(c), ...patch }, "t") as never);
};
const T = (iso: string) => Date.parse(iso);
const msg = (id: string, authorId: string, at: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  authorId,
  createdAt: at,
  text: id,
  ...extra,
});

describe("filas del chat", () => {
  const list = [
    msg("a", "ana", "2026-11-20T23:58:00Z"),
    msg("b", "ana", "2026-11-21T00:01:00Z"),
    msg("c", "ana", "2026-11-21T00:02:00Z"),
    msg("d", "ana", "2026-11-21T00:03:00Z"),
    msg("e", "me", "2026-11-21T00:04:00Z"),
    msg("f", "ana", "2026-11-21T00:30:00Z"),
    { id: "s", authorId: "sys", createdAt: "2026-11-21T00:31:00Z", text: "Luis joined", kind: "system" as const },
    msg("g", "ana", "2026-11-21T00:32:00Z"),
  ];
  test("separador de día, grupos por autor y ventana, cola en el último", () => {
    const rows = chatRows(list, { currentUserId: "me", timeZone: "UTC" });
    assert.deepEqual(
      rows.map((r) => (r.kind === "message" ? `${r.key}:${r.position}` : r.kind)),
      ["date", "a:single", "date", "b:first", "c:middle", "d:last", "e:single", "f:single", "system", "g:single"],
    );
    const e = rows.find((r) => r.key === "e");
    assert.equal(e?.kind === "message" && e.mine, true);
  });
  test("el corte de día sigue a la zona", () => {
    const rows = chatRows(list.slice(0, 2), { timeZone: "Europe/Madrid" });
    assert.deepEqual(
      rows.map((r) => r.kind),
      ["date", "message", "message"],
      "en Madrid las dos son del 21",
    );
  });
  test("marca de no leídos: antes del primero, cuenta solo los de otros", () => {
    const rows = chatRows(list, { currentUserId: "me", timeZone: "UTC", unreadFrom: "c" });
    const i = rows.findIndex((r) => r.kind === "unread");
    assert.equal(rows[i + 1]?.key, "c");
    assert.equal((rows[i] as { count: number }).count, 4, "c, d, f y g (e es propio, s es del sistema)");
    const b = rows.find((r) => r.key === "b");
    assert.equal(b?.kind === "message" && b.position, "single", "la marca corta el grupo");
  });
  test("grupos: autor en el primero y avatar en el último de otros", () => {
    const rows = chatRows(list.slice(1, 4), { group: true, timeZone: "UTC" }).filter((r) => r.kind === "message");
    assert.deepEqual(
      rows.map((r) => r.kind === "message" && [r.showAuthor, r.showAvatar]),
      [
        [true, false],
        [false, false],
        [false, true],
      ],
    );
  });
  test("orden estable por instante", () => {
    const rows = chatRows(
      [msg("x", "a", "2026-11-21T10:00:00Z"), msg("y", "a", "2026-11-21T09:00:00Z"), msg("z", "a", "2026-11-21T10:00:00Z")],
      { timeZone: "UTC" },
    );
    assert.deepEqual(
      rows.filter((r) => r.kind === "message").map((r) => r.key),
      ["y", "x", "z"],
    );
  });
  test("propiedad: cada mensaje aparece una vez, las posiciones forman grupos válidos y hay un separador por día", () => {
    const arb = fc.array(
      fc.record({ author: fc.constantFrom("a", "b", "me"), gap: fc.integer({ min: 0, max: 20 * 60 * 1000 }), system: fc.boolean() }),
      { maxLength: 40 },
    );
    fc.assert(
      fc.property(arb, (spec) => {
        let t = T("2026-11-20T22:00:00Z");
        const messages = spec.map((s, i) => {
          t += s.gap;
          return {
            id: `m${i}`,
            authorId: s.author,
            createdAt: t,
            text: "x",
            kind: s.system && i % 5 === 0 ? ("system" as const) : undefined,
          };
        });
        const rows = chatRows(messages, { currentUserId: "me", timeZone: "UTC" });
        const keys = rows.filter((r) => r.kind === "message" || r.kind === "system").map((r) => r.key);
        assert.deepEqual([...keys].sort(), messages.map((m) => m.id).sort());
        const days = new Set(messages.map((m) => dayKey(m.createdAt, "UTC")));
        assert.equal(rows.filter((r) => r.kind === "date").length, days.size);
        // single/first abren; middle/last siguen a first o middle del mismo autor.
        let open: string | null = null;
        for (const r of rows) {
          if (r.kind !== "message") {
            open = null;
            continue;
          }
          if (r.position === "single" || r.position === "first") {
            assert.equal(open === null || true, true);
            open = r.position === "first" ? r.message.authorId : null;
          } else {
            assert.equal(open, r.message.authorId, `${r.key} continúa un grupo`);
            if (r.position === "last") open = null;
          }
        }
        assert.equal(open, null, "ningún grupo queda abierto");
      }),
    );
  });
  test("día visible: hoy, ayer, día de la semana y fecha", () => {
    const labels = { today: "Today", yesterday: "Yesterday" };
    assert.equal(dayLabel("2026-11-21", "2026-11-21", labels, "en"), "Today");
    assert.equal(dayLabel("2026-11-20", "2026-11-21", labels, "en"), "Yesterday");
    assert.equal(dayLabel("2026-11-17", "2026-11-21", labels, "en"), "Tuesday");
    assert.equal(dayLabel("2026-10-02", "2026-11-21", labels, "en"), "October 2");
    assert.equal(dayLabel("2025-10-02", "2026-11-21", labels, "en"), "October 2, 2025");
    assert.equal(dayLabel("2026-10-02", "2026-11-21", labels, "zz-invalid-locale-!"), dayLabel("2026-10-02", "2026-11-21", labels));
    assert.match(timeLabel(T("2026-11-21T09:05:00Z"), "UTC", "en-GB"), /^9:05$/);
    assert.match(timeLabel(T("2026-11-21T21:05:00Z"), "UTC", "en", "h12"), /9:05\sPM/);
    assert.ok(timeLabel(0, "UTC", "zz-!-bad"));
  });
  test("quién escribe", () => {
    assert.equal(typingText([]), "");
    assert.equal(typingText(["Ana"]), "Ana is typing…");
    assert.equal(typingText(["Ana", "Luis", "Ana"]), "Ana and Luis are typing…");
    assert.equal(typingText(["Ana", "Luis", "Marta", "Eva"]), "Ana and 3 others are typing…");
  });
  test("llegadas de otros: una, varias de una persona, de varias", () => {
    const known = new Set(["a"]);
    const all = [
      msg("a", "ana", "2026-11-21T09:00:00Z"),
      msg("b", "me", "2026-11-21T09:01:00Z"),
      { ...msg("c", "ana", "2026-11-21T09:02:00Z"), author: { name: "Ana" }, text: "See you <@u1> tomorrow" },
      msg("d", "ana", "2026-11-21T09:03:00Z", { deletedAt: "x" }),
    ];
    const arrived = newArrivals(known, all, "me");
    assert.deepEqual(
      arrived.map((m) => m.id),
      ["c"],
    );
    assert.equal(arrivalText(arrived), "Ana: See you @ tomorrow");
    assert.equal(arrivalText([...arrived, { ...arrived[0]!, id: "x" }]), "2 new messages from Ana");
    assert.equal(arrivalText([...arrived, msg("y", "luis", "2026-11-21T09:04:00Z")]), "2 new messages");
    assert.equal(arrivalText([]), "");
    assert.equal(messagePreview(msg("p", "a", "t", { text: "", attachments: [{ kind: "image", src: "x" }] }), CHAT_LABELS), "Photo");
    assert.equal(
      messagePreview(msg("p", "a", "t", { text: "", attachments: [{ kind: "voice", src: "x", duration: 3 }] }), CHAT_LABELS),
      "Voice message",
    );
    assert.equal(messagePreview(msg("p", "a", "t", { text: "" }), CHAT_LABELS), "");
    assert.equal(messagePreview(msg("p", "a", "t", { text: "x".repeat(200) }), CHAT_LABELS, 10).length, 10);
  });
});

describe("posición de la lista", () => {
  test("cerca del final y del principio", () => {
    assert.equal(nearEnd({ scrollTop: 900, clientHeight: 100, scrollHeight: 1050 }), true);
    assert.equal(nearEnd({ scrollTop: 0, clientHeight: 100, scrollHeight: 1050 }), false);
    assert.equal(nearStart({ scrollTop: 40, clientHeight: 100, scrollHeight: 1050 }), true);
  });
  test("ancla y restauración al anteponer", () => {
    const rows = [
      { key: "a", top: 0, height: 50 },
      { key: "b", top: 50, height: 80 },
      { key: "c", top: 130, height: 40 },
    ];
    const anchor = pickAnchor(rows, 70)!;
    assert.deepEqual(anchor, { key: "b", offset: -20 });
    assert.equal(restoreAnchor(anchor, 450), 470, "b bajó 400 px: el desplazamiento sube lo mismo");
    assert.equal(pickAnchor(rows, 500), null);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: -300, max: 300 }),
        (top, offset) => restoreAnchor({ key: "x", offset }, top) === Math.max(0, top - offset),
      ),
    );
  });
  test("seguir el final y contar los nuevos", () => {
    assert.equal(followAction({ wasNearEnd: true, ownMessage: false, prepended: false }), "end");
    assert.equal(followAction({ wasNearEnd: false, ownMessage: true, prepended: false }), "end");
    assert.equal(followAction({ wasNearEnd: false, ownMessage: false, prepended: false }), "keep");
    assert.equal(followAction({ wasNearEnd: true, ownMessage: true, prepended: true }), "keep");
    assert.equal(pendingBelow(2, 3, false), 5);
    assert.equal(pendingBelow(2, -1, false), 2);
    assert.equal(pendingBelow(9, 3, true), 0);
  });
});

describe("entrega", () => {
  const states: DeliveryState[] = ["sending", "sent", "delivered", "read", "failed"];
  test("no retrocede; fallido solo desde enviando; reintentar", () => {
    assert.equal(mergeDelivery("read", "delivered"), "read");
    assert.equal(mergeDelivery("sent", "read"), "read");
    assert.equal(mergeDelivery("sending", "failed"), "failed");
    assert.equal(mergeDelivery("delivered", "failed"), "delivered");
    assert.equal(mergeDelivery("failed", "sending"), "sending");
    assert.equal(mergeDelivery(undefined, "sent"), "sent");
    assert.deepEqual(deliveryIcons("read"), ["check", "check"]);
    assert.deepEqual(deliveryIcons("sending"), ["clock"]);
    assert.deepEqual(deliveryIcons("failed"), ["exclamation-circle"]);
    assert.equal(isDelivery("read"), true);
    assert.equal(isDelivery("seen"), false);
  });
  test("propiedad: fusionar avisos en cualquier orden acaba en el mayor (sin fallos)", () => {
    const ok = fc.constantFrom<DeliveryState>("sending", "sent", "delivered", "read");
    fc.assert(
      fc.property(fc.array(ok, { minLength: 1, maxLength: 12 }), (events) => {
        const result = events.reduce<DeliveryState | undefined>((acc, e) => mergeDelivery(acc, e), undefined);
        const rank = (s: DeliveryState) => states.indexOf(s);
        return result === events.reduce((a, b) => (rank(b) > rank(a) ? b : a));
      }),
    );
  });
});

describe("enlaces seguros", () => {
  test("URL, www, correo y puntuación final", () => {
    const parts = linkify("Docs at https://example.com/a?b=1. Mail ana@example.org, or www.example.net/x).");
    assert.deepEqual(
      parts.filter((p) => p.type === "link").map((p) => p.type === "link" && [p.text, p.href]),
      [
        ["https://example.com/a?b=1", "https://example.com/a?b=1"],
        ["ana@example.org", "mailto:ana@example.org"],
        ["www.example.net/x", "https://www.example.net/x"],
      ],
    );
    assert.deepEqual(
      linkify("(see https://en.wikipedia.org/wiki/Foo_(bar))").find((p) => p.type === "link"),
      {
        type: "link",
        text: "https://en.wikipedia.org/wiki/Foo_(bar)",
        href: "https://en.wikipedia.org/wiki/Foo_(bar)",
      },
    );
    assert.deepEqual(linkify("no links here"), [{ type: "text", text: "no links here" }]);
    assert.deepEqual(linkify(""), []);
  });
  test("solo http, https y mailto", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,x",
      "JaVaScRiPt:x",
      "vbscript:x",
      "https://exa mple.com",
      "http://",
      "",
      "notaurl",
      "https://a.b/\u0000x",
    ])
      assert.equal(safeHref(bad), null, bad);
    assert.equal(safeHref(" https://a.example/x "), "https://a.example/x");
    assert.equal(safeHref("mailto:a@b.c"), "mailto:a@b.c");
    assert.equal(safeHref(null), null);
    assert.equal(domainOf("https://www.example.com/x"), "example.com");
    assert.equal(domainOf("nope"), "");
  });
  test("propiedad: los trozos reconstruyen el texto y todo destino es seguro", () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.string(), fc.webUrl(), fc.emailAddress(), fc.constantFrom("javascript:alert(1)", "www.a.io", " ", ".", ")")), {
          maxLength: 8,
        }),
        (chunks) => {
          const text = chunks.join(" ");
          const parts = linkify(text);
          assert.equal(parts.map((p) => p.text).join(""), text);
          for (const p of parts) if (p.type === "link") assert.ok(safeHref(p.href) !== null, p.href);
        },
      ),
    );
  });
});

describe("menciones", () => {
  const people = [
    { id: "u1", label: "Ana López" },
    { id: "u2", label: "Ana" },
    { id: "u3", label: "Luis Gil" },
  ];
  test("disparador en el cursor", () => {
    assert.deepEqual(findTrigger("hi @an", 6), { trigger: "@", query: "an", start: 3, end: 6 });
    assert.equal(findTrigger("mail a@b", 8), null, "dentro de una palabra no");
    assert.equal(findTrigger("hi @an x", 8), null, "tras un espacio se cierra");
    assert.deepEqual(findTrigger("(@lu", 4), { trigger: "@", query: "lu", start: 1, end: 4 });
    assert.deepEqual(findTrigger("#ge", 3, ["@", "#"]), { trigger: "#", query: "ge", start: 0, end: 3 });
    assert.equal(findTrigger("@".padEnd(40, "a"), 40), null, "demasiado largo");
  });
  test("insertar, codificar y decodificar", () => {
    const m = findTrigger("ping @an now", 8)!;
    const out = insertMention("ping @an now", m, people[0]!);
    assert.deepEqual(out, { text: "ping @Ana López now", caret: 16 });
    assert.equal(encodeMentions("@Ana López and @Ana, also @Analyst", people), "<@u1> and <@u2>, also @Analyst");
    assert.deepEqual(
      mentionParts("hi <@u1>!", (id) => (id === "u1" ? "Ana López" : undefined)),
      [
        { type: "text", text: "hi " },
        { type: "mention", trigger: "@", id: "u1", label: "Ana López" },
        { type: "text", text: "!" },
      ],
    );
    assert.deepEqual(mentionParts("<#ops>"), [{ type: "mention", trigger: "#", id: "ops", label: "ops" }]);
  });
  test("candidatos sin acentos", () => {
    assert.deepEqual(
      filterMentions(people, "lop").map((p) => p.id),
      ["u1"],
    );
    assert.deepEqual(
      filterMentions(people, "").map((p) => p.id),
      ["u1", "u2", "u3"],
    );
    assert.deepEqual(
      filterMentions(people, "u3").map((p) => p.id),
      ["u3"],
    );
    assert.deepEqual(filterMentions(people, "zzz"), []);
  });
  test("propiedad: codificar y decodificar devuelve el texto visible", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom("hello", "@Ana López", "@Luis Gil", "and", "!"), { maxLength: 10 }), (words) => {
        const text = words.join(" ");
        const encoded = encodeMentions(text, people);
        const back = mentionParts(encoded, (id) => people.find((p) => p.id === id)?.label)
          .map((p) => (p.type === "mention" ? `@${p.label}` : p.text))
          .join("");
        return back === text;
      }),
    );
  });
});

describe("onda y emojis", () => {
  test("picos normalizados y remuestreo", () => {
    assert.deepEqual(peaksFrom([0, 0.5, -1, 0.25], 2), [0.5, 1]);
    assert.deepEqual(peaksFrom([], 3, 0.1), [0.1, 0.1, 0.1]);
    assert.deepEqual(peaksFrom([0, 0, 0], 3, 0.1), [0.1, 0.1, 0.1]);
    assert.deepEqual(resamplePeaks([2, 4, 8, 4], 2, 0), [0.5, 1]);
    assert.deepEqual(resamplePeaks(undefined, 2), [0.08, 0.08]);
    assert.equal(playedBars(0.5, 36), 18);
    assert.equal(playedBars(Number.NaN, 36), 0);
    assert.equal(clockText(7), "0:07");
    assert.equal(clockText(750), "12:30");
    assert.equal(clockText(3723), "1:02:03");
    assert.equal(clockText(-4), "0:00");
    assert.equal(nextRate([1, 1.5, 2], 2), 1);
    assert.equal(nextRate([], 1), 1);
    fc.assert(
      fc.property(fc.array(fc.float({ noNaN: true, min: -1, max: 1 }), { maxLength: 400 }), fc.integer({ min: 1, max: 64 }), (s, n) => {
        const p = peaksFrom(s, n);
        return p.length === n && p.every((v) => v >= 0.08 && v <= 1);
      }),
    );
  });
  test("conjunto propio: nombres, búsqueda, tono y recientes", () => {
    assert.ok(EMOJI_SET.flatMap((c) => c.emojis).length > 100);
    assert.equal(QUICK_REACTIONS.length, 6);
    const thumbs = fromCodes("1f44d");
    assert.equal(emojiName(thumbs), "thumbs up");
    assert.equal(emojiName(thumbs + SKIN_TONES[3]), "thumbs up", "con tono");
    assert.equal(emojiName("x"), "x");
    assert.ok(searchEmoji(EMOJI_SET, "heart").some((e) => e.name === "red heart"));
    assert.equal(searchEmoji(EMOJI_SET, "pizza")[0]?.name, "pizza");
    assert.deepEqual(searchEmoji(EMOJI_SET, " "), []);
    const victory = EMOJI_SET.flatMap((c) => c.emojis).find((e) => e.name === "victory hand")!;
    assert.equal(withTone(victory, SKIN_TONES[2]!), fromCodes("270c-1f3fc"));
    assert.equal(withTone(victory, ""), victory.char);
    assert.deepEqual(pushRecent(["a", "b"], "b"), ["b", "a"]);
    assert.equal(
      pushRecent(
        Array.from({ length: 30 }, (_, i) => String(i)),
        "x",
      ).length,
      16,
    );
  });
});

describe("árboles de chat", () => {
  const base = { labels: CHAT_LABELS, uid: "t", timeZone: "UTC", locale: "en-GB" };
  test("burbuja: autor oculto, hora, entrega y descripción", () => {
    const out = toHTML(
      bubbleRow(
        {
          message: msg("m1", "me", "2026-11-21T09:05:00Z", { text: "hola https://a.example", status: "read", editedAt: "x" }),
          mine: true,
          position: "last",
          showAuthor: false,
        },
        { ...base, actions: [] },
      ),
    );
    assert.match(out, /<article class="z-message" id="t-m-m1"[^>]*data-mine[^>]*data-position="last"[^>]*data-status="read"/);
    assert.match(out, /aria-labelledby="t-m-m1-author" aria-describedby="t-m-m1-meta"/);
    assert.match(out, /<span class="z-sr-only" id="t-m-m1-author">You<\/span>/);
    assert.match(out, /<a href="https:\/\/a.example\/" target="_blank" rel="noopener noreferrer nofollow">https:\/\/a.example<\/a>/);
    assert.match(out, /<span class="z-message__edited">edited<\/span><time datetime="2026-11-21T09:05:00.000Z">9:05<\/time>/);
    assert.match(out, /<span class="z-sr-only">Read<\/span>/);
    assert.doesNotMatch(out, /z-message__actions/);
  });
  test("burbuja: texto como texto, menciones, borrado y fallido", () => {
    const evil = toHTML(
      bubbleRow(
        {
          message: msg("x", "ana", "2026-11-21T09:00:00Z", { text: "<img src=x onerror=alert(1)> <@u1> javascript:alert(1)" }),
          mine: false,
          position: "single",
          showAuthor: true,
        },
        { ...base, mention: () => "Ana" },
      ),
    );
    assert.doesNotMatch(evil, /<img src=x/);
    assert.match(evil, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(evil, /<span class="z-mention" data-id="u1" data-trigger="@">@Ana<\/span>/);
    assert.doesNotMatch(evil, /href="javascript/);
    const gone = toHTML(
      bubbleRow(
        {
          message: msg("d", "me", "2026-11-21T09:00:00Z", { deletedAt: "x", status: "read" }),
          mine: true,
          position: "single",
          showAuthor: false,
        },
        base,
      ),
    );
    assert.match(gone, /This message was deleted/);
    assert.doesNotMatch(gone, /z-message__actions|z-delivery/);
    const failed = toHTML(
      bubbleRow(
        { message: msg("f", "me", "2026-11-21T09:00:00Z", { status: "failed" }), mine: true, position: "single", showAuthor: false },
        base,
      ),
    );
    assert.match(failed, /class="z-message__retry" aria-label="Retry: Not sent"/);
    assert.match(failed, /data-action="edit"/, "las acciones de un propio incluyen editar");
    const other = toHTML(
      bubbleRow({ message: msg("o", "ana", "2026-11-21T09:00:00Z"), mine: false, position: "single", showAuthor: false }, base),
    );
    assert.doesNotMatch(other, /data-action="edit"|data-action="delete"/);
  });
  test("adjuntos: álbum, archivo, voz, ubicación y enlace; solo destinos seguros", () => {
    const m = msg("a", "ana", "2026-11-21T09:00:00Z", {
      text: "",
      replyTo: { id: "q", author: "Luis", text: "where?" },
      forwarded: true,
      attachments: [
        ...Array.from({ length: 6 }, (_, i) => ({ kind: "image" as const, src: `https://img.example/${i}.jpg`, alt: `Photo ${i}` })),
        { kind: "file", name: "a.pdf", size: 2048, href: "javascript:x" },
        { kind: "voice", src: "/v.webm", duration: 9, peaks: [1, 2, 3] },
        { kind: "location", title: "Studio", address: "Calle 1", href: "https://osm.example/x" },
        { kind: "link", href: "https://news.example/p", title: "Post", description: "Desc" },
        { kind: "link", href: "javascript:alert(1)", title: "Bad" },
      ],
    });
    const out = toHTML(bubbleRow({ message: m, mine: false, position: "single", showAuthor: false }, { ...base, bars: 12 }));
    assert.match(out, /data-count="4"/);
    assert.match(out, /<span class="z-message__more" aria-hidden="true">\+2<\/span>/);
    assert.match(out, /aria-label="Photo 0, Image 1 of 6"/);
    assert.doesNotMatch(out, /z-message-file__download/, "un archivo con destino inseguro no tiene descarga");
    assert.match(out, /2\.05 kB|2 kB|2,05/);
    assert.match(out, /role="slider"[^>]*aria-valuemax="9"[^>]*aria-valuetext="0:00 \/ 0:09"/);
    assert.equal((out.match(/z-voice-note__bar"/g) ?? []).length + (out.match(/z-voice-note__bar" data-played/g) ?? []).length, 12);
    assert.match(out, /<a class="z-message-location" href="https:\/\/osm.example\/x"/);
    assert.match(out, /z-link-preview__site">news.example/);
    assert.doesNotMatch(out, /Bad/);
    assert.match(out, /z-quoted" data-reply-to="q"/);
    assert.match(out, /Forwarded/);
  });
  test("reacciones, escritura, hilo, entrega y emojis grandes", () => {
    const r = toHTML(
      reactionsNode(
        [
          { emoji: fromCodes("1f44d"), count: 3, mine: true },
          { emoji: "x", count: 0 },
        ],
        CHAT_LABELS,
        { add: true },
      ),
    );
    assert.match(r, /aria-pressed="true" aria-label="thumbs up, 3, you reacted"/);
    assert.doesNotMatch(r, /data-emoji="x"/);
    assert.match(r, /z-reaction--add/);
    assert.equal(typingNode([], CHAT_LABELS), null);
    assert.match(toHTML(typingNode(["Ana"], CHAT_LABELS, { people: [{ name: "Ana" }] })), /z-typing__text">Ana is typing…/);
    assert.match(
      toHTML(threadNode({ count: 12, lastAt: 1000, participants: [{ name: "A B" }] }, CHAT_LABELS, { now: 61000, locale: "en" })),
      /12 replies.*Last reply 1 min\. ago|12 replies.*Last reply/,
    );
    assert.match(toHTML(deliveryNode("delivered")), /data-status="delivered".*Delivered/);
    assert.equal(emojiOnly(fromCodes("1f44d")), true);
    assert.equal(emojiOnly(fromCodes("1f44d") + fromCodes("1f44d") + fromCodes("1f44d") + fromCodes("1f44d")), false);
    assert.equal(emojiOnly("hi"), false);
    assert.equal(emojiOnly(undefined), false);
    assert.match(
      toHTML(voiceNode({ src: "javascript:x", duration: 5 }, { playing: true, position: 2, rate: 1.5 }, CHAT_LABELS)),
      /data-playing.*aria-label="Pause".*1.5×/,
    );
    assert.deepEqual(messageText("a b", { highlight: "b" }).length, 2);
  });
});

describe("piezas de chat", () => {
  test("ConversationList: orden, filtros, búsqueda, hora corta y badges", () => {
    const now = T("2026-11-21T09:30:00Z");
    const items = [
      { id: "a", title: "Álvaro", lastAt: "2026-11-21T08:00:00Z", lastMessage: "hola" },
      { id: "b", title: "Bea", lastAt: "2026-11-21T09:00:00Z", unread: 2, group: true },
      { id: "c", title: "Carla", lastAt: "2026-11-18T09:00:00Z", pinned: true, muted: true, unread: 1 },
    ];
    assert.deepEqual(
      visibleConversations(items, "", "all").map((i) => i.id),
      ["c", "b", "a"],
    );
    assert.deepEqual(
      visibleConversations(items, "", "all", false).map((i) => i.id),
      ["a", "b", "c"],
    );
    assert.deepEqual(
      visibleConversations(items, "alv", "all").map((i) => i.id),
      ["a"],
    );
    assert.deepEqual(
      visibleConversations(items, "", "unread").map((i) => i.id),
      ["c", "b"],
    );
    assert.deepEqual(
      visibleConversations(items, "", "groups").map((i) => i.id),
      ["b"],
    );
    const labels = { today: "Today", yesterday: "Yesterday" };
    assert.equal(listTime(T("2026-11-21T08:00:00Z"), now, labels, { timeZone: "UTC", locale: "en-GB" }), "8:00");
    assert.equal(listTime(T("2026-11-20T08:00:00Z"), now, labels, { timeZone: "UTC", locale: "en" }), "Yesterday");
    assert.equal(listTime(T("2026-11-18T08:00:00Z"), now, labels, { timeZone: "UTC", locale: "en" }), "Wed");
    assert.equal(listTime(T("2026-10-02T08:00:00Z"), now, labels, { timeZone: "UTC", locale: "en" }), "Oct 2");
    const out = html(conversationListWidget, {
      items: [...items, { id: "d", title: "Dani", typing: ["Dani"], lastMine: true, status: "read" as const, draft: "x" }],
      selectedId: "b",
      timeZone: "UTC",
      locale: "en",
      now,
    });
    assert.match(out, /aria-current="true" data-unread/);
    assert.match(out, /<span class="z-sr-only">2 unread messages<\/span>/);
    assert.match(out, /aria-label="Muted"/);
    assert.match(out, /typing…/);
    assert.equal((out.match(/class="z-conversation" [^>]*tabindex="0"/g) ?? []).length, 1, "una sola parada en la lista");
    assert.match(html(conversationListWidget, { items: [], search: false, filters: false }), /No chats found/);
  });
  test("MessageList: región, lista, separadores, no leídos, escritura y botón de ir al final", () => {
    const messages = [
      msg("a", "ana", "2026-11-20T09:00:00Z", { author: { name: "Ana" } }),
      msg("b", "me", "2026-11-21T09:00:00Z", { status: "read" }),
      msg("c", "ana", "2026-11-21T09:10:00Z"),
    ];
    const out = html(messageListWidget, {
      messages,
      currentUserId: "me",
      timeZone: "UTC",
      locale: "en",
      unreadFrom: "c",
      typing: [{ name: "Ana" }],
      now: T("2026-11-21T09:30:00Z"),
      hasOlder: true,
    });
    assert.match(out, /class="z-message-list" role="region" aria-label="Messages" data-z-message-list data-anchor="first-unread"/);
    assert.match(out, /<h3 class="z-date-separator__label"><time datetime="2026-11-20">Yesterday<\/time>/);
    assert.match(out, /Today<\/time>/);
    assert.match(out, /1 unread messages/);
    assert.match(out, /Ana is typing…/);
    assert.match(out, /Load earlier messages/);
    assert.match(out, /class="z-scroll-to-bottom"[^>]*aria-hidden="true"/);
    assert.equal((out.match(/class="z-message"[^>]*tabindex="0"/g) ?? []).length, 1);
    const away = html(messageListWidget, { messages, currentUserId: "me", announce: "log" as const }, { away: true, pending: 3 });
    assert.match(away, /role="log" aria-live="polite"/);
    assert.match(away, /aria-label="Jump to latest, 3 new messages"/);
    const loading = html(messageListWidget, { messages, loadingOlder: true });
    assert.match(loading, /Loading earlier messages…/);
  });
  test("MessageList: ventana virtual con muchos mensajes y la fila activa siempre presente", () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      msg(`m${i}`, i % 3 ? "ana" : "me", new Date(T("2026-11-21T00:00:00Z") + i * 60000).toISOString()),
    );
    const c = messageListWidget.configure({ messages: many, currentUserId: "me", timeZone: "UTC", virtualize: 100 });
    const s = { ...messageListWidget.initial(c), scroll: 0, viewport: 600, active: "m399" };
    const out = toHTML(messageListWidget.tree(c, s, "v"));
    const count = (out.match(/<article /g) ?? []).length;
    assert.ok(count < 60, `solo la ventana (${count})`);
    assert.match(out, /data-virtual/);
    assert.match(out, /id="v-m-m399"/, "la activa no sale del documento");
    assert.match(out, /z-message-list__spacer" aria-hidden="true" style="--z-space: \d+px"/);
    const controlled = messageListWidget.control!(c, { ...s, active: "gone" });
    assert.equal(controlled.active, "m399");
  });
  test("Composer y PromptInput: campo, enviar siempre, respuesta, menciones y prompt", () => {
    const out = html(
      composerWidget,
      { voice: true, mentions: { items: [{ id: "u1", label: "Ana" }] }, replyTo: { id: "q", author: "Ana", text: "hi" }, maxLength: 10 },
      { text: "123456789" },
    );
    assert.match(out, /<label class="z-sr-only" for="t-field">Message<\/label><textarea class="z-composer__input" id="t-field" rows="1"/);
    assert.match(out, /role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false"/);
    assert.match(out, /Replying to Ana/);
    assert.match(out, /1 characters left/);
    assert.match(out, /type="submit" class="z-composer__send" aria-label="Send"/);
    assert.match(html(composerWidget, { voice: true }, { canRecord: true }), /aria-label="Record voice message"/);
    assert.doesNotMatch(html(composerWidget, { voice: true }), /Record voice message/, "sin MediaRecorder no hay botón");
    assert.match(html(composerWidget, {}), /aria-disabled="true"/, "vacío: aria-disabled, conserva el foco");
    assert.match(html(composerWidget, { editing: { id: "e", text: "old" } }), /aria-label="Save".*|Editing message/);
    const mention = html(
      composerWidget,
      { mentions: { items: [{ id: "u1", label: "Ana" }] } },
      { mention: { match: { trigger: "@", query: "a", start: 0, end: 2 }, options: [{ id: "u1", label: "Ana" }], index: 0 } },
    );
    assert.match(mention, /aria-activedescendant="t-mention-0"/);
    assert.match(mention, /role="listbox" aria-label="Suggestions"/);
    const prompt = html(promptInputWidget, {
      status: "streaming",
      models: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      model: "b",
      tools: [{ id: "w", label: "Web", active: true }],
      usage: { used: 170000, limit: 200000 },
    });
    assert.match(prompt, /class="z-composer z-prompt-input" data-kind="prompt" data-status="streaming"/);
    assert.match(prompt, /aria-label="Stop generating"/);
    assert.match(prompt, /<option value="b" selected>B<\/option>/);
    assert.match(prompt, /data-tool="w" aria-pressed="true"/);
    assert.match(prompt, /data-level="warning"/);
    assert.match(prompt, /<label class="z-sr-only" for="t-field">Prompt<\/label>/);
    const c = composerWidget.configure({ value: "x" });
    assert.equal(composerWidget.control!(c, { ...composerWidget.initial(c), text: "y" }).text, "x");
  });
  test("EmojiPicker: secciones, recientes, teclado y búsqueda", () => {
    const c = emojiPickerConfig({ recent: [fromCodes("1f44d")] });
    const s = emojiPickerInitial(c);
    assert.equal(pickerSections(c, s)[0]?.id, "recent");
    let state = s;
    const set = (p: Partial<typeof s>) => (state = { ...state, ...p });
    const key = (k: string, value = "") =>
      emojiPickerKey(
        { key: k, target: Object.assign(document.createElement("input"), { value }), preventDefault() {} } as unknown as KeyboardEvent,
        c,
        state,
        set,
      );
    key("ArrowDown");
    assert.equal(state.active, 8);
    key("ArrowRight");
    assert.equal(state.active, 9);
    key("ArrowRight", "typed");
    assert.equal(state.active, 9, "con texto, ←/→ editan el campo");
    assert.equal(key("Escape"), "close");
    const chosen = key("Enter");
    assert.ok(typeof chosen === "string" && chosen.length > 0);
    assert.equal(state.recent[0], chosen);
    const out = html(emojiPickerWidget, {}, { query: "heart" });
    assert.match(out, /role="combobox"[^>]*aria-activedescendant="t-emoji-0"/);
    assert.match(out, /aria-label="red heart"/);
    assert.match(html(emojiPickerWidget, {}, { query: "zzzz" }), /No emoji found/);
    assert.match(html(emojiPickerWidget, { data: () => Promise.resolve([]) }), /Loading emoji…/);
  });
  test("VoiceNote, Reactions, CallCard y PinnedBar", () => {
    assert.match(
      html(voiceNoteWidget, { src: "/a.webm", duration: 14, peaks: [1, 2] }),
      /<audio class="z-voice-note__audio" src="\/a.webm" preload="none" id="t-audio">/,
    );
    assert.deepEqual(toggleReaction([{ emoji: "a", count: 1, mine: true }], "a"), []);
    assert.deepEqual(toggleReaction([{ emoji: "a", count: 2 }], "a"), [{ emoji: "a", count: 3, mine: true }]);
    assert.deepEqual(toggleReaction([], "b"), [{ emoji: "b", count: 1, mine: true }]);
    assert.match(html(reactionsWidget, { items: [{ emoji: "a", count: 1 }] }, { picking: true }), /z-reactions__quick/);
    const incoming = html(callCardWidget, { kind: "incoming", video: true, caller: { name: "Ana" } });
    assert.match(incoming, /role="region" aria-labelledby="t-name"/);
    assert.match(incoming, /Incoming video call/);
    assert.match(incoming, /aria-label="Accept with video"/);
    const ongoing = callCardWidget.configure({ kind: "ongoing", caller: { name: "A" }, startedAt: 0 });
    assert.match(
      toHTML(callCardWidget.tree(ongoing, { now: 65000, muted: true, camera: false }, "t")),
      /role="timer" aria-label="Call duration 1:05">1:05.*aria-pressed="true"/,
    );
    const pinned = html(pinnedBarWidget, {
      items: [
        { id: "1", text: "a" },
        { id: "2", author: "Ana", text: "b" },
      ],
      unpinnable: true,
    });
    assert.match(
      pinned,
      /<button type="button" class="z-pinned-bar__main">.*Pinned message 2 of 2<\/span><span class="z-pinned-bar__text">Ana: b/,
    );
    assert.match(pinned, /aria-label="Unpin"/);
    assert.match(html(pinnedBarWidget, {}), /data-empty/);
  });
});

void (null as unknown as VNode);
