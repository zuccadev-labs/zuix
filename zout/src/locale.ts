"use client";
// Textos de los layouts de zout en el idioma del LocaleProvider de zui. Los paquetes de zout (`./locales/<id>`) traen
// los espacios de nombres `chatLayout` y `docsLayout`. Pasados a LocaleProvider (`messages`), salen desde el primer
// pintado; si no, cada layout los carga al montar.
import { useEffect, useReducer } from "react";
import { registerLocale, useLocale, type LocalePack } from "@zuccadev-labs/zuix-zui";

const LOADERS: Record<string, () => Promise<{ default: LocalePack<object> }>> = {
  en: () => import("./locales/en"),
  es: () => import("./locales/es"),
  pt: () => import("./locales/pt"),
  fr: () => import("./locales/fr"),
  de: () => import("./locales/de"),
};
const loaded = new Map<string, Promise<LocalePack<object> | undefined>>();

/** Carga y registra los textos de zout de un idioma (`es`, `pt-BR` → `pt`); `undefined` si no hay. */
export function loadZoutLocale(id: string): Promise<LocalePack<object> | undefined> {
  const base = id.trim().toLowerCase().split(/[-_]/)[0]!;
  let hit = loaded.get(base);
  if (!hit) {
    const load = LOADERS[base];
    hit = load
      ? load().then((m) => {
          registerLocale(m.default);
          return m.default;
        })
      : Promise.resolve(undefined);
    loaded.set(base, hit);
  }
  return hit;
}

/** `useLocale()` de zui, con los textos de zout cargados para el idioma vigente. */
export function useZoutLocale() {
  const api = useLocale();
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const { locale } = api;
  useEffect(() => {
    if (!locale) return;
    let live = true;
    const ready = loaded.has(locale.toLowerCase().split(/[-_]/)[0]!);
    loadZoutLocale(locale).then((pack) => {
      if (live && pack && !ready) bump();
    });
    return () => {
      live = false;
    };
  }, [locale]);
  return api;
}
