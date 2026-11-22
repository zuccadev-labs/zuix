// KanbanBoard como pieza (core/widget): columnas con cabecera (título, contador con límite y «añadir») y tarjetas
// (título, etiquetas, prioridad, fecha y personas). Una sola parada de tabulación para todo el tablero: las flechas
// van de tarjeta en tarjeta; Espacio coge la tarjeta, las flechas la llevan de posición y de columna, Intro o Espacio
// la sueltan, Escape la devuelve y perder el foco la suelta. Con el puntero se arrastra la tarjeta (captura de
// puntero, un solo puntero, umbral de 4 px para no robar el clic) y un hueco marca el destino. Cada paso se dice en la
// región viva central; el orden del DOM es siempre el de las columnas.

import { announce } from "./announcer";
import { initialsOf } from "./initials";
import {
  dropIndexAt,
  KANBAN_LABELS,
  keyTarget,
  locateCard,
  moveCard,
  neighborCard,
  placeText,
  type CardPlace,
  type KanbanCard,
  type KanbanColumn,
  type KanbanLabels,
} from "./kanban";
import { fill, h, icon, type VEl, type VNode } from "./vnode";
import type { Widget, WidgetHost } from "./widget";

export interface KanbanBoardProps {
  columns: readonly KanbanColumn[];
  /** Nombre del tablero. */
  label: string;
  /** Botón «añadir» en cada columna (emite `add`). */
  addable?: boolean;
  labels?: Partial<KanbanLabels>;
}

interface Config {
  columns: readonly KanbanColumn[];
  label: string;
  addable: boolean;
  labels: KanbanLabels;
}

interface PointerDrag {
  id: string;
  pointer: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  active: boolean;
  target: CardPlace | null;
}

interface State {
  /** Columnas pintadas (copia local: la aplicación manda al cambiar `columns`). */
  columns: readonly KanbanColumn[];
  /** Firma de las columnas de la aplicación: el modo DOM las vuelve a leer en cada pintado (otro array, mismo contenido). */
  source: string;
  /** Tarjeta con la parada de tabulación. */
  active: string | null;
  /** Con la tarjeta cogida por teclado: las columnas de antes, para Escape. */
  grabbed: { id: string; before: readonly KanbanColumn[] } | null;
  drag: PointerDrag | null;
}
type Host = WidgetHost<Config, State>;

const PRIORITY_ICON = { low: "chevron-down", medium: "minus", high: "chevron-up", urgent: "exclamation-triangle" } as const;

function avatar(person: { name: string; avatar?: string }, key: string): VEl {
  return h(
    "span",
    { class: "z-avatar", key, "data-size": "xs", "data-shape": "circle", "aria-hidden": "true" },
    person.avatar
      ? h("img", { class: "z-avatar__image", src: person.avatar, alt: "" })
      : h("span", { class: "z-avatar__initials" }, initialsOf(person.name)),
  );
}

