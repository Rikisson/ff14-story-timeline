export const FIRESTORE_BATCH_LIMIT = 450;
export const R2_BULK_DELETE_CHUNK = 50;

export const SUBCOLLECTIONS_TO_DELETE: readonly string[] = [
  'characters',
  'places',
  'events',
  'plotlines',
  'codexEntries',
  '_directory',
  '_timelineEntries',
  // No longer written; kept so universes created before its removal still purge fully.
  '_timelineLaneEntries',
  '_slugIndex',
  '_meta',
];

export function chunkInto<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0 || !Number.isFinite(size)) {
    throw new Error(`Invalid chunk size: ${size}`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export interface AssetWithObjects {
  objects?: { key: string; bytes: number }[];
}

export function collectAssetKeys(assets: readonly AssetWithObjects[]): string[] {
  const keys: string[] = [];
  for (const a of assets) {
    if (!a.objects) continue;
    for (const o of a.objects) keys.push(o.key);
  }
  return keys;
}
