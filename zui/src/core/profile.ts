// ProfileEditor: reglas de cada campo (nombre, usuario, correo, web, biografía) con mensajes que dicen cómo
// corregirlo, y el contador de la biografía. Lo comparten el binding de React y el modo DOM. Sin documento.

export interface ProfileValues {
  name: string;
  handle: string;
  email: string;
  website: string;
  bio: string;
  location?: string;
}

export interface ProfileLabels {
  nameRequired: string;
  handleRequired: string;
  /** «Use 3 to 30 letters, numbers, dots or underscores.» */
  handleFormat: string;
  handleTaken: string;
  emailFormat: string;
  websiteFormat: string;
  /** «Keep it under {max} characters.» */
  bioTooLong: string;
  /** «{count} of {max}» */
  counter: string;
}

export const PROFILE_LABELS: ProfileLabels = {
  nameRequired: "Enter your name.",
  handleRequired: "Choose a username.",
  handleFormat: "Use 3 to 30 letters, numbers, dots or underscores, starting with a letter.",
  handleTaken: "That username is taken. Try another one.",
  emailFormat: "Enter an email address like you@example.com.",
  websiteFormat: "Enter a web address that starts with https://.",
  bioTooLong: "Keep it under {max} characters.",
  counter: "{count} of {max}",
};

export const BIO_MAX = 160;
/** Usuario: empieza por letra, 3–30 de letras, cifras, punto o guion bajo, sin dos puntos seguidos ni punto final. */
export const HANDLE_PATTERN = "[A-Za-z][A-Za-z0-9_.]{2,29}";
const HANDLE_RE = /^[A-Za-z][A-Za-z0-9_.]{2,29}$/;

/** Usuario sin la arroba inicial ni espacios. */
export const cleanHandle = (v: string) => v.trim().replace(/^@+/, "");

export function validHandle(v: string): boolean {
  const h = cleanHandle(v);
  return HANDLE_RE.test(h) && !h.includes("..") && !h.endsWith(".");
}

export function validEmail(v: string): boolean {
  const t = v.trim();
  return t === "" || /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(t);
}

export function validWebsite(v: string): boolean {
  const t = v.trim();
  if (t === "") return true;
  try {
    const u = new URL(t);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Longitud en caracteres que ve la persona (grafemas aproximados por puntos de código). */
export const visibleLength = (v: string) => Array.from(v).length;

export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;

/**
 * Errores de un perfil. `taken` dice si un usuario ya existe (lo decide la aplicación). Solo se valida lo que hay en
 * `fields` (por defecto, todo): así un campo se valida al salir de él sin marcar los demás.
 */
export function validateProfile(
  v: Partial<ProfileValues>,
  options: {
    labels?: Partial<ProfileLabels>;
    taken?: (handle: string) => boolean;
    bioMax?: number;
    fields?: readonly (keyof ProfileValues)[];
  } = {},
): ProfileErrors {
  const l = { ...PROFILE_LABELS, ...options.labels };
  const max = options.bioMax ?? BIO_MAX;
  const want = (k: keyof ProfileValues) => !options.fields || options.fields.includes(k);
  const errors: ProfileErrors = {};
  if (want("name") && !(v.name ?? "").trim()) errors.name = l.nameRequired;
  if (want("handle")) {
    const h = cleanHandle(v.handle ?? "");
    if (!h) errors.handle = l.handleRequired;
    else if (!validHandle(h)) errors.handle = l.handleFormat;
    else if (options.taken?.(h)) errors.handle = l.handleTaken;
  }
  if (want("email") && !validEmail(v.email ?? "")) errors.email = l.emailFormat;
  if (want("website") && !validWebsite(v.website ?? "")) errors.website = l.websiteFormat;
  if (want("bio") && visibleLength(v.bio ?? "") > max) errors.bio = l.bioTooLong.replace("{max}", String(max));
  return errors;
}

/** Texto del contador de la biografía. */
export const bioCounter = (bio: string, max = BIO_MAX, labels: Partial<ProfileLabels> = {}) =>
  (labels.counter ?? PROFILE_LABELS.counter).replace("{count}", String(visibleLength(bio))).replace("{max}", String(max));
