/**
 * Deterministic 12-char SHA-256 prefix over a projection's projected slice.
 *
 * Per `docs/backend-rules.md` *Drift detection* every projection writer and
 * the rebuild script must produce the same hash for the same projected
 * slice — divergence here causes spurious-rebuild noise. To enforce that,
 * this util canonicalises before hashing:
 *
 * - object keys serialised in sorted order
 * - string values trimmed and Unicode-normalised (NFC)
 * - arrays of strings sorted ascending (covers `characterIds`,
 *   `placeIds`, tag lists)
 * - arrays of objects keep their order (sequence-meaningful)
 * - `undefined`, `null`, and `[]` collapse to a single canonical form
 *   (omitted from the serialisation)
 *
 * Hash is SHA-256 via SubtleCrypto, hex-encoded, first 12 characters.
 * SubtleCrypto is available in browsers and Node 18+ (used in SSR).
 */

export type CanonicalisableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | CanonicalisableValue[]
  | { [key: string]: CanonicalisableValue };

export async function computeSourceFingerprint(
  slice: CanonicalisableValue,
): Promise<string> {
  const canonical = canonicalise(slice);
  const payload = JSON.stringify(canonical);
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest)).slice(0, 12);
}

function canonicalise(value: CanonicalisableValue): CanonicalisableValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed.normalize('NFC');
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return canonicaliseArray(value);
  return canonicaliseObject(value);
}

function canonicaliseArray(arr: CanonicalisableValue[]): CanonicalisableValue {
  const cleaned = arr
    .map(canonicalise)
    .filter((v) => v !== null);
  if (cleaned.length === 0) return null;
  if (cleaned.every((v) => typeof v === 'string')) {
    return [...(cleaned as string[])].sort();
  }
  return cleaned;
}

function canonicaliseObject(
  obj: { [key: string]: CanonicalisableValue },
): CanonicalisableValue {
  const keys = Object.keys(obj).sort();
  const out: { [key: string]: CanonicalisableValue } = {};
  for (const key of keys) {
    const v = canonicalise(obj[key]);
    if (v === null) continue;
    out[key] = v;
  }
  return Object.keys(out).length === 0 ? null : out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}