function cardTree(card: KanbanCard, s: State, c: Config, uid: string): VEl {
  const l = c.labels;
  const grabbed = s.grabbed?.id === card.id;
  const dragging = s.drag?.active && s.drag.id === card.id;
  const people = card.assignees ?? [];
  const meta: VNode[] = [];
  if (card.priority)
    meta.push(
      h(
        "span",
        { class: "z-kanban__priority", "data-priority": card.priority, key: "p" },
        icon(PRIORITY_ICON[card.priority], 12),
        h("span", { class: "z-kanban__meta-text" }, l[card.priority]),
      ),
    );
  if (card.due)
    meta.push(
      h(
        "span",
        { class: "z-kanban__due", key: "d" },
        icon("calendar", 12),
        card.dueISO ? h("time", { datetime: card.dueISO }, fill(l.due, { date: card.due })) : fill(l.due, { date: card.due }),
      ),
    );
  return h(
    "li",
    {
      key: card.id,
      class: "z-kanban__card",
      "data-id": card.id,
      tabindex: s.active === card.id ? 0 : -1,
      "aria-describedby": `${uid}-hint`,
      "data-grabbed": grabbed ? "key" : dragging ? "pointer" : undefined,
      s: dragging ? { "--z-drag-x": `${s.drag!.dx}px`, "--z-drag-y": `${s.drag!.dy}px` } : undefined,
    },
    card.labels?.length
      ? h(
          "span",
          { class: "z-kanban__labels" },
          ...card.labels.map((lab, i) =>
            h("span", { class: "z-kanban__label", key: String(i), "data-tone": lab.tone ?? "neutral" }, lab.text),
          ),
        )
      : null,
    h("span", { class: "z-kanban__title" }, card.title),
    card.description ? h("span", { class: "z-kanban__description" }, card.description) : null,
    meta.length || people.length
      ? h(
          "span",
          { class: "z-kanban__foot" },
          h("span", { class: "z-kanban__meta" }, ...meta),
          people.length
            ? h(
                "span",
                { class: "z-kanban__people" },
                h(
                  "span",
                  { class: "z-avatar-group", "data-size": "xs", "aria-hidden": "true" },
                  ...people.slice(0, 3).map((p, i) => avatar(p, String(i))),
                ),
                h("span", { class: "z-sr-only" }, fill(l.assigned, { names: people.map((p) => p.name).join(", ") })),
              )
            : null,
        )
      : null,
  );
}

