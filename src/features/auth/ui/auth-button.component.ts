import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../data-access/auth.store';

@Component({
  selector: 'app-auth-button',
  template: `
    @if (auth.loading()) {
      <span>Loading...</span>
    } @else if (auth.user(); as u) {
      <span>Signed in as {{ u.displayName ?? u.email }}</span>
      <button type="button" (click)="auth.logout()">Sign out</button>
    } @else {
      <button type="button" (click)="auth.login()">Sign in with Google</button>
    }
    @if (auth.error(); as err) {
      <span class="error">{{ err }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .error {
      color: #b00020;
      font-size: 0.875rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthButtonComponent {
  protected readonly auth = inject(AuthStore);
}
