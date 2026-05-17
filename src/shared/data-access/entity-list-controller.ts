import { computed, DestroyRef, effect, inject, signal, Signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import { EntityKind } from '@shared/models';
import { CacheInvalidationBus } from './cache-invalidation.bus';

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
  readonly selectedLoading: Signal<boolean>;
  startCreate(): void;
  startEdit(entity: T): void;
  cancel(): void;
  submit(draft: Draft): Promise<void>;
  confirmRemove(entity: T): Promise<void>;
  select(id: string | null): void;
}

/**
 * Shared CRUD + selection state machine for per-kind list pages. The
 * controller is universe-aware (read membership + active user via DI),
 * doesn't preload the entity collection, and lazy-fetches the
 * currently-selected canonical doc through `lookupById`. The list pane
 * itself is fed by the parent page (typically an
 * `EntityDirectoryQueryStore`) — this controller only knows about the
 * selected ID and the entity currently being edited.
 *
 * Must be created in an injection context.
 */
export function createEntityListController<T extends { id: string }, Draft>(opts: {
  service: EntityCrudService<Draft>;
  lookupById: (id: string) => Promise<T | null>;
  toDraft: (entity: T) => Draft;
  removeLabel: (entity: T) => string;
  /**
   * When set, the controller subscribes to `CacheInvalidationBus` and
   * refetches the selected entity whenever an entity-write event matches
   * this kind, the active universe, and the currently selected id. This
   * keeps the form / detail view in sync with writes that don't go
   * through `submit` (e.g. `CharactersService.updateSprites`).
   */
  kind?: EntityKind;
}): EntityListController<T, Draft> {
  const universes = inject(UniverseStore);
  const user = inject(AuthStore).user;
  const transloco = inject(TranslocoService);
  const bus = inject(CacheInvalidationBus);
  const destroyRef = inject(DestroyRef);

  const mode = signal<EntityListMode>({ kind: 'idle' });
  const busy = signal(false);
  const errorMessage = signal<string | null>(null);
  const selectedId: WritableSignal<string | null> = signal<string | null>(null);
  const selectedEntity = signal<T | null>(null);
  const selectedLoading = signal<boolean>(false);

  const canCreate = computed(() => !!user() && universes.isMemberOfActive());

  const editing = computed<T | null>(() => {
    const m = mode();
    if (m.kind !== 'edit') return null;
    const cur = selectedEntity();
    return cur && cur.id === m.id ? cur : null;
  });

  const editingDraft = computed<Draft | null>(() => {
    const e = editing();
    return e ? opts.toDraft(e) : null;
  });

  const setError = (err: unknown): void => {
    errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  };

  let fetchSeq = 0;
  const fetchSelected = async (id: string): Promise<void> => {
    const seq = ++fetchSeq;
    selectedLoading.set(true);
    try {
      const entity = await opts.lookupById(id);
      if (seq !== fetchSeq) return;
      selectedEntity.set(entity);
    } catch (err) {
      if (seq !== fetchSeq) return;
      setError(err);
      selectedEntity.set(null);
    } finally {
      if (seq === fetchSeq) selectedLoading.set(false);
    }
  };

  // React to selectedId — fetch the canonical doc and stash in
  // `selectedEntity`. Universe changes invalidate the cached entity too.
  effect(() => {
    const id = selectedId();
    if (!id) {
      selectedEntity.set(null);
      return;
    }
    // Track universe so a switch clears the stale entity even if the id
    // happens to match.
    universes.activeUniverseId();
    void fetchSelected(id);
  });

  if (opts.kind) {
    const watchKind = opts.kind;
    bus.entityWrites$
      .pipe(
        filter(
          (e) =>
            e.kind === watchKind &&
            e.universeId === universes.activeUniverseId() &&
            e.id === selectedId(),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        const id = selectedId();
        if (id) void fetchSelected(id);
      });
  }

  return {
    mode: mode.asReadonly(),
    busy: busy.asReadonly(),
    errorMessage: errorMessage.asReadonly(),
    canCreate,
    editing,
    editingDraft,
    selectedId: selectedId.asReadonly(),
    selected: selectedEntity.asReadonly(),
    selectedLoading: selectedLoading.asReadonly(),
    startCreate(): void {
      errorMessage.set(null);
      mode.set({ kind: 'create' });
    },
    startEdit(entity: T): void {
      errorMessage.set(null);
      selectedId.set(entity.id);
      selectedEntity.set(entity);
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
          // Refresh the cached entity so the card surfaces the saved state.
          await fetchSelected(m.id);
        }
        mode.set({ kind: 'idle' });
      } catch (err) {
        setError(err);
      } finally {
        busy.set(false);
      }
    },
    async confirmRemove(entity: T): Promise<void> {
      const message = transloco.translate('general.message.entityDeleteConfirm', {
        name: opts.removeLabel(entity),
      });
      if (!confirm(message)) return;
      try {
        await opts.service.remove(entity.id);
        if (selectedId() === entity.id) {
          selectedId.set(null);
          selectedEntity.set(null);
        }
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