export const kanbanWidget: Widget<KanbanBoardProps, Config, State> = {
  root: "z-kanban",
  configure: (p) => ({
    columns: p.columns ?? [],
    label: p.label ?? "",
    addable: Boolean(p.addable),
    labels: { ...KANBAN_LABELS, ...p.labels },
  }),
  initial: (c) => ({
    columns: c.columns,
    source: JSON.stringify(c.columns),
    active: c.columns.find((col) => col.cards.length)?.cards[0]?.id ?? null,
    grabbed: null,
    drag: null,
  }),
  control(c, s) {
    const key = JSON.stringify(c.columns);
    if (key === s.source) return s;
    // Columnas nuevas de la aplicación: mandan, salvo durante un agarre (se aplican al soltar).
    if (s.grabbed || s.drag) return { ...s, source: key };
    const active =
      s.active && locateCard(c.columns, s.active) ? s.active : (c.columns.find((col) => col.cards.length)?.cards[0]?.id ?? null);
    return { ...s, columns: c.columns, source: key, active };
  },
  tree(c, s, uid) {
    const l = c.labels;
    const target = s.drag?.active ? s.drag.target : null;
    return h(
      "div",
      { class: "z-kanban", role: "region", "aria-label": c.label, "data-dragging": s.drag?.active ? "" : undefined },
      h(
        "div",
        { class: "z-kanban__board" },
        ...s.columns.map((col, ci) => {
          const over = col.limit !== undefined && col.cards.length > col.limit;
          const items: VNode[] = col.cards.map((card) => cardTree(card, s, c, uid));
          if (target && target.column === ci) {
            // El hueco va en la posición de destino contando sin la tarjeta arrastrada.
            const visible = col.cards.filter((card) => card.id !== s.drag!.id);
            const before = visible[target.index];
            const at = before ? items.findIndex((n) => (n as VEl).k === before.id) : items.length;
            items.splice(at < 0 ? items.length : at, 0, h("li", { class: "z-kanban__placeholder", key: "__drop", "aria-hidden": "true" }));
          }
          return h(
            "section",
            {
              class: "z-kanban__column",
              key: col.id,
              "data-column": col.id,
              "data-tone": col.tone,
              "data-over": over ? "" : undefined,
              "aria-labelledby": `${uid}-${col.id}`,
            },
            h(
              "header",
              { class: "z-kanban__column-head" },
              h("h3", { class: "z-kanban__column-title", id: `${uid}-${col.id}` }, col.title),
              h(
                "span",
                {
                  class: "z-kanban__count",
                  "aria-label": over ? `${fill(l.countLimit, { count: col.cards.length, limit: col.limit! })}, ${l.overLimit}` : undefined,
                },
                col.limit !== undefined ? fill(l.countLimit, { count: col.cards.length, limit: col.limit }) : String(col.cards.length),
              ),
              c.addable
                ? h(
                    "button",
                    {
                      type: "button",
                      class: "z-btn z-btn--icon z-btn--ghost z-kanban__add",
                      "data-size": "sm",
                      "data-add": col.id,
                      "aria-label": fill(l.add, { column: col.title }),
                    },
                    icon("plus", 14),
                  )
                : null,
            ),
            h(
              "ol",
              { class: "z-kanban__cards", "data-column": col.id, "aria-labelledby": `${uid}-${col.id}` },
              ...items,
              col.cards.length === 0 && !(target && target.column === ci)
                ? h("li", { class: "z-kanban__empty", key: "__empty", "aria-hidden": "true" }, l.empty)
                : null,
            ),
          );
        }),
      ),
      h("span", { class: "z-sr-only", id: `${uid}-hint` }, l.instructions),
    );
  },
  attach(root, host: Host) {
    const doc = root.ownerDocument;
    const say = (text: string) => announce(text, { source: root });
    const cardOf = (t: EventTarget | null) => {
      const el = (t as HTMLElement | null)?.closest?.<HTMLElement>(".z-kanban__card");
      return el && root.contains(el) ? el : null;
    };
    const rtl = () => getComputedStyle(root).direction === "rtl";
    const emitMove = (id: string, before: readonly KanbanColumn[], after: readonly KanbanColumn[]) => {
      const from = locateCard(before, id);
      const to = locateCard(after, id);
      if (!from || !to || (from.column === to.column && from.index === to.index)) return false;
      host.emit("move", {
        cardId: id,
        fromColumn: before[from.column]!.id,
        toColumn: after[to.column]!.id,
        index: to.index,
        columns: after,
      });
      return true;
    };
    const drop = (commit: boolean) => {
      const s = host.state();
      if (!s.grabbed) return;
      const { id, before } = s.grabbed;
      const l = host.config().labels;
      if (!commit) {
        host.update({ grabbed: null, columns: before }, true);
        say(placeText(before, id, l.cancelled));
        return;
      }
      const after = s.columns;
      host.update({ grabbed: null }, true);
      if (emitMove(id, before, after)) say(placeText(after, id, l.moved));
    };

    const onKey = (event: KeyboardEvent) => {
      const card = cardOf(event.target);
      if (!card) return;
      const id = card.dataset.id!;
      const s = host.state();
      const l = host.config().labels;
      if (s.grabbed?.id === id) {
        if (event.key === "Escape") {
          event.preventDefault();
          drop(false);
          return;
        }
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          drop(true);
          return;
        }
        const to = keyTarget(s.columns, id, event.key, rtl());
        if (!to) {
          if (event.key.startsWith("Arrow")) event.preventDefault();
          return;
        }
        event.preventDefault();
        const next = moveCard(s.columns, id, to.column, to.index);
        host.update({ columns: next, active: id }, true);
        say(placeText(next, id, l.moved));
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        host.update({ grabbed: { id, before: s.columns }, active: id });
        say(placeText(s.columns, id, l.grabbed));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        host.emit("open", { cardId: id });
        return;
      }
      const next = neighborCard(s.columns, id, event.key, rtl());
      if (next) {
        event.preventDefault();
        host.update({ active: next }, true);
      }
    };
    const onFocusOut = () => {
      const s = host.state();
      if (!s.grabbed) return;
      // Al mover, el nodo de la tarjeta se vuelve a crear y el foco vuelve a ella en el mismo turno: solo una salida
      // real suelta la tarjeta.
      setTimeout(() => {
        const now = host.state();
        if (!now.grabbed) return;
        const focused = doc.activeElement as HTMLElement | null;
        if (focused?.closest?.(".z-kanban__card")?.getAttribute("data-id") !== now.grabbed.id) drop(true);
      }, 0);
    };
    const onFocusIn = (event: FocusEvent) => {
      const card = cardOf(event.target);
      if (card && card.dataset.id !== host.state().active && !host.state().grabbed) host.update({ active: card.dataset.id! });
    };
    const onClick = (event: MouseEvent) => {
      const add = (event.target as HTMLElement).closest?.<HTMLElement>("[data-add]");
      if (add && root.contains(add)) host.emit("add", { columnId: add.dataset.add });
    };

    /* Puntero */
    const measureTarget = (x: number, y: number, id: string): CardPlace | null => {
      const cols = [...root.querySelectorAll<HTMLElement>(".z-kanban__cards")];
      if (!cols.length) return null;
      let best = 0;
      let bestDist = Infinity;
      cols.forEach((list, i) => {
        const r = list.closest(".z-kanban__column")!.getBoundingClientRect();
        const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
        if (d < bestDist) {
          best = i;
          bestDist = d;
        }
      });
      const cards = [...cols[best]!.querySelectorAll<HTMLElement>(":scope > .z-kanban__card")].filter((el) => el.dataset.id !== id);
      const centers = cards.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      return { column: best, index: dropIndexAt(y, centers) };
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || host.state().drag || host.state().grabbed) return;
      const card = cardOf(event.target);
      if (!card || (event.target as HTMLElement).closest("a, button, input, select, textarea")) return;
      host.update({
        drag: {
          id: card.dataset.id!,
          pointer: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          dx: 0,
          dy: 0,
          active: false,
          target: null,
        },
      });
    };
    const onMove = (event: PointerEvent) => {
      const d = host.state().drag;
      if (!d || d.pointer !== event.pointerId) return;
      const dx = event.clientX - d.startX;
      const dy = event.clientY - d.startY;
      if (!d.active && Math.hypot(dx, dy) < 4) return;
      if (!d.active) {
        const el = root.querySelector<HTMLElement>(`.z-kanban__card[data-id="${CSS.escape(d.id)}"]`);
        el?.setPointerCapture?.(event.pointerId);
        doc.getSelection?.()?.removeAllRanges();
      }
      event.preventDefault();
      host.update({ drag: { ...d, dx, dy, active: true, target: measureTarget(event.clientX, event.clientY, d.id) }, active: d.id });
    };
    const onUp = (event: PointerEvent) => {
      const s = host.state();
      const d = s.drag;
      if (!d || d.pointer !== event.pointerId) return;
      if (!d.active || !d.target || event.type === "pointercancel") {
        host.update({ drag: null });
        return;
      }
      // `target.index` cuenta sin la tarjeta; moveCard trabaja sobre la lista final, que tampoco la cuenta dos veces.
      const next = moveCard(s.columns, d.id, d.target.column, d.target.index);
      host.update({ drag: null, columns: next, active: d.id }, true);
      if (emitMove(d.id, s.columns, next)) say(placeText(next, d.id, host.config().labels.moved));
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && host.state().drag) {
        event.preventDefault();
        host.update({ drag: null });
      }
    };
    root.addEventListener("keydown", onKey);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("click", onClick);
    root.addEventListener("pointerdown", onDown);
    doc.addEventListener("pointermove", onMove);
    doc.addEventListener("pointerup", onUp);
    doc.addEventListener("pointercancel", onUp);
    doc.addEventListener("keydown", onEscape);
    return () => {
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("click", onClick);
      root.removeEventListener("pointerdown", onDown);
      doc.removeEventListener("pointermove", onMove);
      doc.removeEventListener("pointerup", onUp);
      doc.removeEventListener("pointercancel", onUp);
      doc.removeEventListener("keydown", onEscape);
    };
  },
  after(root, host, focus) {
    if (!focus) return;
    const id = host.state().active;
    const el = id ? root.querySelector<HTMLElement>(`.z-kanban__card[data-id="${CSS.escape(id)}"]`) : null;
    if (el && el !== root.ownerDocument.activeElement) {
      el.focus({ preventScroll: true });
      el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      columns: Array.isArray(json.columns) ? (json.columns as KanbanColumn[]) : [],
      label: d.label ?? el.getAttribute("aria-label") ?? "",
      addable: d.addable !== undefined && d.addable !== "false",
      labels: json.labels as Partial<KanbanLabels> | undefined,
    };
  },
};
