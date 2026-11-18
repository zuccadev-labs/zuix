/**
 * Claves de React para una lista sin identificadores propios: cada elemento se identifica por su contenido y, si se
 * repite, por el número de repetición (`"Ctrl"`, `"Ctrl#1"`). A diferencia del índice, la clave sigue al elemento
 * cuando la lista se reordena o pierde entradas por delante.
 */
export function occurrenceKeys(ids: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return ids.map((id) => {
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    return count === 0 ? id : `${id}#${count}`;
  });
}
