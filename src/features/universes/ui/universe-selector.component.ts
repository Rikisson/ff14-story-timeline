import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { SlugTakenError } from '@shared/models';
import { UniversesService } from '../data-access/universes.service';
import { UniverseStore } from '../data-access/universe.store';
import { UniverseDraft } from '../data-access/universe.types';
import { UniverseFormComponent } from './universe-form.component';
import universeEn from '../i18n/en.json';
import universeUk from '../i18n/uk.json';

@Component({
  selector: 'app-universe-selector',
  imports: [UniverseFormComponent, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'universe',
      loader: {
        en: () => Promise.resolve(universeEn),
        uk: () => Promise.resolve(universeUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'universe'">
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md px-2 py-1 text-lg font-semibold text-foreground hover:bg-surface-muted"
          [attr.aria-haspopup]="'menu'"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="t('tooltip.switchUniverse')"
          (click)="toggle()"
        >
          <span>{{ label() }}</span>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="5 8 10 13 15 8" />
          </svg>
        </button>

        @if (open()) {
          <div
            role="menu"
            class="absolute left-0 top-full z-10 mt-1 min-w-[260px] rounded-md border border-border bg-surface shadow-lg"
          >
            @if (universes().length === 0) {
              <p class="m-0 p-3 text-sm text-foreground-subtle">{{ t('empty.noUniverses') }}</p>
            } @else {
              <ul class="m-0 max-h-72 list-none overflow-y-auto p-1">
                @for (u of universes(); track u.id) {
                  <li>
                    <button
                      type="button"
                      role="menuitem"
                      class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground-muted hover:bg-surface-muted"
                      [class.font-semibold]="u.id === activeId()"
                      [class.text-accent]="u.id === activeId()"
                      (click)="select(u.id)"
                    >
                      <span class="truncate">{{ u.name }}</span>
                      @if (u.id === activeId()) {
                        <span class="shrink-0 text-xs">{{ t('field.activeBadge') }}</span>
                      }
                    </button>
                  </li>
                }
              </ul>
            }
            @if (isMemberOfActive() || canCreate()) {
              <div class="flex flex-col gap-1 border-t border-border p-1">
                @if (isMemberOfActive()) {
                  <button
                    type="button"
                    role="menuitem"
                    class="block w-full rounded px-2 py-1.5 text-left text-sm font-medium text-foreground-muted hover:bg-surface-muted"
                    (click)="openSettings()"
                  >{{ t('action.settingsMenu') }}</button>
                }
                @if (canCreate()) {
                  <button
                    type="button"
                    role="menuitem"
                    class="block w-full rounded px-2 py-1.5 text-left text-sm font-medium text-foreground-muted hover:bg-surface-muted"
                    (click)="openCreate()"
                  >{{ t('action.createMenu') }}</button>
                }
              </div>
            }
          </div>
        }
      </div>

      <dialog
        #createDialog
        class="m-auto rounded-lg p-0 bg-surface text-foreground backdrop:bg-backdrop"
        [attr.aria-label]="t('field.createDialogTitle')"
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
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseSelectorComponent {
  private readonly store = inject(UniverseStore);
  private readonly service = inject(UniversesService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly transloco = inject(TranslocoService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly createDialog = viewChild.required<ElementRef<HTMLDialogElement>>('createDialog');

  protected readonly universes = this.store.universes;
  protected readonly activeId = this.store.activeUniverseId;
  protected readonly canCreate = this.store.canCreateUniverse;
  protected readonly isMemberOfActive = this.store.isMemberOfActive;
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly label = computed(() => {
    this.activeLang();
    const u = this.store.activeUniverse();
    return u?.name ?? this.transloco.translate('universe.field.defaultLabel');
  });

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected select(id: string): void {
    this.store.setActive(id);
    this.close();
    void this.router.navigate(['/']);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected openCreate(): void {
    this.close();
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

  protected openSettings(): void {
    this.close();
    void this.router.navigate(['/universe/settings']);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  protected async onSubmit(draft: UniverseDraft): Promise<void> {
    const u = this.auth.user();
    if (!u) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const id = await this.service.create(draft, u.uid);
      await this.store.refresh();
      this.store.setActive(id);
      this.closeCreate();
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
}
