import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import {
  EventCardComponent,
  EventsService,
  TimelineEvent,
  TimelineEventDraft,
} from '@features/events';
import { StoriesService } from '@features/stories';
import { UniverseStore } from '@features/universes';
import { PrimaryButtonComponent } from '@shared/ui';
import { EventFormComponent } from '../ui/event-form.component';

type Mode = { kind: 'idle' } | { kind: 'create' } | { kind: 'edit'; id: string };

@Component({
  selector: 'app-events-page',
  imports: [PrimaryButtonComponent, EventCardComponent, EventFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Events</h1>
        @if (canCreate() && mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="startCreate()">+ Add event</button>
        }
      </div>

      @if (mode().kind !== 'idle') {
        <app-event-form
          [initial]="editingDraft()"
          [busy]="busy()"
          [errorMessage]="errorMessage()"
          [dateSuggestions]="dateSuggestions()"
          (submitted)="onSubmit($event)"
          (cancelled)="cancel()"
        />
      }

      @if (events().length === 0) {
        <p class="text-slate-600">No events yet.</p>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] justify-start gap-4">
          @for (e of events(); track e.id) {
            <li>
              <app-event-card
                [event]="e"
                [canEdit]="canEdit(e)"
                (edit)="startEdit(e)"
                (remove)="confirmRemove(e)"
              />
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsPage {
  private readonly service = inject(EventsService);
  private readonly storiesService = inject(StoriesService);
  private readonly universes = inject(UniverseStore);
  protected readonly user = inject(AuthStore).user;

  protected readonly events = this.service.events;
  protected readonly mode = signal<Mode>({ kind: 'idle' });
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly editingDraft = computed<TimelineEventDraft | null>(() => {
    const m = this.mode();
    if (m.kind !== 'edit') return null;
    const e = this.events().find((x) => x.id === m.id);
    return e
      ? {
          slug: e.slug,
          name: e.name,
          description: e.description,
          mainCharacters: e.mainCharacters,
          places: e.places,
          inGameDate: e.inGameDate,
          relatedDates: e.relatedDates,
          type: e.type,
          summary: e.summary,
          sortOrder: e.sortOrder,
          consequences: e.consequences,
          relatedEvents: e.relatedEvents,
          plotlineRefs: e.plotlineRefs,
          itemRefs: e.itemRefs,
          factionRefs: e.factionRefs,
        }
      : null;
  });

  protected readonly dateSuggestions = computed<string[]>(() => {
    const dates = new Set<string>();
    for (const s of this.storiesService.publishedStories()) {
      if (s.inGameDate) dates.add(s.inGameDate);
    }
    for (const e of this.events()) {
      if (e.inGameDate) dates.add(e.inGameDate);
    }
    return Array.from(dates).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  });

  protected canEdit(_e: TimelineEvent): boolean {
    return this.canCreate();
  }

  protected startCreate(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'create' });
  }

  protected startEdit(e: TimelineEvent): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'edit', id: e.id });
  }

  protected cancel(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'idle' });
  }

  protected async onSubmit(draft: TimelineEventDraft): Promise<void> {
    const u = this.user();
    if (!u) return;
    const m = this.mode();
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      if (m.kind === 'create') await this.service.create(draft, u.uid);
      else if (m.kind === 'edit') await this.service.update(m.id, draft);
      this.mode.set({ kind: 'idle' });
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirmRemove(e: TimelineEvent): Promise<void> {
    if (!confirm(`Delete "${e.name}"? This can't be undone.`)) return;
    try {
      await this.service.remove(e.id);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }
}
