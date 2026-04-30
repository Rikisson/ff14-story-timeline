import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
      <button uiGhost type="button" (click)="auth.logout()">Sign out</button>
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
}
