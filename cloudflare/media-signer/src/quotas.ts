import { AssetKind } from './parse-body';

export const STORED_CAP_BYTES: Record<AssetKind, number> = {
  cover: 2_621_440,
  background: 2_621_440,
  sprite: 4_194_304,
  ambient: 10_485_760,
  sfx: 3_145_728,
};

export const UNIVERSE_STORAGE_CAP_BYTES = 500 * 1024 * 1024;
export const UNIVERSE_ASSET_COUNT_CAP = 500;

export function assertByteCap(kind: AssetKind, byteLength: number): void {
  const max = STORED_CAP_BYTES[kind];
  if (byteLength > max) {
    throw new Error(
      `File is too large (${formatBytes(byteLength)}). Maximum for ${kind} is ${formatBytes(max)}.`,
    );
  }
}

export interface UniverseCapInput {
  storageBytes: number;
  assetCount: number;
  byteLength: number;
}

export function assertUniverseCap(input: UniverseCapInput): void {
  if (input.assetCount >= UNIVERSE_ASSET_COUNT_CAP) {
    throw new Error(
      `Universe asset count cap reached (${UNIVERSE_ASSET_COUNT_CAP}). Delete unused assets to free space.`,
    );
  }
  if (input.storageBytes + input.byteLength > UNIVERSE_STORAGE_CAP_BYTES) {
    throw new Error(
      `Universe storage cap exceeded. ${formatBytes(input.storageBytes)} of ${formatBytes(
        UNIVERSE_STORAGE_CAP_BYTES,
      )} in use; this upload needs ${formatBytes(input.byteLength)}.`,
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
