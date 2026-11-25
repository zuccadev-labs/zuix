// Usuarios y perfiles: presencia y su texto, filtro y agrupación de miembros, validación del perfil, y la pieza
// MemberList (búsqueda, cambio de rol y quitar) sobre un DOM mínimo.
import "./helpers/dom.mjs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fc from "fast-check";
import { memberListWidget } from "../../zui/src/core/member-list-widget.ts";
import { filterMembers, groupMembers, sortByName, sortByPresence, type Member } from "../../zui/src/core/members.ts";
import {
  bioCounter,
  cleanHandle,
  validateProfile,
  validEmail,
  validHandle,
  validWebsite,
  visibleLength,
} from "../../zui/src/core/profile.ts";
import { isReachable, presenceOf, presenceRank, presenceText, PRESENCE_LABELS } from "../../zui/src/core/user-presence.ts";
import { toHTML } from "../../zui/src/core/vnode.ts";

fc.configureGlobal({ seed: Number(process.env.ZUIX_FC_SEED ?? 20261122), numRuns: Number(process.env.ZUIX_FC_RUNS ?? 300) });

const MEMBERS: Member[] = [
  { id: "1", name: "Ana López", email: "ana@acme.dev", role: "owner", presence: "online" },
  { id: "2", name: "álvaro Ruiz", email: "alvaro@acme.dev", role: "member", presence: "offline" },
  { id: "3", name: "Bea Martín", email: "bea@acme.dev", role: "admin", presence: "busy" },
  { id: "4", name: "Carlos 10", role: "member", presence: "away" },
  { id: "5", name: "Carlos 9", role: "ghost" },
];
const ROLES = [
  { id: "owner", label: "Owner", locked: true },
  { id: "admin", label: "Admin" },
  { id: "member", label: "Member" },
];

describe("presencia", () => {
  test("estados, prioridad, texto y visto hace", () => {
    assert.equal(presenceOf("dnd"), "dnd");
    assert.equal(presenceOf("nope"), "offline");
    assert.ok(presenceRank("online") < presenceRank("busy") && presenceRank("away") < presenceRank("offline"));
    assert.equal(isReachable("away"), true);
    assert.equal(isReachable("dnd"), false);
    assert.equal(presenceText("dnd"), "Do not disturb");
    const now = Date.parse("2026-11-22T14:00:00Z");
    assert.equal(presenceText("offline", { lastSeen: "2026-11-22T11:00:00Z", now, locale: "en-US" }), "Offline, Last seen 3 hours ago");
    assert.equal(presenceText("online", { lastSeen: now - 1000, now }), "Available");
    assert.equal(presenceText("away", { labels: { away: "Ausente" } }), "Ausente");
    assert.equal(Object.keys(PRESENCE_LABELS).length, 7);
  });
});

describe("miembros", () => {
  test("búsqueda sin mayúsculas ni acentos, por nombre o correo", () => {
    assert.deepEqual(
      filterMembers(MEMBERS, "ALVARO").map((m) => m.id),
      ["2"],
    );
    assert.deepEqual(
      filterMembers(MEMBERS, "acme bea").map((m) => m.id),
      ["3"],
    );
    assert.equal(filterMembers(MEMBERS, "  ").length, MEMBERS.length);
    assert.equal(filterMembers(MEMBERS, "zzz").length, 0);
  });
  test("orden con el collator, grupos por rol y por presencia", () => {
    assert.deepEqual(
      sortByName(MEMBERS, "en").map((m) => m.id),
      ["2", "1", "3", "5", "4"],
    );
    assert.deepEqual(sortByName(MEMBERS, "xx-invalid-@@").map((m) => m.id).length, 5);
    const byRole = groupMembers(MEMBERS, "role", ROLES, { locale: "en" });
    assert.deepEqual(
      byRole.map((g) => [g.label, g.members.map((m) => m.id)]),
      [
        ["Owner", ["1"]],
        ["Admin", ["3"]],
        ["Member", ["2", "4"]],
        ["ghost", ["5"]],
      ],
    );
    const byPresence = groupMembers(MEMBERS, "presence", ROLES, { presenceLabel: (s) => s.toUpperCase() });
    assert.deepEqual(
      byPresence.map((g) => g.label),
      ["ONLINE", "BUSY", "AWAY", "OFFLINE"],
    );
    assert.equal(groupMembers(MEMBERS, "presence", ROLES)[0]!.label, "online");
    assert.equal(groupMembers(MEMBERS, "none", ROLES)[0]!.members.length, 5);
    assert.deepEqual(groupMembers([], "none", ROLES), []);
    assert.deepEqual(
      sortByPresence(MEMBERS).map((m) => m.id),
      ["1", "3", "4", "2", "5"],
    );
  });
  test("propiedad: filtrar nunca añade ni duplica", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), (q) => {
        const out = filterMembers(MEMBERS, q);
        return out.length <= MEMBERS.length && out.every((m) => MEMBERS.includes(m)) && new Set(out).size === out.length;
      }),
    );
  });
});

