// NotificationCenter como pieza (core/widget): botón de campana con el contador de no leídos y un popover (`popover`
// automático: Escape y clic fuera lo cierran, y el foco vuelve a la campana) con los avisos agrupados por día. Cada
// aviso se marca como leído o no leído y puede traer acciones propias; «Mark all as read» los marca todos. Los
// cambios se ven al momento y salen como avisos (`read-change`, `read-all`, `action`, `open-change`); unas
// `notifications` nuevas de la aplicación mandan cuando ya coinciden con lo que la persona marcó. Un aviso nuevo sin
// leer se anuncia una vez por el anunciador central, también con el panel cerrado.

import { announce } from "./announcer";
import {
  arrivals,
  badgeText,
  groupByDay,
  isRead,
  notificationTime,
  unreadCount,
  type NotificationAction,
  type NotificationItem,
} from "./notifications";
import { place, type Placement } from "./place";
import { toInstant } from "./relative";
import { fill, h, icon, on, type VEl } from "./vnode";
import type { Widget, WidgetHost } from "./widget";
import { popoverOpen, showPopover } from "./popover";

export type { NotificationAction, NotificationItem };

export interface NotificationCenterLabels {
  /** Nombre de la campana y título del panel. */
  title: string;
  /** Nombre de la campana con avisos: «Notifications, {count} unread». */
  trigger: string;
  markAllRead: string;
  /** «Mark “{title}” as read» */
  markRead: string;
  /** «Mark “{title}” as unread» */
  markUnread: string;
  /** Prefijo oculto de un aviso sin leer. */
  unread: string;
  empty: string;
  emptyHint: string;
  today: string;
  yesterday: string;
  /** Anuncio de un aviso nuevo: «New notification: {title}». */
  arrived: string;
  /** Anuncio de varios: «{count} new notifications». */
  arrivedMany: string;
  /** Anuncio tras marcar todo. */
  allRead: string;
  viewAll: string;
}

export const NOTIFICATION_CENTER_LABELS: NotificationCenterLabels = {
  title: "Notifications",
  trigger: "Notifications, {count} unread",
  markAllRead: "Mark all as read",
  markRead: "Mark “{title}” as read",
  markUnread: "Mark “{title}” as unread",
  unread: "Unread",
  empty: "You're all caught up",
  emptyHint: "New notifications will show up here.",
  today: "Today",
  yesterday: "Yesterday",
  arrived: "New notification: {title}",
  arrivedMany: "{count} new notifications",
  allRead: "All notifications marked as read",
  viewAll: "View all",
};

export interface NotificationCenterProps {
  notifications: readonly NotificationItem[];
  /** Tope del contador («99+»). */
  max?: number;
  locale?: string;
  /** Zona horaria de la agrupación por día. Por defecto, la de quien mira. */
  timeZone?: string;
  /** Instante actual (para «Today» y «Yesterday»). Por defecto, el del reloj. */
  now?: number;
  /** Enlace «View all» al pie del panel. */
  viewAllHref?: string;
  /** Colocación del panel respecto a la campana. */
  placement?: Placement;
  /** Abierto al montar. */
  defaultOpen?: boolean;
  /** Sin anuncios de avisos nuevos (la aplicación ya los anuncia, por ejemplo con un Toast). */
  silent?: boolean;
  labels?: Partial<NotificationCenterLabels>;
}

interface Config {
  items: readonly NotificationItem[];
  max: number;
  locale?: string;
  timeZone?: string;
  now: number;
  viewAllHref?: string;
  placement: Placement;
  defaultOpen: boolean;
  silent: boolean;
  labels: NotificationCenterLabels;
}
interface State {
  open: boolean;
  /** Leído o no leído marcado en la vista, por id; manda sobre `read` hasta que la aplicación coincide. */
  read: Record<string, boolean>;
}
type Host = WidgetHost<Config, State>;

const TONES = new Set(["neutral", "accent", "success", "warning", "danger", "info"]);

