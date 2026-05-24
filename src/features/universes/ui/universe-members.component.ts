import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import {
  DangerButtonComponent,
  PrimaryButtonComponent,
} from '@shared/ui';
import { UniverseStore } from '../data-access/universe.store';
import { UniversesService } from '../data-access/universes.service';
import universeEn from '../i18n/en.json';
import universeUk from '../i18n/uk.json';

const UID_PATTERN = /^[A-Za-z0-9]{20,128}$/;

@Component({
  selector: 'app-universe-members',
  imports: [
    ReactiveFormsModule,
    PrimaryButtonComponent,
    DangerButtonComponent,
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
      <ng-container *transloco="let g; prefix: 'general'">
        <section class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div>
            <h2 class="m-0 text-base font-semibold text-foreground">{{ t('field.accessHeader') }}</h2>
            @if (universe(); as u) {
              <p class="m-0 mt-0.5 text-sm text-foreground-subtle">
                {{ t('message.ownerSubtitle', { name: u.name }) }}
              </p>
            }
          </div>

          @if (universe(); as u) {
            <ul class="m-0 flex list-none flex-col gap-1 p-0">
              <li
                class="flex items-center justify-between gap-3 rounded border border-border bg-surface-subtle px-3 py-2 text-sm"
              >
                <div class="flex flex-col">
                  <span class="font-medium text-foreground-muted">{{ t('field.ownerLabel') }}</span>
                  <code class="break-all text-xs text-foreground-subtle">{{ u.authorUid }}</code>
                </div>
                @if (isYou(u.authorUid)) {
                  <span class="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-soft-foreground">
                    {{ t('field.youBadge') }}
                  </span>
                }
              </li>
              @for (uid of u.editorUids; track uid) {
                <li
                  class="flex items-center justify-between gap-3 rounded border border-border bg-surface px-3 py-2 text-sm"
                >
                  <div class="flex flex-col">
                    <span class="font-medium text-foreground-muted">{{ t('field.contributorLabel') }}</span>
                    <code class="break-all text-xs text-foreground-subtle">{{ uid }}</code>
                  </div>
                  <div class="flex items-center gap-2">
                    @if (isYou(uid)) {
                      <span class="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-soft-foreground">{{ t('field.youBadge') }}</span>
                    }
                    <button
                      uiDanger
                      type="button"
                      [disabled]="busy()"
                      (click)="confirmRemove(u.id, uid)"
                    >{{ g('action.remove') }}</button>
                  </div>
                </li>
              }
            </ul>

            <form [formGroup]="form" class="flex flex-col gap-2" (ngSubmit)="onAdd(u.id, u.authorUid, u.editorUids)">
              <label class="flex flex-col gap-1 text-sm">
                <span class="font-medium text-foreground-muted">{{ t('field.addContributorLabel') }}</span>
                <input
                  type="text"
                  formControlName="uid"
                  autocomplete="off"
                  spellcheck="false"
                  class="h-10 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 font-mono text-xs"
                  [placeholder]="t('empty.uidPlaceholder')"
                />
                <span class="text-xs text-foreground-faint">
                  {{ t('message.uidHint') }}
                </span>
              </label>
              @if (errorMessage(); as e) {
                <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
              }
              <div>
                <button
                  uiPrimary
                  type="submit"
                  [loading]="busy()"
                  [disabled]="form.invalid || busy()"
                >{{ t('action.addContributor') }}</button>
              </div>
            </form>
          } @else {
            <p class="m-0 text-sm italic text-foreground-faint">{{ t('empty.noActive') }}</p>
          }
        </section>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseMembersComponent {
  private readonly service = inject(UniversesService);
  private readonly store = inject(UniverseStore);
  private readonly auth = inject(AuthStore);
  private readonly transloco = inject(TranslocoService);

  protected readonly universe = this.store.activeUniverse;
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly currentUid = computed(() => this.auth.user()?.uid ?? null);

  protected readonly form = new FormBuilder().nonNullable.group({
    uid: ['', [Validators.required, Validators.pattern(UID_PATTERN)]],
  });

  protected isYou(uid: string): boolean {
    return this.currentUid() === uid;
  }

  protected async onAdd(universeId: string, authorUid: string, editorUids: string[]): Promise<void> {
    if (this.form.invalid) return;
    const uid = this.form.getRawValue().uid.trim();
    if (uid === authorUid) {
      this.errorMessage.set(this.transloco.translate('universe.message.uidAlreadyOwner'));
      return;
    }
    if (editorUids.includes(uid)) {
      this.errorMessage.set(this.transloco.translate('universe.message.uidAlreadyContributor'));
      return;
    }
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.addEditor(universeId, uid);
      await this.store.refresh();
      this.form.reset({ uid: '' });
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirmRemove(universeId: string, uid: string): Promise<void> {
    const message = this.isYou(uid)
      ? this.transloco.translate('universe.message.removeYourselfConfirm')
      : this.transloco.translate('universe.message.removeContributorConfirm', { uid });
    if (!confirm(message)) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      await this.service.removeEditor(universeId, uid);
      await this.store.refresh();
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }
}
