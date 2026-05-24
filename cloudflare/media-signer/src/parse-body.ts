export const ASSET_KINDS = ['cover', 'sprite', 'background', 'ambient', 'sfx'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

const PATH_SEGMENT = /^[A-Za-z0-9_-]+$/;
const FILENAME = /^[\w.\-]+$/;

export interface SignBody {
  universeId: string;
  kind: AssetKind;
  assetId: string;
  filename: string;
  byteLength: number;
}

export function parseSignBody(raw: unknown): SignBody {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid body');
  const r = raw as Record<string, unknown>;
  const universeId = String(r['universeId'] ?? '');
  const kind = String(r['kind'] ?? '') as AssetKind;
  const assetId = String(r['assetId'] ?? '');
  const filename = String(r['filename'] ?? '');
  const byteLength = Number(r['byteLength']);
  if (!PATH_SEGMENT.test(universeId)) throw new Error('Invalid universeId');
  if (!ASSET_KINDS.includes(kind)) throw new Error('Invalid kind');
  if (!PATH_SEGMENT.test(assetId)) throw new Error('Invalid assetId');
  if (!FILENAME.test(filename) || filename === '.' || filename === '..') {
    throw new Error('Invalid filename');
  }
  if (!Number.isFinite(byteLength) || byteLength <= 0 || !Number.isInteger(byteLength)) {
    throw new Error('Invalid byteLength');
  }
  return { universeId, kind, assetId, filename, byteLength };
}

export interface DeleteBody {
  universeId: string;
  kind: AssetKind;
  assetId: string;
  filename: string;
}

export function parseDeleteBody(raw: unknown): DeleteBody {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid body');
  const r = raw as Record<string, unknown>;
  const universeId = String(r['universeId'] ?? '');
  const kind = String(r['kind'] ?? '') as AssetKind;
  const assetId = String(r['assetId'] ?? '');
  const filename = String(r['filename'] ?? '');
  if (!PATH_SEGMENT.test(universeId)) throw new Error('Invalid universeId');
  if (!ASSET_KINDS.includes(kind)) throw new Error('Invalid kind');
  if (!PATH_SEGMENT.test(assetId)) throw new Error('Invalid assetId');
  if (!FILENAME.test(filename) || filename === '.' || filename === '..') {
    throw new Error('Invalid filename');
  }
  return { universeId, kind, assetId, filename };
}

const KEY_PATTERN =
  /^universes\/[A-Za-z0-9_-]+\/(cover|sprite|background|ambient|sfx)\/[A-Za-z0-9_-]+\/[\w.\-]+$/;

export interface BulkDeleteBody {
  universeId: string;
  keys: string[];
}

export function parseBulkDeleteBody(raw: unknown): BulkDeleteBody {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid body');
  const r = raw as Record<string, unknown>;
  const universeId = String(r['universeId'] ?? '');
  const keysRaw = r['keys'];
  if (!PATH_SEGMENT.test(universeId)) throw new Error('Invalid universeId');
  if (!Array.isArray(keysRaw)) throw new Error('Invalid keys');
  if (keysRaw.length === 0) throw new Error('Invalid keys: empty');
  if (keysRaw.length > 50) throw new Error('Invalid keys: max 50 per call');
  const keys: string[] = [];
  for (const k of keysRaw) {
    if (typeof k !== 'string') throw new Error('Invalid keys: non-string entry');
    if (!KEY_PATTERN.test(k)) throw new Error(`Invalid key: ${k}`);
    const segments = k.split('/');
    if (segments[1] !== universeId) throw new Error('Key universeId mismatch');
    keys.push(k);
  }
  return { universeId, keys };
}
