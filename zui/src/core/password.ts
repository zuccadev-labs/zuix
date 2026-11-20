// Estimación orientativa de la fortaleza de una contraseña para el medidor de PasswordInput. No sustituye a la
// comprobación del servidor (listas de contraseñas filtradas, políticas): solo guía a la persona mientras escribe.
// Sin DOM ni efectos al importar.

export interface PasswordChecks {
  /** Al menos `minLength` caracteres (8 por defecto). */
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  symbol: boolean;
}

export interface PasswordStrength {
  /** 0 (vacía o muy débil) a 4 (fuerte). */
  score: 0 | 1 | 2 | 3 | 4;
  checks: PasswordChecks;
}

/** Comprobaciones básicas y una puntuación de 0 a 4 por longitud y variedad, con penalización de repeticiones. */
export function passwordStrength(value: string, minLength = 8): PasswordStrength {
  const checks: PasswordChecks = {
    length: [...value].length >= minLength,
    lower: /\p{Ll}/u.test(value),
    upper: /\p{Lu}/u.test(value),
    digit: /\p{Nd}/u.test(value),
    symbol: /[^\p{L}\p{Nd}\s]/u.test(value),
  };
  if (!value) return { score: 0, checks };
  const length = [...value].length;
  const variety = [checks.lower, checks.upper, checks.digit, checks.symbol].filter(Boolean).length;
  let points = 0;
  if (length >= minLength) points += 1;
  if (length >= minLength + 4) points += 1;
  if (length >= minLength + 8) points += 1;
  points += Math.max(0, variety - 1);
  // Pocos caracteres distintos («aaaaaaaa», «12121212») restan.
  const distinct = new Set(value).size;
  if (distinct <= Math.max(2, length / 4)) points -= 2;
  if (length < minLength) points = Math.min(points, 1);
  const score = Math.max(length > 0 ? 1 : 0, Math.min(4, Math.round((points * 4) / 6))) as PasswordStrength["score"];
  return { score, checks };
}
