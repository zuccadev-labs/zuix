// MemberList como pieza (core/widget): búsqueda que anuncia el número de resultados, grupos por rol o presencia,
// cada fila con persona (avatar, nombre, correo, presencia en texto), rol en un `<select>` nativo y botón de quitar
// con nombre propio («Remove Ana López from the team»), más «Invite». Los cambios se aplican en la vista al momento y
// salen como avisos (`role-change`, `remove`, `invite`); unas `members` nuevas de la aplicación mandan.

import { initialsOf } from "./initials";
import { filterMembers, groupMembers, type Member, type Role } from "./members";
import { virtualizeAttr, wantsVirtual } from "./virtual";
import {
  followVirtual,
  measureInto,
  spacerNode,
  unfollowVirtual,
  widgetList,
  windowChanges,
  type ViewportState,
  type WidgetListInput,
} from "./virtual-widget";
import { fill, h, icon, on, type VEl } from "./vnode";
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
  /**
   * Ventana virtual: la lista desplaza dentro de su propio alto (`--z-member-list-height`, 480 px) y solo pinta las filas
   * que se ven. `true` siempre, `false` nunca, un número es el umbral; por defecto, a partir de 200 personas.
   */
  virtualize?: boolean | number;
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
  virtualize?: boolean | number;
}
interface State {
  query: string;
  roleOf: Record<string, string>;
  removed: string[];
  /** Firma de las `members` de la aplicación: el modo DOM las vuelve a leer en cada pintado (otro array, mismo contenido). */
  source: string;
  view: ViewportState | null;
  heights: Map<string, number>;
  /** Fila que tiene el foco (no sale del documento con ventana virtual). */
  focusKey?: string;
}
type Host = WidgetHost<Config, State>;

type Flat =
  | { kind: "head"; key: string; group: MemberGroupOf }
  | { kind: "member"; key: string; group: MemberGroupOf; m: Member; pos: number };
type MemberGroupOf = { key: string; label: string; members: Member[] };

/** Personas visibles en grupos, aplanadas en filas (cabecera de grupo y persona) para la ventana virtual. */
function flatRows(c: Config, s: State): { live: Member[]; found: Member[]; groups: MemberGroupOf[]; flat: Flat[] } {
  const live = c.members.filter((m) => !s.removed.includes(m.id)).map((m) => (s.roleOf[m.id] ? { ...m, role: s.roleOf[m.id]! } : m));
  const found = filterMembers(live, s.query);
  const groups = groupMembers(found, c.groupBy, c.roles, { locale: c.locale, presenceLabel: (st) => c.presence[st] }) as MemberGroupOf[];
  const flat: Flat[] = [];
  for (const g of groups) {
    if (g.label) flat.push({ kind: "head", key: `g:${g.key}`, group: g });
    g.members.forEach((m, pos) => {
      flat.push({ kind: "member", key: `m:${m.id}`, group: g, m, pos });
    });
  }
  return { live, found, groups, flat };
}

const listInput = (c: Config, s: State, flat: Flat[]): WidgetListInput => ({
  virtual: wantsVirtual(c.virtualize, flat.length, 200),
  count: flat.length,
  keyOf: (i) => flat[i]!.key,
  estimate: (i) => (flat[i]!.kind === "head" ? 28 : 56),
  heights: s.heights,
  view: s.view,
  keep: (() => {
    // La fila con el foco (rol o quitar) no sale del documento.
    const at = s.focusKey ? flat.findIndex((f) => f.key === s.focusKey) : -1;
    return at >= 0 ? [at] : [];
  })(),
});

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
    virtualize: p.virtualize,
  }),
  initial: (c) => ({ query: "", roleOf: {}, removed: [], source: JSON.stringify(c.members), view: null, heights: new Map() }),
  control(c, s) {
    const key = JSON.stringify(c.members);
    return key === s.source ? s : { ...s, roleOf: {}, removed: [], source: key };
  },
  tree(c, s, uid) {
    const l = c.labels;
    const { live, found, flat } = flatRows(c, s);
    const win = widgetList(listInput(c, s, flat));
    const row = (m: Member, pos: number, total: number) => {
      const you = m.id === c.currentUserId;
      const role = c.roles.find((r) => r.id === m.role);
      const assignable = c.roles.filter((r) => !r.locked || r.id === m.role);
      return h(
        "li",
        {
          class: "z-member-list__row",
          key: m.id,
          "data-id": m.id,
          "data-pending": m.pending ? "" : undefined,
          "data-key": win.virtual ? `m:${m.id}` : undefined,
          "aria-posinset": win.virtual ? pos + 1 : undefined,
          "aria-setsize": win.virtual ? total : undefined,
        },
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
    // Secciones por grupo con las filas pintadas (todas, o las de la ventana): el título va con su fila de cabecera.
    const sections = (indices: number[]): VEl[] => {
      const out: VEl[] = [];
      type Run = { g: MemberGroupOf; head: boolean; rows: VEl[] };
      const runs: Run[] = [];
      const flush = (run: Run) => {
        const { g, head, rows } = run;
        out.push(
          h(
            "section",
            { class: "z-member-list__group", key: g.key, "aria-labelledby": g.label ? `${uid}-g-${g.key}` : undefined },
            head && g.label
              ? h(
                  "h4",
                  { class: "z-member-list__group-title", id: `${uid}-g-${g.key}`, "data-key": win.virtual ? `g:${g.key}` : undefined },
                  g.label,
                  h("span", { class: "z-member-list__group-count" }, String(g.members.length)),
                )
              : null,
            rows.length ? h("ul", { class: "z-member-list__rows" }, ...rows) : null,
          ),
        );
      };
      for (const i of indices) {
        const f = flat[i]!;
        let run = runs[runs.length - 1];
        if (run?.g !== f.group) {
          run = { g: f.group, head: false, rows: [] };
          runs.push(run);
        }
        if (f.kind === "head") run.head = true;
        else run.rows.push(row(f.m, f.pos, f.group.members.length));
      }
      for (const run of runs) flush(run);
      return out;
    };
    return h(
      "div",
      { class: "z-member-list", "data-virtual": on(win.virtual) },
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
      win.virtual
        ? h(
            "div",
            { class: "z-member-list__scroll", "data-virtual": "" },
            spacerNode("div", "before", win.before),
            ...sections(win.indices),
            spacerNode("div", "after", win.after),
          )
        : null,
      ...(win.virtual ? [] : sections(win.indices)),
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
    // La fila con el foco no sale del documento al desplazar (ventana virtual).
    const onFocus = (e: FocusEvent) => {
      const key = (e.target as HTMLElement).closest?.<HTMLElement>(".z-member-list__row")?.dataset.id;
      const next = key ? `m:${key}` : undefined;
      if (host.state().focusKey !== next) host.state().focusKey = next;
    };
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("click", onClick);
    root.addEventListener("focusin", onFocus);
    return () => {
      unfollowVirtual(root);
      root.removeEventListener("focusin", onFocus);
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onChange);
      root.removeEventListener("click", onClick);
    };
  },
  after(root, host) {
    const scroller = root.querySelector<HTMLElement>(".z-member-list__scroll[data-virtual]");
    if (scroller && measureInto(scroller, "[data-key]", host.state().heights)) queueMicrotask(() => host.update({}));
    followVirtual(root, "rows", scroller ? ".z-member-list__scroll[data-virtual]" : null, (view) => {
      const c = host.config();
      const s = host.state();
      if (windowChanges(listInput(c, s, flatRows(c, s).flat), view)) host.update({ view });
      else s.view = view;
    });
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      virtualize: virtualizeAttr(d.virtualize),
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
