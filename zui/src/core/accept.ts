/** Comprueba un archivo contra una lista `accept` (extensiones, tipos MIME y comodines `tipo/*`). Vacía: todo vale. */
export function matchesAccept(file: { name: string; type: string }, accept: string | null | undefined): boolean {
  const rules = (accept ?? "").split(",").map((rule) => rule.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((rule) => (rule.startsWith(".") ? name.endsWith(rule) : rule.endsWith("/*") ? type.startsWith(rule.slice(0, -1)) : type === rule));
}
