import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { createEntityListController } from '@shared/data-access';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { CodexEntriesService } from '../data-access/codex-entries.service';
import { CodexEntry, CodexEntryDraft } from '../data-access/codex-entry.types';
import { CodexEntryCardComponent } from '../ui/codex-entry-card.component';
import { CodexEntryFormComponent } from '../ui/codex-entry-form.component';

@Component({
  selector: 'app-codex-page',
  host: { class: 'block h-full' },
  imports: [EntityListPaneComponent, CodexEntryCardComponent, CodexEntryFormComponent, PageHeaderComponent],
  template: `
    <div class="flex h-full flex-col gap-4">
      <app-page-header
        title="Codex"
        subtitle="Encyclopedic entries — anything that doesn't fit the other categories."
      />

      <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <app-entity-list-pane
          class="md:w-80 md:shrink-0"
          [items]="listItems()"
          [selectedId]="ctrl.selectedId()"
          [hasMore]="service.hasMore()"
          [loadingMore]="service.loadingMore()"
          [canCreate]="ctrl.canCreate()"
          createLabel="+ Add entry"
          emptyMessage="No codex entries yet."
          ariaLabel="Codex list"
          (select)="onSelect($event)"
          (create)="ctrl.startCreate()"
          (loadMore)="service.loadMore()"
        />

        <section class="flex min-h-0 flex-col md:flex-1" aria-label="Codex entry details">
          @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
            <div class="min-h-0 flex-1 overflow-y-auto">
              <app-codex-entry-form
                [initial]="ctrl.editingDraft()"
                [busy]="ctrl.busy()"
                [errorMessage]="ctrl.errorMessage()"
                (submitted)="ctrl.submit($event)"
                (cancelled)="ctrl.cancel()"
              />
            </div>
          } @else if (ctrl.selected(); as e) {
            <div class="min-h-0 flex-1 overflow-y-auto">
              <app-codex-entry-card
                [entry]="e"
                [canEdit]="ctrl.canCreate()"
                (edit)="ctrl.startEdit(e)"
                (remove)="ctrl.confirmRemove(e)"
              />
            </div>
          } @else {
            <p class="m-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Select an entry to view details.
            </p>
          }
        </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexPage {
  protected readonly service = inject(CodexEntriesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly entries = this.service.entries;
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  protected readonly ctrl = createEntityListController<CodexEntry, CodexEntryDraft>({
    entities: this.entries,
    service: this.service,
    toDraft: (e) => ({
      slug: e.slug,
      title: e.title,
      category: e.category,
      body: e.body,
      relatedRefs: e.relatedRefs,
    }),
    removeLabel: (e) => e.title,
  });

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.entries().map((e) => ({
      id: e.id,
      label: e.title,
      secondary: e.category,
    })),
  );

  constructor() {
    effect(() => {
      const id = this.routeId().get('id');
      this.ctrl.select(id ?? null);
    });

    effect(() => {
      const id = this.ctrl.selectedId();
      const current = this.routeId().get('id') ?? null;
      if (id !== current) {
        void this.router.navigate(id ? ['/codex', id] : ['/codex'], {
          replaceUrl: true,
        });
      }
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/codex', id]);
  }
}
