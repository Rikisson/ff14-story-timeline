/**
 * Normalizer for `labelFolded` / `titleFolded` projection fields and for
 * codex category keys. Per `docs/backend-rules.md` *Folded keys* every
 * writer routes through this same util — divergent folding silently misses
 * prefix queries.
 *
 * Pipeline: NFKD form → strip combining diacritics → lowercase. The
 * trailing lowercase honours Unicode case folding for non-ASCII letters
 * (e.g. Cyrillic `Д` → `д`).
 */
export function foldLabel(value: string | null | undefined): string {
  if (!value) return '';
  return value.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase();
}
