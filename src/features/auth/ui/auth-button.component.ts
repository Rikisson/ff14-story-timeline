import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GhostButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import { AuthStore } from '../data-access/auth.store';

@Component({
  selector: 'app-auth-button',
  imports: [GhostButtonComponent, SecondaryButtonComponent],
  template: `
    @if (auth.loading()) {
      <span class="text-sm text-slate-600">Loading…</span>
    } @else if (auth.user(); as u) {
      <span class="text-sm text-slate-700">
        Signed in as {{ u.displayName ?? u.email }}
      </span>
      <button
        uiGhost
        type="button"
        [attr.aria-label]="'Copy your UID to clipboard'"
        [title]="copied() ? 'Copied!' : ('Your UID: ' + u.uid)"
        (click)="copyUid(u.uid)"
      >{{ copied() ? 'UID copied' : 'Copy UID' }}</button>
      <button uiGhost type="button" (click)="signOut()">Sign out</button>
    } @else {
      <button uiSecondary type="button" (click)="auth.login()">
        Sign in with Google
      </button>
    }
    @if (auth.error(); as err) {
      <span class="text-sm text-red-700" role="alert">{{ err }}</span>
    }
  `,
  host: { class: 'inline-flex flex-wrap items-center gap-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthButtonComponent {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly copied = signal(false);

  protected async signOut(): Promise<void> {
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
}
