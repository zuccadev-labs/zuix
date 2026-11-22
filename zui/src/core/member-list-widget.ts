// MemberList como pieza (core/widget): búsqueda que anuncia el número de resultados, grupos por rol o presencia,
// cada fila con persona (avatar, nombre, correo, presencia en texto), rol en un `<select>` nativo y botón de quitar
// con nombre propio («Remove Ana López from the team»), más «Invite». Los cambios se aplican en la vista al momento y
// salen como avisos (`role-change`, `remove`, `invite`); unas `members` nuevas de la aplicación mandan.

import { initialsOf } from "./initials";
import { filterMembers, groupMembers, type Member, type Role } from "./members";
import { fill, h, icon, type VEl } from "./vnode";
import { announceIn, type Widget, type WidgetHost } from "./widget";
import { PRESENCE_ICON, PRESENCE_LABELS, presenceOf, type PresenceLabels } from "./user-presence";

export interface MemberListLabels {
  search: string;
  /** «{count} members» */
  count: string;
  /** «{count} results» tras buscar. */
  results: string;
  noResults: string;
  invite: string;
  /** «Role for {name}» */
  role: string;
  /** «Remove {name}» */
  remove: string;
  /** «{name} removed» */
  removed: string;
  pending: string;
  you: string;
}

export const MEMBER_LIST_LABELS: MemberListLabels = {
  search: "Search members",
  count: "{count} members",
  results: "{count} results",
  noResults: "No one matches that search",
  invite: "Invite",
  role: "Role for {name}",
  remove: "Remove {name}",
  removed: "{name} removed",
  pending: "Invitation pending",
  you: "You",
};

export interface MemberListProps {
  members: readonly Member[];
  roles: readonly Role[];
  /** Título de la lista. */
  title?: string;
  searchable?: boolean;
  groupBy?: "role" | "presence" | "none";
  /** Muestra «Invite» (emite `invite`). */
  invitable?: boolean;
  /** Permite cambiar el rol y quitar. */
  editable?: boolean;
  /** Id de quien mira: su fila dice «You» y no se puede quitar. */
  currentUserId?: string;
  locale?: string;
  labels?: Partial<MemberListLabels>;
  presenceLabels?: Partial<PresenceLabels>;
}

interface Config {
  members: readonly Member[];
  roles: readonly Role[];
  title?: string;
  searchable: boolean;
  groupBy: "role" | "presence" | "none";
  invitable: boolean;
  editable: boolean;
  currentUserId?: string;
  locale?: string;
  labels: MemberListLabels;
  presence: PresenceLabels;
}
interface State {
  query: string;
  roleOf: Record<string, string>;
  removed: string[];
  /** Firma de las `members` de la aplicación: el modo DOM las vuelve a leer en cada pintado (otro array, mismo contenido). */
  source: string;
}
type Host = WidgetHost<Config, State>;

function personTree(m: Member, c: Config): VEl {
  const status = m.presence ? presenceOf(m.presence) : null;
  const glyph = status ? PRESENCE_ICON[status] : null;
  return h(
    "span",
    { class: "z-persona", "data-size": "sm" },
    h(
      "span",
      { class: "z-avatar", "data-size": "sm", "data-shape": "circle", "aria-hidden": "true" },
      m.avatar
        ? h("img", { class: "z-avatar__image", src: m.avatar, alt: "" })
        : h("span", { class: "z-avatar__initials" }, initialsOf(m.name)),
      status ? h("span", { class: "z-presence", "data-status": status, "data-size": "sm" }, glyph ? icon(glyph, 8) : null) : null,
    ),
    h(
      "span",
      { class: "z-persona__text" },
      h(
        "span",
        { class: "z-persona__name" },
        m.name,
        m.id === c.currentUserId ? h("span", { class: "z-persona__tag" }, c.labels.you) : null,
      ),
      h(
        "span",
        { class: "z-persona__secondary" },
        m.pending ? c.labels.pending : (m.email ?? ""),
        status ? h("span", { class: "z-sr-only" }, `, ${c.presence[status]}`) : null,
      ),
    ),
  );
}

