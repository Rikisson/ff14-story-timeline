import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION, UniverseArchive } from './archive-format';
import { ArchiveReadError, readArchive, writeArchive } from './archive-zip';

const SAMPLE: UniverseArchive = {
  formatVersion: FORMAT_VERSION,
  characters: [{ slug: 'eldrin', name: 'Eldrin' }],
};

describe('writeArchive / readArchive', () => {
  it('round-trips the manifest JSON through a zip', async () => {
    const blob = await writeArchive(SAMPLE, []);
    const result = await readArchive(new File([blob], 'test.universe'));
    expect(result.json).toEqual(SAMPLE);
    expect(result.binaries.size).toBe(0);
  });

  it('round-trips binary entries', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const blob = await writeArchive(SAMPLE, [{ path: 'assets/cover.webp', bytes }]);
    const result = await readArchive(new File([blob], 'test.universe'));
    expect(result.binaries.get('assets/cover.webp')).toEqual(bytes);
  });

  it('reads a plain .json file with no binaries', async () => {
    const file = new File([JSON.stringify(SAMPLE)], 'universe.json', { type: 'application/json' });
    const result = await readArchive(file);
    expect(result.json).toEqual(SAMPLE);
    expect(result.binaries.size).toBe(0);
  });

  it('throws ArchiveReadError on invalid JSON', async () => {
    await expect(readArchive(new File(['not json'], 'broken.json'))).rejects.toThrow(
      ArchiveReadError,
    );
  });
});
