export function toSlug(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'project';
}

export async function ensureUniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base;
  let i = 2;
  while (await isTaken(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
