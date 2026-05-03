import { computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';

export type EntityListMode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; id: string };

export interface EntityCrudService<Draft> {
  create(draft: Draft, authorUid: string): Promise<string>;
  update(id: string, patch: Draft): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface EntityListController<T extends { id: string }, Draft> {
  readonly mode: Signal<EntityListMode>;
  readonly busy: Signal<boolean>;
  readonly errorMessage: Signal<string | null>;
  readonly canCreate: Signal<boolean>;
  readonly editing: Signal<T | null>;
  readonly editingDraft: Signal<Draft | null>;
  readonly selectedId: Signal<string | null>;
  readonly selected: Signal<T | null>;
  startCreate(): void;
  startEdit(entity: T): void;
  cancel(): void;
  submit(draft: Draft): Promise<void>;
  confirmRemove(entity: T): Promise<void>;
  select(id: string | null): void;
}

export function createEntityListController<T extends { id: string }, Draft>(opts: {
  entities: Signal<T[]>;
  service: EntityCrudService<Draft>;
  toDraft: (entity: T) => Draft;
  removeLabel: (entity: T) => string;
}): EntityListController<T, Draft> {
  const universes = inject(UniverseStore);
  const user = inject(AuthStore).user;

  const mode = signal<EntityListMode>({ kind: 'idle' });
  const busy = signal(false);
  const errorMessage = signal<string | null>(null);
  const selectedId: WritableSignal<string | null> = signal<string | null>(null);

  const canCreate = computed(() => !!user() && universes.isMemberOfActive());

  const editing = computed<T | null>(() => {
    const m = mode();
    if (m.kind !== 'edit') return null;
    return opts.entities().find((x) => x.id === m.id) ?? null;
  });

  const editingDraft = computed<Draft | null>(() => {
    const e = editing();
    return e ? opts.toDraft(e) : null;
  });

  const selected = computed<T | null>(() => {
    const id = selectedId();
    if (!id) return null;
    return opts.entities().find((x) => x.id === id) ?? null;
  });

  const setError = (err: unknown): void => {
    errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  };

  return {
    mode: mode.asReadonly(),
    busy: busy.asReadonly(),
    errorMessage: errorMessage.asReadonly(),
    canCreate,
    editing,
    editingDraft,
    selectedId: selectedId.asReadonly(),
    selected,
    startCreate(): void {
      errorMessage.set(null);
      mode.set({ kind: 'create' });
    },
    startEdit(entity: T): void {
      errorMessage.set(null);
      selectedId.set(entity.id);
      mode.set({ kind: 'edit', id: entity.id });
    },
    cancel(): void {
      errorMessage.set(null);
      mode.set({ kind: 'idle' });
    },
    async submit(draft: Draft): Promise<void> {
      const u = user();
      if (!u) return;
      const m = mode();
      busy.set(true);
      errorMessage.set(null);
      try {
        if (m.kind === 'create') {
          const newId = await opts.service.create(draft, u.uid);
          selectedId.set(newId);
        } else if (m.kind === 'edit') {
          await opts.service.update(m.id, draft);
        }
        mode.set({ kind: 'idle' });
      } catch (err) {
        setError(err);
      } finally {
        busy.set(false);
      }
    },
    async confirmRemove(entity: T): Promise<void> {
      if (!confirm(`Delete "${opts.removeLabel(entity)}"? This can't be undone.`)) return;
      try {
        await opts.service.remove(entity.id);
        if (selectedId() === entity.id) selectedId.set(null);
        if (mode().kind === 'edit') mode.set({ kind: 'idle' });
      } catch (err) {
        setError(err);
      }
    },
    select(id: string | null): void {
      errorMessage.set(null);
      mode.set({ kind: 'idle' });
      selectedId.set(id);
    },
  };
}
