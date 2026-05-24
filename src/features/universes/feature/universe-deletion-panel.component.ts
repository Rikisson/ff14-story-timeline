import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { UniverseStore } from '../data-access/universe.store';
import { Universe } from '../data-access/universe.types';
import { UniverseDeletionService } from '../data-access/universe-deletion.service';
import universeEn from '../i18n/en.json';
import universeUk from '../i18n/uk.json';

@Component({
  selector: 'app-universe-deletion-panel',
  imports: [
    FormsModule,
    DangerButtonComponent,
    SecondaryButtonComponent,
    GhostButtonComponent,
    TranslocoDirective,
  ],
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
      <div class="relative flex flex-col gap-4">
        @if (progressOverlay(); as p) {
          <div
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-backdrop text-foreground"
            role="status"
            aria-live="polite"
          >
            @if (p.phase === 'soft-deleting') {
              <p class="m-0 text-sm font-semibold">{{ t('message.cleanupSoftDeleting') }}</p>
            } @else if (p.phase === 'cascading') {
              <p class="m-0 text-sm font-semibold">
                {{ t('message.cleanupRunning', { processed: p.processed, total: p.total, step: p.currentStep ?? '' }) }}
              </p>
            } @else if (p.phase === 'done') {
              <p class="m-0 text-sm font-semibold text-success-foreground">{{ t('message.cleanupDone') }}</p>
              <button uiSecondary type="button" (click)="dismissProgress()">{{ t('action.dismissProgress') }}</button>
            } @else if (p.phase === 'error') {
              <p class="m-0 text-sm font-semibold text-danger-foreground">
                {{ t('message.cleanupFailed', { error: p.error ?? '' }) }}
              </p>
              <button uiSecondary type="button" (click)="dismissProgress()">{{ t('action.dismissProgress') }}</button>
            }
          </div>
        }

        @if (canDeleteActive()) {
          @if (active(); as u) {
            <section class="flex flex-col gap-3 rounded-lg border border-danger-soft bg-surface p-4 shadow-sm">
              <div>
                <h2 class="m-0 text-base font-semibold text-danger-foreground">{{ t('field.dangerHeader') }}</h2>
                <p class="m-0 mt-0.5 text-sm text-foreground-subtle">
                  {{ t('message.dangerSubtitle') }}
                </p>
                <p class="m-0 mt-1 text-xs text-foreground-faint">
                  {{ t('message.deleteEntityCounts', { assets: u.assetCount, count: '·' }) }}
                </p>
              </div>
              <div>
                <button
                  uiDanger
                  type="button"
                  [disabled]="busy()"
                  (click)="openConfirm()"
                >{{ t('action.deleteUniverse') }}</button>
              </div>
            </section>
          }
        }

        @if (pending().length > 0) {
          <section class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div>
              <h2 class="m-0 text-base font-semibold text-foreground">{{ t('field.cleanupPendingHeader') }}</h2>
              <p class="m-0 mt-0.5 text-sm text-foreground-subtle">{{ t('message.cleanupPendingSubtitle') }}</p>
            </div>
            <ul class="m-0 flex list-none flex-col gap-2 p-0">
              @for (u of pending(); track u.id) {
                <li class="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface-subtle px-3 py-2 text-sm">
                  <div class="flex flex-col">
                    <span class="font-medium text-foreground-muted">{{ u.name }}</span>
                    <code class="text-xs text-foreground-faint">{{ u.slug }}</code>
                  </div>
                  <button
                    uiSecondary
                    type="button"
                    [disabled]="busy()"
                    (click)="onResume(u)"
                  >{{ t('action.resumeCleanup') }}</button>
                </li>
              }
            </ul>
          </section>
        }
      </div>

      <dialog
        #confirmDialog
        class="m-auto w-[min(28rem,90vw)] rounded-lg bg-surface p-4 text-foreground backdrop:bg-backdrop"
        [attr.aria-label]="t('action.deleteUniverse')"
        (close)="onDialogClose()"
        (click)="onBackdropClick($event)"
      >
        @if (active(); as u) {
          <form class="flex flex-col gap-3" (submit)="onConfirm($event, u)">
            <h3 class="m-0 text-base font-semibold text-foreground">{{ t('action.deleteUniverse') }}</h3>
            <p class="m-0 text-sm text-foreground-subtle">
              {{ t('message.deleteConfirmPrompt', { name: u.name }) }}
            </p>
            <label class="flex flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ t('field.slugConfirmLabel') }}</span>
              <input
                type="text"
                name="slugConfirm"
                autocomplete="off"
                spellcheck="false"
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 font-mono text-xs"
                [ngModel]="slugInput()"
                (ngModelChange)="slugInput.set($event)"
              />
              @if (slugInput() && slugInput() !== u.slug) {
                <span class="text-xs text-danger-foreground">{{ t('message.deleteSlugMismatch') }}</span>
              }
            </label>
            <div class="flex flex-wrap justify-end gap-2">
              <button uiGhost type="button" (click)="closeConfirm()">{{ t('action.cancelDelete') }}</button>
              <button
                uiDanger
                type="submit"
                [disabled]="slugInput() !== u.slug || busy()"
              >{{ t('action.confirmDelete') }}</button>
            </div>
          </form>
        }
      </dialog>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseDeletionPanelComponent {
  private readonly store = inject(UniverseStore);
  private readonly auth = inject(AuthStore);
  private readonly deletion = inject(UniverseDeletionService);
  private readonly router = inject(Router);

  private readonly confirmDialog = viewChild.required<ElementRef<HTMLDialogElement>>('confirmDialog');

  protected readonly active = this.store.activeUniverse;
  protected readonly pending = this.store.pendingForAuthor;
  protected readonly canDeleteActive = this.store.isOwnerOfActive;
  protected readonly slugInput = signal('');
  protected readonly busy = this.deletion.inFlight;
  protected readonly progress = this.deletion.progress;

  protected readonly progressOverlay = computed(() => {
    const p = this.progress();
    return p.phase === 'idle' ? null : p;
  });

  protected openConfirm(): void {
    this.slugInput.set('');
    this.confirmDialog().nativeElement.showModal();
  }

  protected closeConfirm(): void {
    this.confirmDialog().nativeElement.close();
  }

  protected onDialogClose(): void {
    this.slugInput.set('');
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.confirmDialog().nativeElement) this.closeConfirm();
  }

  protected async onConfirm(event: Event, universe: Universe): Promise<void> {
    event.preventDefault();
    if (this.slugInput() !== universe.slug) return;
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    this.closeConfirm();
    try {
      await this.deletion.softDeleteAndCascade(universe.id, uid);
    } catch {
      return;
    }
    await this.store.refresh();
    await this.store.refreshPending();
    await this.router.navigate(['/']);
  }

  protected async onResume(universe: Universe): Promise<void> {
    try {
      await this.deletion.resumeCascade(universe.id);
    } catch {
      return;
    }
    await this.store.refreshPending();
  }

  protected dismissProgress(): void {
    this.deletion.acknowledge();
  }
}
