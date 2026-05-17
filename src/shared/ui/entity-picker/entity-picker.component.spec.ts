import { computed, Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EntityDirectoryService,
  EntityResolverCache,
  PrefixSearchOptions,
  ResolvedDirectoryRow,
} from '@shared/data-access';
import { UniverseStore } from '@features/universes';
import { EntityKind, EntityRef } from '@shared/models';
import {
  EntityPickerComponent,
  EntityPickerCreateOption,
} from './entity-picker.component';

interface PendingCall {
  options: PrefixSearchOptions;
  resolve: (rows: ResolvedDirectoryRow[]) => void;
  reject: (err: unknown) => void;
}

/**
 * In-memory directory stub. The picker fires a search on mount (the
 * `effect` reads `kinds` / `includeDrafts`), so tests must either drain
 * the initial call(s) or address responses by query string. Helpers
 * cover both — `resolveAllPending` blanket-flushes; `resolveByQuery`
 * targets one specific call.
 */
class FakeDirectoryService {
  readonly calls: PrefixSearchOptions[] = [];
  readonly pending: PendingCall[] = [];

  prefixSearch(opts: PrefixSearchOptions): Promise<ResolvedDirectoryRow[]> {
    this.calls.push(opts);
    return new Promise<ResolvedDirectoryRow[]>((resolve, reject) => {
      this.pending.push({ options: opts, resolve, reject });
    });
  }

  resolveByQuery(query: string, rows: ResolvedDirectoryRow[]): void {
    const idx = this.pending.findIndex((p) => p.options.query === query);
    if (idx === -1) throw new Error(`No pending prefixSearch for query "${query}".`);
    const [p] = this.pending.splice(idx, 1);
    p.resolve(rows);
  }

  rejectByQuery(query: string, err: unknown): void {
    const idx = this.pending.findIndex((p) => p.options.query === query);
    if (idx === -1) throw new Error(`No pending prefixSearch for query "${query}".`);
    const [p] = this.pending.splice(idx, 1);
    p.reject(err);
  }

  /** Drain every queued call with empty rows. Useful right after mount. */
  resolveAllPending(): void {
    while (this.pending.length > 0) {
      const p = this.pending.shift()!;
      p.resolve([]);
    }
  }
}

/**
 * After mounting, the constructor's `effect` queues at least one
 * `prefixSearch` (one per kind when `kinds` is set, or one
 * cross-kind call). Drain those before driving the test scenario so
 * subsequent assertions see only the calls the test triggered.
 */
async function drainMountCalls(directory: FakeDirectoryService): Promise<void> {
  // Allow the effect's microtask queue to flush so `pending` is populated.
  await Promise.resolve();
  await Promise.resolve();
  directory.resolveAllPending();
  await Promise.resolve();
  directory.calls.length = 0;
}

/**
 * `EntityResolverCache` returns a per-ref signal carrying the resolved
 * directory row. The fake mirrors that shape; tests seed it before the
 * picker mounts so chip rendering has the row available synchronously.
 */
class FakeEntityResolverCache {
  private readonly map = new Map<string, ResolvedDirectoryRow>();

  setResolved(rows: ResolvedDirectoryRow[]): void {
    for (const r of rows) this.map.set(`${r.kind}:${r.id}`, r);
  }

  resolve(ref: EntityRef | null | undefined): Signal<ResolvedDirectoryRow | null> {
    if (!ref) return signal<ResolvedDirectoryRow | null>(null).asReadonly();
    return signal<ResolvedDirectoryRow | null>(
      this.map.get(`${ref.kind}:${ref.id}`) ?? null,
    ).asReadonly();
  }

  resolveMany(
    refsSignal: Signal<readonly EntityRef[]>,
  ): Signal<Map<string, ResolvedDirectoryRow>> {
    return computed(() => {
      const out = new Map<string, ResolvedDirectoryRow>();
      for (const ref of refsSignal()) {
        const key = `${ref.kind}:${ref.id}`;
        const row = this.map.get(key);
        if (row) out.set(key, row);
      }
      return out;
    });
  }
}

class FakeUniverseStore {
  private readonly _id = signal<string | null>('u1');
  activeUniverseId(): string | null {
    return this._id();
  }
  setActiveUniverseId(id: string | null): void {
    this._id.set(id);
  }
}

