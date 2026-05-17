import { beforeEach, describe, expect, it, vi } from 'vitest';

interface DocRef {
  path: string;
}

interface RecordedOp {
  op: 'set' | 'delete';
  path: string;
  data?: Record<string, unknown>;
}

let database: Map<string, Record<string, unknown>>;
let recordedOps: RecordedOp[];

vi.mock('firebase/firestore/lite', () => {
  return {
    doc: (_firestore: unknown, ...parts: string[]) => ({ path: parts.join('/') }) as DocRef,
    collection: (..._args: unknown[]) => ({}),
    getDoc: async () => ({ exists: () => false, data: () => undefined }),
    getDocs: async () => ({ empty: true, size: 0, docs: [] }),
    query: (..._args: unknown[]) => ({}),
    where: (..._args: unknown[]) => ({}),
    limit: (..._args: unknown[]) => ({}),
    runTransaction: async (_firestore: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async (ref: DocRef) => {
          const payload = database.get(ref.path);
          return {
            exists: () => payload !== undefined,
            data: () => payload,
            id: ref.path.split('/').pop() ?? '',
          };
        },
        set: (ref: DocRef, data: Record<string, unknown>) => {
          recordedOps.push({ op: 'set', path: ref.path, data });
          database.set(ref.path, data);
        },
        delete: (ref: DocRef) => {
          recordedOps.push({ op: 'delete', path: ref.path });
          database.delete(ref.path);
        },
      };
      return fn(tx);
    },
  };
});

import {
  applyCategoryCreate,
  finaliseSave,
} from './codex-categories.service';
import {
  CategoryConflictError,
  CategoryKeyImmutableError,
  CodexCategoriesConfig,
} from './codex-category.types';

const FAKE_FIRESTORE = {} as never;
const CONFIG_PATH = 'universes/u1/_meta/codex_categories';

beforeEach(() => {
  database = new Map();
  recordedOps = [];
});

function withConfig(config: CodexCategoriesConfig): void {
  database.set(CONFIG_PATH, config as unknown as Record<string, unknown>);
}

async function runTx<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
  // Convenience that mirrors the production runTransaction surface.
  const lite = await import('firebase/firestore/lite');
  return lite.runTransaction(FAKE_FIRESTORE, fn) as Promise<T>;
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

    const created = await runTx((tx) =>
      applyCategoryCreate(tx as never, FAKE_FIRESTORE, 'u1', { label: 'Lore' }),
    );

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
      runTx((tx) =>
        applyCategoryCreate(tx as never, FAKE_FIRESTORE, 'u1', { label: 'ITEMS' }),
      ),
    ).rejects.toThrow(CategoryConflictError);
  });

  it('rejects an empty / whitespace label', async () => {
    withConfig({ categories: [], version: 0 });

    await expect(
      runTx((tx) =>
        applyCategoryCreate(tx as never, FAKE_FIRESTORE, 'u1', { label: '   ' }),
      ),
    ).rejects.toThrow(/label cannot be empty/i);
  });

  it('initialises an empty config when the doc does not exist yet', async () => {
    // no withConfig — config doc absent
    const created = await runTx((tx) =>
      applyCategoryCreate(tx as never, FAKE_FIRESTORE, 'u1', { label: 'Lore' }),
    );
    expect(created.key).toBe('lore');
    const written = recordedOps.find((o) => o.path === CONFIG_PATH)!;
    const after = written.data as unknown as CodexCategoriesConfig;
    expect(after.version).toBe(1);
    expect(after.categories).toHaveLength(1);
  });
});

