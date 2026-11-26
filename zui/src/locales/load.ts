// Carga bajo demanda de los paquetes de idioma de zui: cada idioma es un módulo aparte (`./es`, `./pt`…) que el
// empaquetador separa en su propio trozo, y el bundle de navegador en `zui.locale.<id>.js`. Quien ya importó un
// paquete (`@zuccadev-labs/zuix-zui/locales/es`) no necesita esto: lo pasa a `LocaleProvider` o a `setLocale()`.
// Los textos de zout se cargan aparte (`loadZoutLocale`); sus layouts lo hacen solos dentro de un LocaleProvider.
import { registerLocale, type LocalePack } from "../core/locale";

/** Idiomas con paquete en zui. */
export const LOCALES = ["en", "es", "pt", "fr", "de"] as const;
export type LocaleId = (typeof LOCALES)[number];

const LOADERS: Record<LocaleId, () => Promise<{ default: LocalePack<object> }>> = {
  // El inglés son las constantes de cada componente: no hay nada que descargar.
  en: async () => ({ default: { id: "en", messages: {} } }),
  es: () => import("./es"),
  pt: () => import("./pt"),
  fr: () => import("./fr"),
  de: () => import("./de"),
};

/**
 * Carga y registra los textos de un idioma (`es`, `pt-BR` → `pt`). Devuelve los paquetes cargados; vacío si no hay
 * textos para ese idioma (se queda en inglés).
 */
export async function loadLocale(id: string): Promise<LocalePack<object>[]> {
  const base = id.trim().toLowerCase().split(/[-_]/)[0] as LocaleId;
  const own = LOADERS[base];
  if (!own) return [];
  const pack = (await own()).default;
  registerLocale(pack);
  return [pack];
}