interface MountOptions {
  value?: EntityRef[];
  kinds?: EntityKind[];
  includeDrafts?: boolean;
  multiple?: boolean;
  maxSelections?: number | null;
  placeholder?: string;
  disabled?: boolean;
  createOption?: EntityPickerCreateOption | null;
}

function mount(
  fakes: {
    directory: FakeDirectoryService;
    resolver: FakeEntityResolverCache;
    universes: FakeUniverseStore;
  },
  inputs: MountOptions = {},
) {
  TestBed.configureTestingModule({
    imports: [EntityPickerComponent, TranslocoTestingModule.forRoot({ langs: {} })],
    providers: [
      { provide: EntityDirectoryService, useValue: fakes.directory },
      { provide: EntityResolverCache, useValue: fakes.resolver },
      { provide: UniverseStore, useValue: fakes.universes },
    ],
  });
  const fixture = TestBed.createComponent(EntityPickerComponent);
  fixture.componentRef.setInput('value', inputs.value ?? []);
  if (inputs.kinds !== undefined) fixture.componentRef.setInput('kinds', inputs.kinds);
  if (inputs.includeDrafts !== undefined)
    fixture.componentRef.setInput('includeDrafts', inputs.includeDrafts);
  if (inputs.multiple !== undefined) fixture.componentRef.setInput('multiple', inputs.multiple);
  if (inputs.maxSelections !== undefined)
    fixture.componentRef.setInput('maxSelections', inputs.maxSelections);
  if (inputs.placeholder !== undefined)
    fixture.componentRef.setInput('placeholder', inputs.placeholder);
  if (inputs.disabled !== undefined) fixture.componentRef.setInput('disabled', inputs.disabled);
  if (inputs.createOption !== undefined)
    fixture.componentRef.setInput('createOption', inputs.createOption);
  fixture.detectChanges();
  return fixture;
}

/** Cast to access the protected/private surface tests need to drive. */
type PickerInternals = {
  open: { set(open: boolean): void; (): boolean };
  query: { set(q: string): void; (): string };
  results: { set(r: unknown): void; () : unknown[] };
  activeIndex: { (): number; set(n: number): void };
  loading: () => boolean;
  error: () => unknown;
  showCreateRow: () => boolean;
  visibleResults: () => Array<{ refKey: string; label: string; draft: boolean }>;
  onFocus(): void;
  onKey(e: KeyboardEvent): void;
  onItemMouseDown(e: MouseEvent, row: { kind: EntityKind; id: string }): void;
  onCreateMouseDown(e: MouseEvent): void;
  onRetryMouseDown(e: MouseEvent): void;
  remove(refKey: string): void;
  runSearch(q: string): Promise<void>;
};

function internals(fixture: ReturnType<typeof mount>): PickerInternals {
  return fixture.componentInstance as unknown as PickerInternals;
}

function makeRow(
  partial: Partial<ResolvedDirectoryRow> & { kind: EntityKind; id: string; label: string },
): ResolvedDirectoryRow {
  return {
    kind: partial.kind,
    id: partial.id,
    label: partial.label,
    slug: partial.slug ?? `${partial.id}-slug`,
    coverAssetId: partial.coverAssetId,
    secondary: partial.secondary,
    categoryKey: partial.categoryKey,
    status: partial.status,
    draft: partial.draft,
  };
}

