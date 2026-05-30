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
import { AuthStore } from '../data-access/auth.store';
import authEn from '../i18n/en.json';
import authUk from '../i18n/uk.json';

@Component({
  selector: 'app-auth-button',
  imports: [TranslocoDirective],
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
        <span class="text-sm text-foreground-subtle">{{ t('message.loading') }}</span>
      } @else if (auth.user(); as u) {
        <div class="relative">
          <button
            type="button"
            class="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-foreground-subtle hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-faint"
            [class.bg-surface-muted]="open()"
            [class.text-foreground]="open()"
            [attr.aria-haspopup]="'menu'"
            [attr.aria-expanded]="open()"
            [attr.aria-label]="t('tooltip.accountMenu', { name: accountLabel() })"
            (click)="toggle()"
          >
            <svg
              class="size-5"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </button>

          @if (open()) {
            <div
              role="menu"
              class="absolute right-0 top-full z-10 mt-1 min-w-[200px] max-w-[16rem] rounded-md border border-border bg-surface shadow-lg"
            >
              <p class="m-0 truncate border-b border-border px-3 py-2 text-sm font-medium text-foreground">
                {{ accountLabel() }}
              </p>
              <ul class="m-0 list-none p-1">
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    class="block w-full rounded px-2 py-1.5 text-left text-sm text-foreground-muted hover:bg-surface-muted"
                    (click)="copyUid(u.uid)"
                  >{{ t(copied() ? 'message.uidCopied' : 'action.copyUid') }}</button>
                </li>
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    class="block w-full rounded px-2 py-1.5 text-left text-sm text-foreground-muted hover:bg-surface-muted"
                    (click)="signOut()"
                  >{{ t('action.signOut') }}</button>
                </li>
              </ul>
            </div>
          }
        </div>
      } @else {
        <button
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-foreground-subtle hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-faint"
          (click)="auth.login()"
        >{{ t('action.signIn') }}</button>
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
