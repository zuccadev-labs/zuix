import type { IconDef } from "./types";

const registry = new Map<string, IconDef>();

/** Registra iconos para que `<Icon name>` pueda dibujarlos. Idempotente. */
export function registerIcons(defs: readonly IconDef[]): void {
  for (const def of defs) registry.set(def.name, def);
}

export function getIcon(name: string): IconDef | undefined {
  return registry.get(name);
}

export function registeredIconNames(): string[] {
  return [...registry.keys()].sort();
}
