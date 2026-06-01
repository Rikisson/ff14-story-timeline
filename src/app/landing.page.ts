import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import {
  Universe,
  UniverseDetailComponent,
  UniverseDraft,
  UniverseFormComponent,
  UniverseStore,
} from '@features/universes';
import { SlugTakenError } from '@shared/models';
import {
  ListPaneItem,
  PageComponent,
  SidePaneComponent,
  SidePaneHeaderComponent,
  SidePaneListComponent,
  SidePaneSearchComponent,
} from '@shared/ui';

@Component({
  selector: 'app-landing-page',
  host: { class: 'block h-full' },
  imports: [
    PageComponent,
    SidePaneComponent,
    SidePaneHeaderComponent,
    SidePaneListComponent,
    SidePaneSearchComponent,
    UniverseDetailComponent,
    UniverseFormComponent,
    TranslocoDirective,
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <app-page class="h-full">
        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-side-pane class="md:w-80 md:shrink-0" [ariaLabel]="t('tooltip.universesList')">
            <app-side-pane-header
              [title]="t('message.landingPickTitle')"
              [canCreate]="canCreate()"
              [createLabel]="t('action.newUniverse')"
              (create)="startCreate()"
            />

            <app-side-pane-search [searchValue]="search()" (searchChange)="search.set($event)" />

            <app-side-pane-list
              [items]="listItems()"
              [selectedId]="selectedId()"
              [loading]="loading()"
              [emptyMessage]="emptyMessage()"
              [ariaLabel]="t('tooltip.universesList')"
              [worldPlaceholder]="true"
              (select)="selectedId.set($event)"
            />
          </app-side-pane>

          <section class="flex min-h-0 flex-col md:flex-1" [attr.aria-label]="t('tooltip.universesDetails')">
            @if (selectedUniverse(); as u) {
              <app-universe-detail
                class="min-h-0 flex-1"
                [universe]="u"
                [canManage]="canManageSelected()"
                (enterUniverse)="enter(u)"
                (openSettings)="openSettings(u)"
              />
            } @else {
              <p class="m-0 rounded-lg border border-border bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint">
                {{ t('empty.catalogSelect') }}
              </p>
            }
          </section>
        </div>
      </app-page>

      <dialog
        #createDialog
        class="m-auto rounded-lg p-0 bg-surface text-foreground backdrop:bg-backdrop"
        [attr.aria-label]="t('tooltip.createUniverse')"
        (close)="onDialogClose()"
        (click)="onDialogBackdropClick($event)"
      >
        <div class="w-[min(28rem,90vw)] p-2">
          <app-universe-form
            [busy]="busy()"
            [errorMessage]="errorMessage()"
            (submitted)="onSubmit($event)"
            (cancelled)="closeCreate()"
          />
        </div>
      </dialog>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  private readonly store = inject(UniverseStore);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly user = inject(AuthStore).user;

  protected readonly loading = this.store.loading;
  protected readonly canCreate = this.store.canCreateUniverse;

  protected readonly search = signal('');
  protected readonly selectedId = linkedSignal(() => this.store.activeUniverseId());
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly createDialog = viewChild.required<ElementRef<HTMLDialogElement>>('createDialog');

  constructor() {
    // Resume into the remembered universe only on the app's first navigation;
    // reaching the catalog later (via the home link) must not bounce away.
    const isFirstNavigation = this.router.getCurrentNavigation()?.id === 1;
    if (isFirstNavigation && this.store.activeUniverseId()) {
      void this.router.navigate(['/explore'], { replaceUrl: true });
    }
  }

  protected readonly selectedUniverse = computed<Universe | null>(
    () => this.store.universes().find((u) => u.id === this.selectedId()) ?? null,
  );

  protected readonly canManageSelected = computed(() => {
    const uid = this.user()?.uid;
    const u = this.selectedUniverse();
    if (!uid || !u) return false;
    return u.authorUid === uid || u.editorUids.includes(uid);
  });

  protected readonly listItems = computed<ListPaneItem[]>(() => {
    const q = this.search().trim().toLowerCase();
    return this.store
      .universes()
      .map((u) => ({
        id: u.id,
        label: u.name,
        coverAssetId: u.coverAssetId,
      }))
      .filter((item) => q === '' || item.label.toLowerCase().includes(q));
  });

  protected readonly emptyMessage = computed(() =>
    this.transloco.translate(
      this.canCreate() ? 'general.empty.landingNoUniversesAuthor' : 'general.empty.landingNoUniversesGuest',
    ),
  );

  protected enter(u: Universe): void {
    this.store.setActive(u.id);
    void this.router.navigate(['/explore']);
  }

  protected openSettings(u: Universe): void {
    this.store.setActive(u.id);
    void this.router.navigate(['/universe/settings']);
  }

  protected startCreate(): void {
    this.errorMessage.set(null);
    this.createDialog().nativeElement.showModal();
  }

  protected closeCreate(): void {
    this.createDialog().nativeElement.close();
  }

  protected onDialogClose(): void {
    this.errorMessage.set(null);
    this.busy.set(false);
  }

  protected onDialogBackdropClick(event: MouseEvent): void {
    if (event.target === this.createDialog().nativeElement) {
      this.closeCreate();
    }
  }

  protected async onSubmit(draft: UniverseDraft): Promise<void> {
    const u = this.user();
    if (!u) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      await this.store.createUniverse(draft, u.uid);
      this.closeCreate();
      await this.router.navigate(['/explore']);
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
}
