// Idioma de los textos propios de los componentes en el modo DOM. `setLocale()` registra un paquete (o lo carga),
// lo deja como idioma por defecto, escribe `lang` en `<html>` (los lectores de pantalla y la traducción automática
// leen el idioma de ahí) y vuelve a pintar las piezas montadas. Dentro de la página manda el `lang` heredado: una
// sección con `lang="fr"` toma los textos en francés si están registrados.
import { registerLocale, resolveLocale, setDefaultLocale, type LocalePack } from "../core/locale";
import { loadLocale } from "../locales/load";

export interface SetLocaleOptions {
  /** Escribir `lang` en `<html>`. Por defecto, sí. */
  document?: boolean;
}

/**
 * Fija el idioma de los componentes: un paquete ya importado, varios (zui y zout), o una etiqueta (`"es"`), que carga
 * el paquete de zui bajo demanda. Devuelve una promesa que se cumple con los textos ya en pantalla.
 */
export async function setLocale(locale: string | LocalePack<object> | readonly LocalePack<object>[], options: SetLocaleOptions = {}): Promise<void> {
  const packs = typeof locale === "string" ? [] : Array.isArray(locale) ? [...locale] : [locale as LocalePack<object>];
  const id = typeof locale === "string" ? locale : packs[0]?.id;
  if (!id) return;
  if (packs.length) registerLocale(...packs);
  else if (!resolveLocale(id)) await loadLocale(id);
  if (options.document !== false && typeof document !== "undefined") document.documentElement.lang = id;
  setDefaultLocale(id);
}

/** Idioma de un elemento: el `lang` heredado si hay textos para él; si no, el idioma por defecto. */
export function localeOf(el: Element): string | undefined {
  const lang = el.closest("[lang]")?.getAttribute("lang");
  return resolveLocale(lang) ? (lang ?? undefined) : undefined;
}