function row(item: NotificationItem, c: Config, s: State, uid: string): VEl {
  const l = c.labels;
  const read = isRead(item, s.read);
  const at = toInstant(item.time);
  const titleId = `${uid}-n-${item.id}`;
  const title = item.href
    ? h("a", { class: "z-notification__title", id: titleId, href: item.href }, item.title)
    : h("span", { class: "z-notification__title", id: titleId }, item.title);
  return h(
    "li",
    { class: "z-notification", key: item.id, "data-id": item.id, "data-unread": on(!read) },
    h(
      "span",
      { class: "z-notification__icon", "aria-hidden": "true", "data-tone": item.tone && TONES.has(item.tone) ? item.tone : "neutral" },
      icon(item.icon ?? "bell", 16),
    ),
    h(
      "div",
      { class: "z-notification__main" },
      h("p", { class: "z-notification__head" }, read ? null : h("span", { class: "z-sr-only" }, `${l.unread}: `), title),
      item.body ? h("p", { class: "z-notification__body" }, item.body) : null,
      at === null ? null : h("time", { class: "z-notification__time", datetime: new Date(at).toISOString() }, notificationTime(at, c)),
      item.actions?.length
        ? h(
            "div",
            { class: "z-notification__actions" },
            ...item.actions.map((a) =>
              h(
                "button",
                {
                  type: "button",
                  class: "z-btn z-btn--secondary",
                  "data-size": "sm",
                  key: a.id,
                  "data-action": a.id,
                  "data-notification": item.id,
                },
                a.label,
              ),
            ),
          )
        : null,
    ),
    h(
      "button",
      {
        type: "button",
        class: "z-btn z-btn--icon z-btn--ghost z-notification__toggle",
        "data-size": "sm",
        "data-toggle": item.id,
        "aria-label": fill(read ? l.markUnread : l.markRead, { title: item.title }),
        title: fill(read ? l.markUnread : l.markRead, { title: item.title }),
      },
      read
        ? h("span", { class: "z-notification__ring", "aria-hidden": "true" })
        : h("span", { class: "z-notification__dot", "aria-hidden": "true" }),
    ),
  );
}

/** Avisos ya vistos por cada raíz: lo nuevo se anuncia una vez, no en cada pintado. */
const seen = new WeakMap<HTMLElement, Set<string>>();