describe("perfil", () => {
  test("reglas de cada campo con mensajes que dicen cómo corregir", () => {
    assert.equal(cleanHandle("  @@ana "), "ana");
    assert.equal(validHandle("ana.lopez"), true);
    assert.equal(validHandle("an"), false);
    assert.equal(validHandle("1ana"), false);
    assert.equal(validHandle("ana..lopez"), false);
    assert.equal(validHandle("ana."), false);
    assert.equal(validEmail(""), true);
    assert.equal(validEmail("a@b.co"), true);
    assert.equal(validEmail("a@b"), false);
    assert.equal(validWebsite(""), true);
    assert.equal(validWebsite("https://ana.design"), true);
    assert.equal(validWebsite("ftp://ana.design"), false);
    assert.equal(validWebsite("https://localhost"), false);
    assert.equal(validWebsite("not a url"), false);
    assert.equal(visibleLength("añ😀"), 3);
    const errors = validateProfile({ name: " ", handle: "", email: "x", website: "y", bio: "z".repeat(161) });
    assert.deepEqual(Object.keys(errors).sort(), ["bio", "email", "handle", "name", "website"]);
    assert.match(errors.handle!, /Choose a username/);
    assert.match(errors.bio!, /160/);
    assert.match(validateProfile({ handle: "x!" }).handle!, /3 to 30/);
    assert.match(validateProfile({ handle: "admin" }, { taken: (h) => h === "admin" }).handle!, /taken/);
    assert.deepEqual(validateProfile({ name: "", handle: "" }, { fields: ["bio"] }), {});
    assert.deepEqual(validateProfile({ name: "Ana", handle: "ana", bio: "ok" }), {});
    assert.equal(bioCounter("hola", 10), "4 of 10");
    assert.equal(bioCounter("hola", 10, { counter: "{count}/{max}" }), "4/10");
  });
});

describe("MemberList", () => {
  test("árbol: grupos, rol editable salvo el bloqueado y quien mira, y vuelta desde el marcado", () => {
    const c = memberListWidget.configure({
      members: MEMBERS,
      roles: ROLES,
      title: "Team",
      editable: true,
      invitable: true,
      currentUserId: "1",
    });
    const s = memberListWidget.initial(c);
    const html = toHTML(memberListWidget.tree(c, s, "ml"));
    assert.match(html, /5 members/);
    assert.match(html, /aria-label="Role for Bea Martín"/);
    assert.doesNotMatch(html, /aria-label="Role for Ana López"/);
    assert.doesNotMatch(html, /aria-label="Remove Ana López"/);
    assert.match(html, />You</);
    assert.match(html, /, Busy</);
    const el = document.createElement("div");
    el.dataset.editable = "";
    el.dataset.groupBy = "presence";
    el.dataset.currentUser = "1";
    const props = memberListWidget.fromDom(el, { members: MEMBERS, roles: ROLES });
    assert.equal(props.groupBy, "presence");
    assert.equal(props.editable, true);
    assert.equal(props.currentUserId, "1");
    assert.equal(memberListWidget.control!(c, { ...s, source: "[]", removed: ["1"] }).removed.length, 0);
    assert.equal(memberListWidget.control!(c, { ...s, removed: ["1"] }).removed.length, 1);
    assert.match(toHTML(memberListWidget.tree(c, { ...s, query: "zzz" }, "ml")), /No one matches/);
  });
  test("interacción: buscar, cambiar de rol, quitar e invitar", () => {
    const c = memberListWidget.configure({ members: MEMBERS, roles: ROLES, editable: true, invitable: true });
    let state = memberListWidget.initial(c);
    const events: [string, unknown][] = [];
    const wrap = document.createElement("div");
    const render = () => {
      wrap.innerHTML = toHTML(memberListWidget.tree(c, state, "ml"));
    };
    render();
    const root = wrap.firstElementChild as HTMLElement;
    document.body.append(wrap);
    const host = {
      config: () => c,
      state: () => state,
      update: (p: Partial<typeof state>) => {
        state = { ...state, ...p };
      },
      emit: (n: string, d: unknown) => events.push([n, d]),
    };
    const off = memberListWidget.attach(root, host);
    const search = root.querySelector<HTMLInputElement>("[data-search]")!;
    search.value = "bea";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    assert.equal(state.query, "bea");
    const select = root.querySelector<HTMLSelectElement>('select[data-member="3"]')!;
    select.value = "member";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    assert.deepEqual(state.roleOf, { "3": "member" });
    root.querySelector<HTMLElement>('[data-remove="2"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(state.removed, ["2"]);
    root.querySelector<HTMLElement>("[data-invite]")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(
      events.map(([n]) => n),
      ["role-change", "remove", "invite"],
    );
    off();
    wrap.remove();
  });
});
