"use client";
// Idioma de los textos propios de los componentes en React. `LocaleProvider` fija el idioma de lo que envuelve (se
// puede anidar); las `labels` por prop siguen mandando. Los componentes de solo marcado, que también se pintan como
// Server Components, no leen contexto: toman el idioma por defecto (el del `LocaleProvider` exterior o `setLocale()`).
import { createContext, createElement, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import {
  formatDate,
  formatList,
  formatNumber,
  hasLocale,
  localize,
  registerLocale,
  setDefaultLocale,
  type LocalePack,
} from "./core/locale";
import { loadLocale } from "./locales/load";

interface LocaleValue {
  locale: string | undefined;
  /** Sube al registrar textos: los consumidores memorizados vuelven a pintar. */
  version: number;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export interface LocaleProviderProps {
  /** Etiqueta BCP 47 del idioma: `es`, `pt-BR`, `fr`, `de`, `en`. */
  locale: string;
  /**
   * Paquetes ya importados (`@zuccadev-labs/zuix-zui/locales/es`, `@zuccadev-labs/zuix-zout/locales/es`). Sin ellos,
   * el proveedor carga los de zui al montar y, mientras tanto, los textos quedan en inglés.
   */
  messages?: LocalePack<object> | readonly LocalePack<object>[];
  children?: ReactNode;
}

const registered = new WeakSet<LocalePack<object>>();

export function LocaleProvider({ locale, messages, children }: LocaleProviderProps) {
  const parent = useContext(LocaleContext);
  const list = messages ? (Array.isArray(messages) ? messages : [messages as LocalePack<object>]) : [];
  // Registrar en el pintado (idempotente) para que el primer pintado ya salga en su idioma, también en el servidor.
  const fresh = list.filter((p) => !registered.has(p));
  if (fresh.length) {
    registerLocale(...fresh);
    for (const p of fresh) registered.add(p);
  }
  // El proveedor exterior fija además el idioma por defecto: lo leen los componentes de solo marcado.
  if (!parent) setDefaultLocale(locale);
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const wanted = useRef(locale);
  wanted.current = locale;
  useEffect(() => {
    if (list.length || hasLocale(locale)) return;
    let live = true;
    loadLocale(locale).then(() => {
      if (live && wanted.current === locale) bump();
    });
    return () => {
      live = false;
    };
  }, [locale, list.length]);
  const value = useMemo(() => ({ locale, version }), [locale, version]);
  return createElement(LocaleContext.Provider, { value }, children);
}

/** Idioma del `LocaleProvider` más cercano, o `undefined` sin proveedor. */
export function useLocaleId(): string | undefined {
  return useContext(LocaleContext)?.locale;
}

export interface LocaleApi {
  /** Idioma vigente: el del proveedor más cercano o el idioma por defecto. */
  locale: string | undefined;
  /** Textos de un espacio de nombres en ese idioma, sobre los de inglés que se le pasan. */
  messages<T extends object>(ns: string, base: T): T;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  formatList(items: readonly string[], options?: Intl.ListFormatOptions): string;
}

/** Idioma vigente y ayudas de formato con `Intl` en ese idioma. */
export function useLocale(): LocaleApi {
  const ctx = useContext(LocaleContext);
  const locale = ctx?.locale;
  const version = ctx?.version ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: la versión cambia cuando llegan textos nuevos.
  return useMemo<LocaleApi>(
    () => ({
      locale,
      messages: (ns, base) => localize(ns, base, locale),
      formatNumber: (value, options) => formatNumber(value, options, locale),
      formatDate: (value, options) => formatDate(value, options, locale),
      formatList: (items, options) => formatList(items, options, locale),
    }),
    [locale, version],
  );
}
