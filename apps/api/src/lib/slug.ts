/** Convierte un texto a slug URL-safe (sin acentos, minúsculas, guiones). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Devuelve un slug único: si `exists(slug)` es true, prueba slug-2, slug-3, ...
 * `excludeId` permite ignorar el propio registro al editar.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'item';
  let candidate = root;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${n++}`;
    if (n > 500) throw new Error('No se pudo generar un slug único');
  }
  return candidate;
}