export const memberListWidget: Widget<MemberListProps, Config, State> = {
  root: "z-member-list",
  configure: (p) => ({
    members: p.members ?? [],
    roles: p.roles ?? [],
    title: p.title,
    searchable: p.searchable !== false,
    groupBy: p.groupBy === "presence" || p.groupBy === "none" ? p.groupBy : "role",
    invitable: Boolean(p.invitable),
    editable: Boolean(p.editable),
    currentUserId: p.currentUserId,
    locale: p.locale,
    labels: { ...MEMBER_LIST_LABELS, ...p.labels },
    presence: { ...PRESENCE_LABELS, ...p.presenceLabels },
  }),
  initial: (c) => ({ query: "", roleOf: {}, removed: [], source: JSON.stringify(c.members) }),
  control(c, s) {
    const key = JSON.stringify(c.members);
    return key === s.source ? s : { ...s, roleOf: {}, removed: [], source: key };
  },
  tree(c, s, uid) {
    const l = c.labels;
    const live = c.members.filter((m) => !s.removed.includes(m.id)).map((m) => (s.roleOf[m.id] ? { ...m, role: s.roleOf[m.id]! } : m));
    const found = filterMembers(live, s.query);
    const groups = groupMembers(found, c.groupBy, c.roles, { locale: c.locale, presenceLabel: (st) => c.presence[st] });
    const row = (m: Member) => {
      const you = m.id === c.currentUserId;
      const role = c.roles.find((r) => r.id === m.role);
      const assignable = c.roles.filter((r) => !r.locked || r.id === m.role);
      return h(
        "li",
        { class: "z-member-list__row", key: m.id, "data-id": m.id, "data-pending": m.pending ? "" : undefined },
        personTree(m, c),
        c.editable && !role?.locked && !you
          ? h(
              "span",
              { class: "z-select z-member-list__role", "data-size": "sm" },
              h(
                "select",
                { class: "z-select__control", "aria-label": fill(l.role, { name: m.name }), "data-member": m.id },
                ...assignable.map((r) => h("option", { key: r.id, value: r.id, selected: r.id === m.role ? true : undefined }, r.label)),
              ),
              h("span", { class: "z-select__chevron" }, icon("chevron-up-down", 14)),
            )
          : h("span", { class: "z-member-list__role-text" }, role?.label ?? m.role),
        c.editable && !you && !role?.locked
          ? h(
              "button",
              {
                type: "button",
                class: "z-btn z-btn--icon z-btn--ghost z-member-list__remove",
                "data-size": "sm",
                "data-remove": m.id,
                "aria-label": fill(l.remove, { name: m.name }),
                title: fill(l.remove, { name: m.name }),
              },
              icon("user-minus", 14),
            )
          : null,
      );
    };
    return h(
      "div",
      { class: "z-member-list" },
      h(
        "div",
        { class: "z-member-list__head" },
        c.title ? h("h3", { class: "z-member-list__title", id: `${uid}-title` }, c.title) : null,
        h("span", { class: "z-member-list__count" }, fill(l.count, { count: live.length })),
        c.invitable
          ? h(
              "button",
              { type: "button", class: "z-btn z-btn--primary z-member-list__invite", "data-size": "sm", "data-invite": "" },
              icon("user-plus", 14),
              l.invite,
            )
          : null,
      ),
      c.searchable
        ? h(
            "span",
            { class: "z-input z-input--search z-member-list__search", "data-size": "md" },
            h("span", { class: "z-input__icon" }, icon("magnifying-glass", 16)),
            h("input", {
              class: "z-input__control",
              type: "search",
              "aria-label": l.search,
              placeholder: l.search,
              value: s.query,
              "data-search": "",
            }),
          )
        : null,
      found.length === 0 ? h("p", { class: "z-member-list__empty" }, l.noResults) : null,
      ...groups.map((g) =>
        h(
          "section",
          { class: "z-member-list__group", key: g.key, "aria-labelledby": g.label ? `${uid}-g-${g.key}` : undefined },
          g.label
            ? h(
                "h4",
                { class: "z-member-list__group-title", id: `${uid}-g-${g.key}` },
                g.label,
                h("span", { class: "z-member-list__group-count" }, String(g.members.length)),
              )
            : null,
          h("ul", { class: "z-member-list__rows" }, ...g.members.map(row)),
        ),
      ),
      h("span", { class: "z-sr-only", role: "status", "data-live": "" }),
    );
  },
  attach(root, host: Host) {
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (!t.matches?.("[data-search]")) return;
      host.update({ query: t.value });
      const c = host.config();
      const s = host.state();
      const live = c.members.filter((m) => !s.removed.includes(m.id));
      const n = filterMembers(live, s.query).length;
      announceIn(
        root,
        s.query.trim() ? (n ? fill(c.labels.results, { count: n }) : c.labels.noResults) : fill(c.labels.count, { count: live.length }),
      );
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLSelectElement;
      const id = t.dataset?.member;
      if (!id || !t.matches("select")) return;
      const role = t.value;
      host.update({ roleOf: { ...host.state().roleOf, [id]: role } });
      host.emit("role-change", { memberId: id, role });
    };
    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest?.<HTMLElement>("[data-remove], [data-invite]");
      if (!t || !root.contains(t)) return;
      if (t.dataset.invite !== undefined) {
        host.emit("invite", {});
        return;
      }
      const id = t.dataset.remove!;
      // El foco pasa a la fila siguiente (o a la búsqueda) antes de que la fila desaparezca.
      const rows = [...root.querySelectorAll<HTMLElement>(".z-member-list__row")];
      const i = rows.findIndex((r) => r.dataset.id === id);
      const next = rows[i + 1] ?? rows[i - 1];
      const name = host.config().members.find((m) => m.id === id)?.name ?? id;
      host.update({ removed: [...host.state().removed, id] });
      host.emit("remove", { memberId: id });
      const target = next?.dataset.id
        ? root.querySelector<HTMLElement>(
            `.z-member-list__row[data-id="${CSS.escape(next.dataset.id)}"] .z-member-list__remove, .z-member-list__row[data-id="${CSS.escape(next.dataset.id)}"] select`,
          )
        : null;
      (target ?? root.querySelector<HTMLElement>("[data-search]"))?.focus();
      announceIn(root, fill(host.config().labels.removed, { name }));
    };
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onChange);
      root.removeEventListener("click", onClick);
    };
  },
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    return {
      members: Array.isArray(json.members) ? (json.members as Member[]) : [],
      roles: Array.isArray(json.roles) ? (json.roles as Role[]) : [],
      title: d.title,
      searchable: d.searchable !== "false",
      groupBy: d.groupBy === "presence" || d.groupBy === "none" ? d.groupBy : undefined,
      invitable: d.invitable !== undefined && d.invitable !== "false",
      editable: d.editable !== undefined && d.editable !== "false",
      currentUserId: d.currentUser,
      locale: d.locale,
      labels: json.labels as Partial<MemberListLabels> | undefined,
      presenceLabels: json.presenceLabels as Partial<PresenceLabels> | undefined,
    };
  },
};
