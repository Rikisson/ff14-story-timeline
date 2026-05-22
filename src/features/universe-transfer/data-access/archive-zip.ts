import { AsyncZippable, Unzipped, strFromU8, strToU8, unzip, zip } from 'fflate';
import { UniverseArchive } from './archive-format';

export class ArchiveReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveReadError';
  }
}

export interface ArchiveBinary {
  path: string;
  bytes: Uint8Array;
}

export interface ReadArchiveResult {
  json: UniverseArchive;
  binaries: Map<string, Uint8Array>;
}

const MANIFEST_NAME = 'universe.json';

export async function readArchive(file: File): Promise<ReadArchiveResult> {
  if (file.name.toLowerCase().endsWith('.json')) {
    return { json: parseManifest(await file.text()), binaries: new Map() };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const unzipped = await new Promise<Unzipped>((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(toReadError(err)) : resolve(data)));
  });

  const manifest = unzipped[MANIFEST_NAME];
  if (!manifest) {
    throw new ArchiveReadError('The archive is missing its universe.json file.');
  }

  const binaries = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(unzipped)) {
    if (path === MANIFEST_NAME || path.endsWith('/')) continue;
    binaries.set(path, content);
  }

  return { json: parseManifest(strFromU8(manifest)), binaries };
}

export async function writeArchive(
  json: UniverseArchive,
  binaries: readonly ArchiveBinary[],
): Promise<Blob> {
  const zippable: AsyncZippable = {
    [MANIFEST_NAME]: strToU8(JSON.stringify(json, null, 2)),
  };
  for (const binary of binaries) {
    zippable[binary.path] = binary.bytes;
  }

  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(zippable, (err, data) => (err ? reject(err) : resolve(data)));
  });

  return new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
}

function parseManifest(text: string): UniverseArchive {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ArchiveReadError('universe.json could not be parsed as JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ArchiveReadError('universe.json must contain a JSON object.');
  }
  return parsed as UniverseArchive;
}

function toReadError(err: unknown): ArchiveReadError {
  const detail = err instanceof Error ? err.message : 'unknown error';
  return new ArchiveReadError(`The archive could not be opened (${detail}).`);
}
