// Avisos (core/notifications y la pieza NotificationCenter): contador con tope, no leídos con lo marcado en la vista,
// agrupación por día civil en una zona horaria, avisos nuevos; el árbol de la pieza, su interacción en el modo DOM
// sobre un DOM mínimo y el marcado de NotificationBadge.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import "../../zicon/src/all.ts";
import { notificationCenterWidget } from "../../zui/src/core/notification-center-widget.ts";
import {
  arrivals,
  badgeText,
  dayKey,
  groupByDay,
  isRead,
  notificationTime,
  unreadCount,
  type NotificationItem,
} from "../../zui/src/core/notifications.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";
import { NotificationBadge } from "../../zui/src/components/feedback/NotificationBadge.tsx";
import { render } from "./helpers/react.mjs";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261123), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300) });

const NOW = Date.parse("2026-11-23T12:00:00Z");
const ITEMS: NotificationItem[] = [
  {
    id: "a",
    title: "Booked",
    time: "2026-11-23T10:00:00Z",
    actions: [{ id: "view", label: "View" }],
    tone: "accent",
    icon: "calendar-days",
  },
  { id: "b", title: "Payout", time: "2026-11-23T11:00:00Z", href: "#p" },
  { id: "c", title: "Review", time: "2026-11-22T19:00:00Z", read: true },
  { id: "d", title: "Sync", time: "2026-11-18T07:00:00Z", read: true, tone: "nope" as never },
  { id: "e", title: "Old", time: "2025-12-31T23:30:00Z", read: true },
];

describe("contador y no leídos", () => {
  test("texto con tope y vacío sin avisos", () => {
    assert.equal(badgeText(0), "");
    assert.equal(badgeText(-2), "");
    assert.equal(badgeText(Number.NaN), "");
    assert.equal(badgeText(7), "7");
    assert.equal(badgeText(100), "99+");
    assert.equal(badgeText(1500, 999, "en-US"), "999+");
    assert.equal(badgeText(5, 0), "1+");
  });
  test("lo marcado en la vista manda sobre la aplicación", () => {
    assert.equal(unreadCount(ITEMS), 2);
    assert.equal(unreadCount(ITEMS, { a: true, c: false }), 2);
    assert.equal(isRead(ITEMS[0]!, { a: true }), true);
    assert.deepEqual(
      arrivals(ITEMS, new Set(["a"])).map((n) => n.id),
      ["b"],
    );
  });
  test("propiedad: no leídos + leídos = total", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.uuid(), read: fc.boolean() }), { maxLength: 30 }),
        fc.dictionary(fc.uuid(), fc.boolean()),
        (raw, overrides) => {
          const items = raw.map((r) => ({ ...r, title: "t", time: 0 }));
          const read = items.filter((n) => isRead(n, overrides)).length;
          assert.equal(unreadCount(items, overrides) + read, items.length);
        },
      ),
    );
  });
});

describe("agrupación por día", () => {
  test("hoy, ayer, fecha y año solo si no es el actual, en la zona pedida", () => {
    const groups = groupByDay(ITEMS, { now: NOW, timeZone: "UTC", locale: "en-US" });
    assert.deepEqual(
      groups.map((g) => [g.key, g.label, g.items.map((n) => n.id).join("")]),
      [
        ["2026-11-23", "Today", "ba"],
        ["2026-11-22", "Yesterday", "c"],
        ["2026-11-18", "Wednesday, November 18", "d"],
        ["2025-12-31", "Wednesday, December 31, 2025", "e"],
      ],
    );
    // En Tokio, las 23:30 UTC del 31 ya son el 1 de enero.
    assert.equal(dayKey(Date.parse("2025-12-31T23:30:00Z"), "Asia/Tokyo"), "2026-01-01");
    assert.equal(dayKey(0, "Not/AZone"), dayKey(0));
    const odd = groupByDay([{ time: "nope" }, { time: NOW }], { now: NOW, timeZone: "UTC", today: "Hoy" });
    assert.deepEqual(
      odd.map((g) => g.label),
      ["Hoy", ""],
    );
    assert.equal(notificationTime(NOW, { locale: "en-US", timeZone: "UTC" }), "12:00 PM");
    assert.equal(notificationTime(NOW, { locale: "en-US", timeZone: "Not/AZone" }).length > 0, true);
    assert.equal(notificationTime(Number.NaN, {}), "");
  });
  test("propiedad: los grupos reparten todos los avisos, del más reciente al más antiguo, sin repetir día", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 4e12 }), { maxLength: 40 }),
        fc.constantFrom("UTC", "America/Caracas", "Asia/Tokyo"),
        (times, timeZone) => {
          const items = times.map((time, i) => ({ id: String(i), time }));
          const groups = groupByDay(items, { now: NOW, timeZone });
          const flat = groups.flatMap((g) => g.items.map((n) => n.time as number));
          assert.equal(flat.length, items.length);
          for (let i = 1; i < flat.length; i++) assert.ok(flat[i - 1]! >= flat[i]!);
          assert.equal(new Set(groups.map((g) => g.key)).size, groups.length);
          for (const g of groups) for (const n of g.items) assert.equal(dayKey(n.time as number, timeZone), g.key);
        },
      ),
    );
  });
});