export const notificationCenterWidget: Widget<NotificationCenterProps, Config, State> = {
  root: "z-notification-center",
  configure: (p) => ({
    items: Array.isArray(p.notifications) ? p.notifications.filter((n) => n && typeof n.id === "string") : [],
    max: Number.isFinite(p.max) ? Math.max(1, Number(p.max)) : 99,
    locale: p.locale,
    timeZone: p.timeZone,
    now: Number.isFinite(p.now) ? Number(p.now) : Date.now(),
    viewAllHref: p.viewAllHref,
    placement: p.placement ?? "bottom-end",
    defaultOpen: Boolean(p.defaultOpen),
    silent: Boolean(p.silent),
    labels: { ...NOTIFICATION_CENTER_LABELS, ...p.labels },
  }),
  initial: (c) => ({ open: c.defaultOpen, read: {} }),
  control(c, s) {
    // Lo marcado en la vista deja de mandar cuando la aplicación ya dice lo mismo (o el aviso ya no está).
    let changed = false;
    const read: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(s.read)) {
      const item = c.items.find((n) => n.id === id);
      if (item && Boolean(item.read) !== value) read[id] = value;
      else changed = true;
    }
    return changed ? { ...s, read } : s;
  },
  tree(c, s, uid) {
    const l = c.labels;
    const unread = unreadCount(c.items, s.read);
    const groups = groupByDay(c.items, { now: c.now, timeZone: c.timeZone, locale: c.locale, today: l.today, yesterday: l.yesterday });
    const count = badgeText(unread, c.max, c.locale);
    return h(
      "div",
      { class: "z-notification-center", "data-state": s.open ? "open" : "closed", "data-unread": unread || undefined },
      h(
        "button",
        {
          type: "button",
          class: "z-btn z-btn--icon z-btn--ghost z-notification-center__trigger",
          "data-size": "md",
          popovertarget: `${uid}-panel`,
          "aria-haspopup": "dialog",
          "aria-expanded": s.open ? "true" : "false",
          "aria-label": unread ? fill(l.trigger, { count: unread }) : l.title,
          title: l.title,
          "data-part": "trigger",
        },
        icon(unread ? "bell-alert" : "bell", 18),
        count ? h("span", { class: "z-notification-badge", "data-tone": "danger", "aria-hidden": "true" }, count) : null,
      ),
      h(
        "div",
        {
          id: `${uid}-panel`,
          class: "z-liquid z-popover z-notification-center__panel",
          popover: "auto",
          role: "dialog",
          "aria-labelledby": `${uid}-title`,
          tabindex: "-1",
          "data-state": s.open ? "open" : "closed",
        },
        h(
          "div",
          { class: "z-notification-center__head" },
          h("h2", { class: "z-notification-center__title", id: `${uid}-title` }, l.title),
          h(
            "button",
            {
              type: "button",
              class: "z-btn z-btn--ghost z-notification-center__read-all",
              "data-size": "sm",
              "data-read-all": "",
              "aria-disabled": unread ? undefined : "true",
            },
            icon("check", 14),
            l.markAllRead,
          ),
        ),
        c.items.length
          ? h(
              "div",
              { class: "z-notification-center__body" },
              ...groups.map((g) =>
                h(
                  "section",
                  {
                    class: "z-notification-center__group",
                    key: g.key || "undated",
                    "aria-labelledby": g.label ? `${uid}-d-${g.key}` : undefined,
                  },
                  g.label ? h("h3", { class: "z-notification-center__day", id: `${uid}-d-${g.key}` }, g.label) : null,
                  h("ul", { class: "z-notification-center__list" }, ...g.items.map((item) => row(item, c, s, uid))),
                ),
              ),
            )
          : h(
              "div",
              { class: "z-notification-center__empty" },
              h("span", { class: "z-notification-center__empty-icon", "aria-hidden": "true" }, icon("bell-slash", 20)),
              h("p", { class: "z-notification-center__empty-title" }, l.empty),
              h("p", { class: "z-notification-center__empty-hint" }, l.emptyHint),
            ),
        c.viewAllHref
          ? h(
              "div",
              { class: "z-notification-center__foot" },
              h("a", { class: "z-link z-link--standalone z-notification-center__all", href: c.viewAllHref }, l.viewAll),
            )
          : null,
      ),
    );
  },
  attach(root, host: Host) {
    const panelOf = () => root.querySelector<HTMLElement>(".z-notification-center__panel");
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element).closest?.<HTMLElement>("[data-toggle], [data-action], [data-read-all]");
      if (!target || !root.contains(target)) return;
      const c = host.config();
      const s = host.state();
      if (target.dataset.readAll !== undefined) {
        if (target.getAttribute("aria-disabled") === "true") return;
        const ids = c.items.filter((n) => !isRead(n, s.read)).map((n) => n.id);
        const read = { ...s.read };
        for (const id of ids) read[id] = true;
        host.update({ read });
        host.emit("read-all", { ids });
        announce(c.labels.allRead, { source: root });
        return;
      }
      if (target.dataset.toggle !== undefined) {
        const id = target.dataset.toggle;
        const item = c.items.find((n) => n.id === id);
        if (!item) return;
        const next = !isRead(item, s.read);
        host.update({ read: { ...s.read, [id]: next } });
        host.emit("read-change", { id, read: next });
        return;
      }
      const id = target.dataset.notification ?? "";
      host.emit("action", { id, action: target.dataset.action });
    };
    // `toggle` no burbujea: se escucha en captura. Al abrir, el panel se coloca junto a la campana y recibe el foco.
    const onToggle = (event: Event) => {
      const panel = event.target;
      if (!(panel instanceof HTMLElement) || panel !== panelOf()) return;
      const open = (event as ToggleEvent).newState === "open";
      if (open !== host.state().open) {
        host.update({ open });
        host.emit("open-change", { open });
      }
      if (open) {
        const trigger = root.querySelector<HTMLElement>(".z-notification-center__trigger");
        if (trigger) place(panel, trigger.getBoundingClientRect(), host.config().placement, 6);
        panel.focus({ preventScroll: true });
      }
    };
    root.addEventListener("click", onClick);
    root.addEventListener("toggle", onToggle, true);
    // Abierto al montar: el popover se abre en cuanto la raíz está en el documento.
    if (host.state().open) queueMicrotask(() => panelOf()?.isConnected && !popoverOpen(panelOf()) && showPopover(panelOf()!));
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("toggle", onToggle, true);
    };
  },
  after(root, host) {
    const c = host.config();
    const s = host.state();
    const known = seen.get(root);
    if (!known) {
      seen.set(root, new Set(c.items.map((n) => n.id)));
      return;
    }
    const fresh = arrivals(c.items, known, s.read);
    for (const n of c.items) known.add(n.id);
    if (!fresh.length || c.silent) return;
    const l = c.labels;
    announce(fresh.length === 1 ? fill(l.arrived, { title: fresh[0]!.title }) : fill(l.arrivedMany, { count: fresh.length }), {
      source: root,
    });
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      notifications: Array.isArray(json.notifications) ? (json.notifications as NotificationItem[]) : [],
      max: d.max === undefined ? undefined : Number(d.max),
      locale: d.locale,
      timeZone: d.timeZone,
      now: d.now === undefined ? undefined : (toInstant(d.now) ?? undefined),
      viewAllHref: d.viewAll,
      placement: d.placement as Placement | undefined,
      defaultOpen: d.open !== undefined && d.open !== "false",
      silent: d.silent !== undefined && d.silent !== "false",
      labels: json.labels as Partial<NotificationCenterLabels> | undefined,
    };
  },
};
