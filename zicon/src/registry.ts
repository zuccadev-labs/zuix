import type { IconDef } from "./types";

const registry = new Map<string, IconDef>();
const listeners = new Set<() => void>();

/** Registra iconos para que `<Icon name>` pueda dibujarlos. Idempotente. */
export function registerIcons(defs: readonly IconDef[]): void {
  for (const def of defs) registry.set(def.name, def);
  for (const listener of listeners) listener();
}

/**
 * Avisa cada vez que se registran iconos. Devuelve la función que cancela el aviso. Lo usa `<z-icon>` para
 * dibujar los elementos que se conectaron antes de que su icono estuviera registrado.
 */
export function onIconsRegistered(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getIcon(name: string): IconDef | undefined {
  return registry.get(name);
}

export function registeredIconNames(): string[] {
  return [...registry.keys()].sort();
}