describe("NotificationCenter", () => {
  const c = notificationCenterWidget.configure({ notifications: ITEMS, now: NOW, timeZone: "UTC", locale: "en-US", viewAllHref: "#all" });
  test("árbol: campana con recuento, días con encabezado, acciones, leído con nombre propio y vacío", () => {
    const s = notificationCenterWidget.initial(c);
    const html = toHTML(notificationCenterWidget.tree(c, s, "nc"));
    assert.match(html, /aria-label="Notifications, 2 unread"/);
    assert.match(html, /<span class="z-notification-badge" data-tone="danger" aria-hidden="true">2<\/span>/);
    assert.match(html, /popover="auto" role="dialog" aria-labelledby="nc-title"/);
    assert.match(html, /<h3 class="z-notification-center__day" id="nc-d-2026-11-23">Today<\/h3>/);
    assert.match(html, /<span class="z-sr-only">Unread: <\/span><a class="z-notification__title" id="nc-n-b" href="#p">Payout<\/a>/);
    assert.match(html, /data-action="view" data-notification="a">View</);
    assert.match(html, /aria-label="Mark “Review” as unread"/);
    assert.match(html, /data-tone="neutral"><z-icon name="bell"/, "tono desconocido: neutro");
    assert.match(html, /href="#all">View all</);
    const empty = notificationCenterWidget.configure({ notifications: [] });
    const none = toHTML(notificationCenterWidget.tree(empty, notificationCenterWidget.initial(empty), "e"));
    assert.match(none, /You're all caught up/);
    assert.match(none, /aria-label="Notifications"/);
    assert.match(none, /data-read-all aria-disabled="true"/);
    assert.doesNotMatch(none, /z-notification-badge/);
    // Lo marcado deja de mandar cuando la aplicación ya coincide o el aviso se fue.
    const marked = { open: false, read: { a: true, c: true, zz: true } };
    assert.deepEqual(notificationCenterWidget.control!(c, marked).read, { a: true });
    const same = { open: false, read: { a: true } };
    assert.equal(notificationCenterWidget.control!(c, same), same);
  });
  test("interacción: marcar leído, marcar todo, acción, avisos nuevos y props desde atributos", async () => {
    let config = c;
    let state = notificationCenterWidget.initial(config);
    const events: [string, unknown][] = [];
    const root = document.createElement("div");
    root.className = "z-notification-center";
    document.body.append(root);
    // Repinta los hijos de la raíz como hace el modo DOM (la raíz y sus listeners se quedan).
    const paint = () => {
      state = notificationCenterWidget.control!(config, state);
      root.innerHTML = (notificationCenterWidget.tree(config, state, "nc").c ?? []).map((n) => toHTML(n)).join("");
      notificationCenterWidget.after!(root, host, false);
    };
    const host = {
      config: () => config,
      state: () => state,
      update: (p: Partial<typeof state>) => {
        state = { ...state, ...p };
        paint();
      },
      emit: (n: string, d: unknown) => events.push([n, d]),
    };
    paint();
    const off = notificationCenterWidget.attach(root, host);
    const click = (selector: string) =>
      root.querySelector<HTMLElement>(selector)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(root.querySelector(".z-notification-badge")?.textContent, "2");
    click('[data-toggle="b"]');
    assert.equal(root.querySelector(".z-notification-badge")?.textContent, "1");
    assert.equal(root.querySelector('[data-id="b"]')?.hasAttribute("data-unread"), false);
    click('[data-action="view"]');
    click("[data-read-all]");
    assert.equal(root.querySelector(".z-notification-badge"), null);
    click("[data-read-all]");
    click('[data-toggle="c"]');
    assert.deepEqual(events, [
      ["read-change", { id: "b", read: true }],
      ["action", { id: "a", action: "view" }],
      ["read-all", { ids: ["a"] }],
      ["read-change", { id: "c", read: false }],
    ]);
    // Un aviso nuevo sin leer: se cuenta y se anuncia una vez en la región educada del anunciador central.
    config = notificationCenterWidget.configure({
      notifications: [{ id: "n", title: "Message from Yuki", time: NOW }, ...ITEMS],
      now: NOW,
      timeZone: "UTC",
    });
    paint();
    paint();
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(document.querySelector('[data-z-announcer] [role="status"]')?.textContent, "New notification: Message from Yuki");
    off();
    root.remove();
    root.dataset.max = "9";
    root.dataset.placement = "bottom-start";
    root.dataset.now = "2026-11-23T12:00:00Z";
    root.dataset.open = "";
    const props = notificationCenterWidget.fromDom(root, { notifications: ITEMS });
    assert.equal(props.max, 9);
    assert.equal(props.placement, "bottom-start");
    assert.equal(props.now, NOW);
    assert.equal(props.defaultOpen, true);
    assert.equal(props.notifications.length, 5);
    assert.deepEqual(notificationCenterWidget.fromDom(document.createElement("div"), {}).notifications, []);
  });
  test("NotificationBadge: cifra oculta con texto, tope, punto y pegado a otro elemento", () => {
    assert.equal(
      render(NotificationBadge, { count: 12 }),
      '<span class="z-notification-badge" data-tone="danger"><span aria-hidden="true">12</span><span class="z-sr-only">12 unread</span></span>',
    );
    assert.match(render(NotificationBadge, { count: 240 }), />99\+</);
    assert.equal(render(NotificationBadge, { count: 0 }), "");
    assert.match(render(NotificationBadge, { count: 0, showZero: true, label: "" }), /<span>0<\/span>/);
    assert.match(render(NotificationBadge, { count: 1, dot: true, label: "New" }), /data-dot="true"><span class="z-sr-only">New<\/span>/);
    assert.match(
      render(NotificationBadge, { count: 3, children: "x", className: "k" }),
      /^<span class="z-notification-badge-anchor k">x<span class="z-notification-badge"/,
    );
  });
});
