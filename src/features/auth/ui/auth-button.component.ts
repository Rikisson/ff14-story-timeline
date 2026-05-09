import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { SecondaryButtonComponent } from '@shared/ui';
import { AuthStore } from '../data-access/auth.store';
import authEn from '../i18n/en.json';
import authUk from '../i18n/uk.json';

@Component({
  selector: 'app-auth-button',
  imports: [SecondaryButtonComponent, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'auth',
      loader: {
        en: () => Promise.resolve(authEn),
        uk: () => Promise.resolve(authUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'auth'">
      @if (auth.loading()) {
        <span class="text-sm text-foreground-subtle">{{ t('messages.loading') }}</span>
      } @else if (auth.user(); as u) {
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-foreground-muted hover:bg-surface-muted"
            [attr.aria-haspopup]="'menu'"
            [attr.aria-expanded]="open()"
            [attr.aria-label]="t('tooltips.accountMenu', { name: accountLabel() })"
            (click)="toggle()"
          >
            <span class="max-w-[12rem] truncate">{{ accountLabel() }}</span>
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
              class="absolute right-0 top-full z-10 mt-1 min-w-[200px] rounded-md border border-border bg-surface shadow-lg"
            >
              <ul class="m-0 list-none p-1">
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    class="block w-full rounded px-2 py-1.5 text-left text-sm text-foreground-muted hover:bg-surface-muted"
                    (click)="copyUid(u.uid)"
                  >{{ t(copied() ? 'messages.uidCopied' : 'actions.copyUid') }}</button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    class="block w-full rounded px-2 py-1.5 text-left text-sm text-foreground-muted hover:bg-surface-muted"
                    (click)="signOut()"
                  >{{ t('actions.signOut') }}</button>
                </li>
              </ul>
            </div>
          }
        </div>
      } @else {
        <button uiSecondary type="button" (click)="auth.login()">{{ t('actions.signIn') }}</button>
      }
      @if (auth.error(); as err) {
        <span class="text-sm text-danger-foreground" role="alert">{{ err }}</span>
      }
    </ng-container>
  `,
  host: {
    class: 'inline-flex flex-wrap items-center gap-2',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthButtonComponent {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly copied = signal(false);

  protected readonly accountLabel = computed(() => {
    const u = this.auth.user();
    if (!u) return '';
    return u.displayName?.trim() || u.email || 'Account';
  });

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected close(): void {
    this.open.set(false);
    this.copied.set(false);
  }

  protected async signOut(): Promise<void> {
    this.close();
    await this.auth.logout();
    await this.router.navigate(['/']);
  }

  protected async copyUid(uid: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(uid);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      window.prompt('Copy your UID:', uid);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }
}
