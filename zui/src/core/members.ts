// MemberList: búsqueda (sin distinguir mayúsculas ni acentos), agrupación por rol o por presencia y orden con
// `Intl.Collator`. Sin documento.

import { presenceOf, presenceRank, type PresenceStatus } from "./user-presence";

export interface Member {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  /** Id del rol (uno de `roles`). */
  role: string;
  presence?: PresenceStatus;
  /** Invitación pendiente. */
  pending?: boolean;
}

export interface Role {
  id: string;
  label: string;
  /** No se puede asignar desde la lista (el propietario). */
  locked?: boolean;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase();

/** Miembros cuyo nombre o correo contiene todas las palabras de la búsqueda. */
export function filterMembers<T extends Member>(members: readonly T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...members];
  return members.filter((m) => {
    const hay = fold(`${m.name} ${m.email ?? ""}`);
    return words.every((w) => hay.includes(w));
  });
}

const collators = new Map<string, Intl.Collator>();
function collator(locale?: string): Intl.Collator {
  const key = locale ?? "";
  let c = collators.get(key);
  if (!c) {
    try {
      c = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    } catch {
      c = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    }
    collators.set(key, c);
  }
  return c;
}

/** Orden por nombre (con el collator del idioma), estable. */
export function sortByName<T extends Member>(members: readonly T[], locale?: string): T[] {
  const c = collator(locale);
  return [...members].sort((a, b) => c.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface MemberGroup<T> {
  key: string;
  label: string;
  members: T[];
}

/**
 * Grupos en el orden de `roles` (por rol) o de prioridad de presencia; dentro, por nombre. Los roles sin miembros no
 * salen; un rol desconocido va al final con su id como nombre.
 */
export function groupMembers<T extends Member>(
  members: readonly T[],
  by: "role" | "presence" | "none",
  roles: readonly Role[],
  options: { locale?: string; presenceLabel?: (s: PresenceStatus) => string } = {},
): MemberGroup<T>[] {
  const sorted = sortByName(members, options.locale);
  if (by === "none") return sorted.length ? [{ key: "all", label: "", members: sorted }] : [];
  const groups = new Map<string, MemberGroup<T>>();
  const order: string[] = by === "role" ? roles.map((r) => r.id) : ["online", "busy", "dnd", "away", "oof", "offline"];
  for (const m of sorted) {
    const key = by === "role" ? m.role : presenceOf(m.presence);
    let g = groups.get(key);
    if (!g) {
      const label =
        by === "role" ? (roles.find((r) => r.id === key)?.label ?? key) : (options.presenceLabel?.(key as PresenceStatus) ?? key);
      g = { key, label, members: [] };
      groups.set(key, g);
    }
    g.members.push(m);
  }
  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i < 0 ? order.length : i;
  };
  return [...groups.values()].sort((a, b) => rank(a.key) - rank(b.key) || (a.key < b.key ? -1 : 1));
}

/** Orden por presencia y luego nombre (la gente disponible primero). */
export function sortByPresence<T extends Member>(members: readonly T[], locale?: string): T[] {
  const c = collator(locale);
  return [...members].sort((a, b) => presenceRank(a.presence) - presenceRank(b.presence) || c.compare(a.name, b.name));
}
