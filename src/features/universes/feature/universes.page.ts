import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@features/auth';
import { PrimaryButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import { SlugTakenError, UniversesService } from '../data-access/universes.service';
import { Universe, UniverseDraft } from '../data-access/universe.types';
import { UniverseStore } from '../data-access/universe.store';
import { UniverseFormComponent } from '../ui/universe-form.component';

@Component({
  selector: 'app-universes-page',
  imports: [
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    UniverseFormComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Universes</h1>
        @if (user() && !creating() && canCreate()) {
          <button uiPrimary type="button" (click)="startCreate()">+ Create universe</button>
        }
      </div>

      @if (!user()) {
        <p class="text-slate-600">Sign in to view your universes.</p>
      } @else if (creating()) {
        <app-universe-form
          [busy]="busy()"
          [errorMessage]="errorMessage()"
          (submitted)="onSubmit($event)"
          (cancelled)="cancelCreate()"
        />
      } @else if (loading()) {
        <p class="text-slate-600">Loading universes…</p>
      } @else if (universes().length === 0) {
        <div class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
          <p class="m-0 text-sm text-slate-700">
            You don't have any universes yet. A universe is the workspace that holds your
            characters, places, events, and stories.
          </p>
          @if (!canCreate()) {
            <p class="m-0 text-sm text-slate-500">
              Universe creation is gated by an admin claim. Ask an admin to grant
              <code>universeCreator</code>.
            </p>
          }
        </div>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          @for (u of universes(); track u.id) {
            <li
              class="flex flex-col gap-2 rounded-lg border bg-white p-4 shadow-sm"
              [class.border-blue-500]="u.id === activeId()"
              [class.border-slate-200]="u.id !== activeId()"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-slate-900">{{ u.name }}</span>
                @if (u.id === activeId()) {
                  <span class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Active
                  </span>
                }
              </div>
              <span class="text-xs text-slate-500">{{ u.slug }}</span>
              @if (u.description) {
                <p class="m-0 text-sm text-slate-600">{{ u.description }}</p>
              }
              <div class="mt-auto flex gap-2 pt-2">
                @if (u.id === activeId()) {
                  <button uiSecondary type="button" (click)="goToCatalog()">Open</button>
                } @else {
                  <button uiPrimary type="button" (click)="switchTo(u)">Switch</button>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniversesPage {
  private readonly service = inject(UniversesService);
  private readonly store = inject(UniverseStore);
  private readonly router = inject(Router);

  protected readonly user = inject(AuthStore).user;
  protected readonly universes = this.store.universes;
  protected readonly activeId = this.store.activeUniverseId;
  protected readonly loading = this.store.loading;

  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly canCreateSignal = signal(false);

  protected readonly canCreate = computed(() => this.canCreateSignal());

  constructor() {
    void this.refreshCanCreate();
  }

  private async refreshCanCreate(): Promise<void> {
    this.canCreateSignal.set(await this.store.canCreateUniverse());
  }

  protected startCreate(): void {
    this.errorMessage.set(null);
    this.creating.set(true);
  }

  protected cancelCreate(): void {
    this.errorMessage.set(null);
    this.creating.set(false);
  }

  protected async onSubmit(draft: UniverseDraft): Promise<void> {
    const u = this.user();
    if (!u) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const id = await this.service.create(draft, u.uid);
      await this.store.refreshForUser(u.uid);
      this.store.setActive(id);
      this.creating.set(false);
      await this.router.navigate(['/']);
    } catch (err) {
      if (err instanceof SlugTakenError) {
        this.errorMessage.set(err.message);
      } else {
        this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected switchTo(u: Universe): void {
    this.store.setActive(u.id);
    void this.router.navigate(['/']);
  }

  protected goToCatalog(): void {
    void this.router.navigate(['/']);
  }
}