describe('EntityPickerComponent', () => {
  let directory: FakeDirectoryService;
  let resolver: FakeEntityResolverCache;
  let universes: FakeUniverseStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    directory = new FakeDirectoryService();
    resolver = new FakeEntityResolverCache();
    universes = new FakeUniverseStore();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('chips', () => {
    it('renders one chip per selected ref with the resolved label', () => {
      resolver.setResolved([
        makeRow({ kind: 'character', id: 'c1', label: 'Alice' }),
        makeRow({ kind: 'place', id: 'p1', label: 'Vault' }),
      ]);
      const fx = mount(
        { directory, resolver, universes },
        {
          value: [
            { kind: 'character', id: 'c1' },
            { kind: 'place', id: 'p1' },
          ],
        },
      );
      const chips = (fx.nativeElement as HTMLElement).querySelectorAll('li button');
      expect(chips.length).toBe(2);
      expect(chips[0].textContent).toContain('Alice');
      expect(chips[1].textContent).toContain('Vault');
    });

    it('falls back to "?" when the resolver has no row yet (avoids leaking the raw GUID)', () => {
      const fx = mount(
        { directory, resolver, universes },
        { value: [{ kind: 'character', id: 'c1' }] },
      );
      const chip = (fx.nativeElement as HTMLElement).querySelector('li button');
      expect(chip?.textContent).toContain('?');
      expect(chip?.textContent).not.toContain('c1');
    });

    it('shows the draft pill on chips marked draft', () => {
      resolver.setResolved([
        makeRow({ kind: 'character', id: 'c1', label: 'Draft hero', draft: true }),
      ]);
      const fx = mount(
        { directory, resolver, universes },
        { value: [{ kind: 'character', id: 'c1' }] },
      );
      const draftPill = (fx.nativeElement as HTMLElement).querySelector(
        'li button span.bg-warning-soft',
      );
      expect(draftPill).not.toBeNull();
    });

    it('emits valueChange minus the removed ref when a chip is clicked', () => {
      resolver.setResolved([
        makeRow({ kind: 'character', id: 'c1', label: 'Alice' }),
        makeRow({ kind: 'place', id: 'p1', label: 'Vault' }),
      ]);
      const fx = mount(
        { directory, resolver, universes },
        {
          value: [
            { kind: 'character', id: 'c1' },
            { kind: 'place', id: 'p1' },
          ],
        },
      );
      const emitted: EntityRef[][] = [];
      fx.componentInstance.valueChange.subscribe((v) => emitted.push(v));
      internals(fx).remove('character:c1');
      expect(emitted).toEqual([[{ kind: 'place', id: 'p1' }]]);
    });
  });

  describe('result list', () => {
    it('hides already-selected refs from the visible results', async () => {
      const fx = mount(
        { directory, resolver, universes },
        { value: [{ kind: 'character', id: 'c1' }] },
      );
      await drainMountCalls(directory);
      internals(fx).results.set([
        { refKey: 'character:c1', kind: 'character', id: 'c1', label: 'Alice', draft: false },
        { refKey: 'character:c2', kind: 'character', id: 'c2', label: 'Bob', draft: false },
      ] as unknown[]);
      const visible = internals(fx).visibleResults();
      expect(visible.map((r) => r.label)).toEqual(['Bob']);
    });

    it('selects a single ref on click when multiple=false (replaces previous)', () => {
      const fx = mount(
        { directory, resolver, universes },
        {
          multiple: false,
          value: [{ kind: 'character', id: 'c1' }],
        },
      );
      const emitted: EntityRef[][] = [];
      fx.componentInstance.valueChange.subscribe((v) => emitted.push(v));
      internals(fx).open.set(true);
      internals(fx).results.set([
        { refKey: 'character:c2', kind: 'character', id: 'c2', label: 'Bob', draft: false },
      ] as unknown[]);
      internals(fx).onItemMouseDown(
        new MouseEvent('mousedown'),
        { kind: 'character', id: 'c2' },
      );
      expect(emitted).toEqual([[{ kind: 'character', id: 'c2' }]]);
    });

    it('appends to value when multiple=true', () => {
      const fx = mount(
        { directory, resolver, universes },
        { value: [{ kind: 'character', id: 'c1' }] },
      );
      const emitted: EntityRef[][] = [];
      fx.componentInstance.valueChange.subscribe((v) => emitted.push(v));
      internals(fx).open.set(true);
      internals(fx).results.set([
        { refKey: 'character:c2', kind: 'character', id: 'c2', label: 'Bob', draft: false },
      ] as unknown[]);
      internals(fx).onItemMouseDown(
        new MouseEvent('mousedown'),
        { kind: 'character', id: 'c2' },
      );
      expect(emitted).toEqual([
        [
          { kind: 'character', id: 'c1' },
          { kind: 'character', id: 'c2' },
        ],
      ]);
    });

    it('blocks selection once maxSelections is reached', () => {
      const fx = mount(
        { directory, resolver, universes },
        {
          maxSelections: 1,
          value: [{ kind: 'character', id: 'c1' }],
        },
      );
      const emitted: EntityRef[][] = [];
      fx.componentInstance.valueChange.subscribe((v) => emitted.push(v));
      internals(fx).open.set(true);
      internals(fx).results.set([
        { refKey: 'character:c2', kind: 'character', id: 'c2', label: 'Bob', draft: false },
      ] as unknown[]);
      internals(fx).onItemMouseDown(
        new MouseEvent('mousedown'),
        { kind: 'character', id: 'c2' },
      );
      expect(emitted).toEqual([]);
    });
  });

  describe('keyboard', () => {
    function makeKey(key: string): KeyboardEvent {
      return new KeyboardEvent('keydown', { key, cancelable: true });
    }

    it('ArrowDown / ArrowUp cycle activeIndex over visibleResults', () => {
      const fx = mount({ directory, resolver, universes });
      internals(fx).results.set([
        { refKey: 'character:a', kind: 'character', id: 'a', label: 'A', draft: false },
        { refKey: 'character:b', kind: 'character', id: 'b', label: 'B', draft: false },
      ] as unknown[]);
      internals(fx).open.set(true);

      internals(fx).onKey(makeKey('ArrowDown'));
      expect(internals(fx).activeIndex()).toBe(1);
      internals(fx).onKey(makeKey('ArrowDown'));
      expect(internals(fx).activeIndex()).toBe(0); // wraps
      internals(fx).onKey(makeKey('ArrowUp'));
      expect(internals(fx).activeIndex()).toBe(1); // wraps backward
    });

    it('Enter commits the active row', () => {
      const fx = mount({ directory, resolver, universes });
      const emitted: EntityRef[][] = [];
      fx.componentInstance.valueChange.subscribe((v) => emitted.push(v));
      internals(fx).results.set([
        { refKey: 'character:a', kind: 'character', id: 'a', label: 'A', draft: false },
      ] as unknown[]);
      internals(fx).open.set(true);
      internals(fx).activeIndex.set(0);
      internals(fx).onKey(makeKey('Enter'));
      expect(emitted).toEqual([[{ kind: 'character', id: 'a' }]]);
    });

    it('Escape clears the query when one is set; closes when empty', () => {
      const fx = mount({ directory, resolver, universes });
      internals(fx).open.set(true);
      internals(fx).query.set('foo');
      internals(fx).onKey(makeKey('Escape'));
      expect(internals(fx).query()).toBe('');
      expect(internals(fx).open()).toBe(true); // still open after clearing
      internals(fx).onKey(makeKey('Escape'));
      expect(internals(fx).open()).toBe(false);
    });

    it('Backspace removes the last selected ref when the query is empty', () => {
      const fx = mount(
        { directory, resolver, universes },
        {
          value: [
            { kind: 'character', id: 'a' },
            { kind: 'place', id: 'b' },
          ],
        },
      );
      const emitted: EntityRef[][] = [];
      fx.componentInstance.valueChange.subscribe((v) => emitted.push(v));
      internals(fx).onKey(new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true }));
      expect(emitted).toEqual([[{ kind: 'character', id: 'a' }]]);
    });

    it('Backspace is a no-op while the query has content', () => {
      const fx = mount(
        { directory, resolver, universes },
        { value: [{ kind: 'character', id: 'a' }] },
      );
      internals(fx).query.set('typing');
      const emitted: EntityRef[][] = [];
      fx.componentInstance.valueChange.subscribe((v) => emitted.push(v));
      internals(fx).onKey(new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true }));
      expect(emitted).toEqual([]);
    });
  });

  describe('search', () => {
    it('skips the directory call when no active universe is set', async () => {
      universes.setActiveUniverseId(null);
      const fx = mount({ directory, resolver, universes });
      // Mount also fires runSearch; with no universe, calls stay at zero.
      await Promise.resolve();
      await Promise.resolve();
      await internals(fx).runSearch('alice');
      expect(directory.calls).toEqual([]);
      expect(internals(fx).loading()).toBe(false);
    });

    it('writes results into state once the directory call resolves', async () => {
      const fx = mount({ directory, resolver, universes });
      await drainMountCalls(directory);
      const search = internals(fx).runSearch('al');
      expect(internals(fx).loading()).toBe(true);
      directory.resolveByQuery('al', [makeRow({ kind: 'character', id: 'c1', label: 'Alice' })]);
      await search;
      expect(internals(fx).loading()).toBe(false);
      expect(internals(fx).visibleResults().map((r) => r.label)).toEqual(['Alice']);
    });

    it('drops a stale response when a newer query lands first (stale-response guard)', async () => {
      const fx = mount({ directory, resolver, universes });
      await drainMountCalls(directory);
      const first = internals(fx).runSearch('alpha');
      const second = internals(fx).runSearch('beta');
      // Resolve the newer (beta) call first — alpha must not overwrite it.
      directory.resolveByQuery('beta', [makeRow({ kind: 'character', id: 'b', label: 'Bertha' })]);
      directory.resolveByQuery('alpha', [makeRow({ kind: 'character', id: 'a', label: 'Alpha' })]);
      await Promise.all([first, second]);
      const labels = internals(fx).visibleResults().map((r) => r.label);
      expect(labels).toEqual(['Bertha']);
    });

    it('captures the error and clears the result list when the call rejects', async () => {
      const fx = mount({ directory, resolver, universes });
      await drainMountCalls(directory);
      const search = internals(fx).runSearch('al');
      directory.rejectByQuery('al', new Error('boom'));
      await search;
      expect(internals(fx).error()).toBeInstanceOf(Error);
      expect(internals(fx).visibleResults()).toEqual([]);
    });

    it('renders the error message with a Retry button when the error state is active', async () => {
      const fx = mount({ directory, resolver, universes });
      await drainMountCalls(directory);
      const search = internals(fx).runSearch('al');
      directory.rejectByQuery('al', new Error('boom'));
      await search;
      internals(fx).open.set(true);
      fx.detectChanges();
      const text = (fx.nativeElement as HTMLElement).textContent ?? '';
      // Retry copy comes from general.action.retry; transloco testing
      // module returns the key when no language is registered.
      expect(text).toContain('general.action.retry');
    });

    it('fans out one directory call per kind when `kinds` is non-empty', async () => {
      mount({ directory, resolver, universes }, { kinds: ['character', 'place'] });
      // Mount's effect fires the fan-out — wait for the microtasks to settle.
      await Promise.resolve();
      await Promise.resolve();
      expect(directory.calls.map((c) => c.kind)).toEqual(['character', 'place']);
    });
  });

  describe('createOption (affirmative create row)', () => {
    it('renders the create row when the query has no exact-folded match', async () => {
      const onCreate = vi.fn();
      const fx = mount(
        { directory, resolver, universes },
        { createOption: { labelKey: 'create.key', onCreate } },
      );
      internals(fx).query.set('Brand New Category');
      internals(fx).results.set([
        { refKey: 'codexEntry:x', kind: 'codexEntry', id: 'x', label: 'Existing', draft: false },
      ] as unknown[]);
      expect(internals(fx).showCreateRow()).toBe(true);
    });

    it('hides the create row when an existing result matches the query exactly (folded)', () => {
      const onCreate = vi.fn();
      const fx = mount(
        { directory, resolver, universes },
        { createOption: { labelKey: 'create.key', onCreate } },
      );
      internals(fx).query.set('Items');
      internals(fx).results.set([
        { refKey: 'codexEntry:x', kind: 'codexEntry', id: 'x', label: 'items', draft: false },
      ] as unknown[]);
      expect(internals(fx).showCreateRow()).toBe(false);
    });

    it('invokes onCreate with the trimmed query and adds the returned ref to the selection', async () => {
      const onCreate = vi.fn(async (label: string) => ({
        kind: 'codexEntry' as EntityKind,
        id: `new-${label.toLowerCase()}`,
      }));
      const fx = mount(
        { directory, resolver, universes },
        { createOption: { labelKey: 'create.key', onCreate } },
      );
      const emitted: EntityRef[][] = [];
      fx.componentInstance.valueChange.subscribe((v) => emitted.push(v));
      internals(fx).query.set('  Items  ');
      internals(fx).onCreateMouseDown(new MouseEvent('mousedown'));
      // Settle the create promise + the addRef microtask.
      await Promise.resolve();
      await Promise.resolve();
      expect(onCreate).toHaveBeenCalledWith('Items');
      expect(emitted).toEqual([[{ kind: 'codexEntry', id: 'new-items' }]]);
    });

    it('captures errors from onCreate so the picker surfaces them in the error state', async () => {
      const onCreate = vi.fn(async () => {
        throw new Error('busy');
      });
      const fx = mount(
        { directory, resolver, universes },
        { createOption: { labelKey: 'create.key', onCreate } },
      );
      internals(fx).query.set('Items');
      internals(fx).onCreateMouseDown(new MouseEvent('mousedown'));
      await Promise.resolve();
      await Promise.resolve();
      expect(internals(fx).error()).toBeInstanceOf(Error);
    });
  });
});
