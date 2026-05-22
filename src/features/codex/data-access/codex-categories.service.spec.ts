import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore/lite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyCategoryCreate,
  finaliseSave,
} from './codex-categories.service';
import {
  CategoryConflictError,
  CategoryKeyImmutableError,
  CodexCategoriesConfig,
} from './codex-category.types';

interface RecordedOp {
  op: 'set' | 'delete';
  path: string;
  data?: Record<string, unknown>;
}

let database: Map<string, Record<string, unknown>>;
let recordedOps: RecordedOp[];

// A real Firestore handle. `doc()` builds document references offline (no
// I/O), so the production code can construct refs against it; reads and
// writes are served entirely by `fakeTx`. This avoids mocking the
// `firebase/firestore/lite` module, which is unreliable under the bundled
// test runner.
const firestore = getFirestore(initializeApp({ projectId: 'unit-test' }, 'codex-categories-spec'));

const fakeTx = {
  get: async (ref: { path: string }) => {
    const payload = database.get(ref.path);
    return {
      exists: () => payload !== undefined,
      data: () => payload,
      id: ref.path.split('/').pop() ?? '',
    };
  },
  set: (ref: { path: string }, data: Record<string, unknown>) => {
    recordedOps.push({ op: 'set', path: ref.path, data });
    database.set(ref.path, data);
  },
  delete: (ref: { path: string }) => {
    recordedOps.push({ op: 'delete', path: ref.path });
    database.delete(ref.path);
  },
};

const CONFIG_PATH = 'universes/u1/_meta/codex_categories';

beforeEach(() => {
  database = new Map();
  recordedOps = [];
});

function withConfig(config: CodexCategoriesConfig): void {
  database.set(CONFIG_PATH, config as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// finaliseSave — pure reconciliation
// ---------------------------------------------------------------------------

describe('finaliseSave', () => {
  it('generates keys for brand-new categories from the folded label', () => {
    const out = finaliseSave(
      { categories: [], version: 0 },
      { categories: [{ id: 'c1', label: 'Items' }] },
    );
    expect(out.categories[0].key).toBe('items');
  });

  it('preserves existing keys on rename', () => {
    const out = finaliseSave(
      { categories: [{ id: 'c1', key: 'items', label: 'Items' }], version: 1 },
      { categories: [{ id: 'c1', label: 'Items — Equipment' }] },
    );
    expect(out.categories[0].key).toBe('items');
    expect(out.categories[0].label).toBe('Items — Equipment');
  });

  it('rejects an attempt to change an existing category key', () => {
    expect(() =>
      finaliseSave(
        { categories: [{ id: 'c1', key: 'items', label: 'Items' }], version: 1 },
        { categories: [{ id: 'c1', key: 'gear', label: 'Items' }] },
      ),
    ).toThrow(CategoryKeyImmutableError);
  });

  it('rejects empty labels', () => {
    expect(() =>
      finaliseSave(
        { categories: [], version: 0 },
        { categories: [{ id: 'c1', label: '   ' }] },
      ),
    ).toThrow(/label cannot be empty/i);
  });

  it('rejects two categories whose folded labels collide', () => {
    expect(() =>
      finaliseSave(
        { categories: [{ id: 'c1', key: 'items', label: 'Items' }], version: 1 },
        {
          categories: [
            { id: 'c1', key: 'items', label: 'Items' },
            { id: 'c2', label: 'ITEMS' },
          ],
        },
      ),
    ).toThrow(CategoryConflictError);
  });

  it('rejects a new label that folds to another category\'s legacy key', () => {
    expect(() =>
      finaliseSave(
        { categories: [{ id: 'c1', key: 'gear', label: 'Equipment' }], version: 1 },
        {
          categories: [
            { id: 'c1', key: 'gear', label: 'Equipment' },
            { id: 'c2', label: 'Gear' }, // folds to 'gear' which equals c1's key
          ],
        },
      ),
    ).toThrow(CategoryConflictError);
  });

  it('bumps the version', () => {
    const out = finaliseSave(
      { categories: [], version: 7 },
      { categories: [{ id: 'c1', label: 'Lore' }] },
    );
    expect(out.version).toBe(8);
  });

  it('starts version at 1 when no prior version exists', () => {
    const out = finaliseSave(
      { categories: [] },
      { categories: [{ id: 'c1', label: 'Lore' }] },
    );
    expect(out.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// applyCategoryCreate — transactional single-create
// ---------------------------------------------------------------------------

describe('applyCategoryCreate', () => {
  it('appends a new category with generated key and bumps version', async () => {
    withConfig({ categories: [{ id: 'c1', key: 'items', label: 'Items' }], version: 3 });

    const created = await applyCategoryCreate(fakeTx as never, firestore, 'u1', { label: 'Lore' });

    expect(created.key).toBe('lore');
    const written = recordedOps.find((o) => o.path === CONFIG_PATH)!;
    expect(written.op).toBe('set');
    const after = written.data as unknown as CodexCategoriesConfig;
    expect(after.version).toBe(4);
    expect(after.categories.map((c) => c.key)).toEqual(['items', 'lore']);
  });

  it('throws CategoryConflictError when the folded label clashes', async () => {
    withConfig({ categories: [{ id: 'c1', key: 'items', label: 'Items' }], version: 1 });

    await expect(
      applyCategoryCreate(fakeTx as never, firestore, 'u1', { label: 'ITEMS' }),
    ).rejects.toThrow(CategoryConflictError);
  });

  it('rejects an empty / whitespace label', async () => {
    withConfig({ categories: [], version: 0 });

    await expect(
      applyCategoryCreate(fakeTx as never, firestore, 'u1', { label: '   ' }),
    ).rejects.toThrow(/label cannot be empty/i);
  });

  it('initialises an empty config when the doc does not exist yet', async () => {
    // no withConfig — config doc absent
    const created = await applyCategoryCreate(fakeTx as never, firestore, 'u1', { label: 'Lore' });

    expect(created.key).toBe('lore');
    const written = recordedOps.find((o) => o.path === CONFIG_PATH)!;
    const after = written.data as unknown as CodexCategoriesConfig;
    expect(after.version).toBe(1);
    expect(after.categories).toHaveLength(1);
  });
});
