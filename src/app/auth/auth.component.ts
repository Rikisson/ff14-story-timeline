import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from './auth.store';

@Component({
  selector: 'app-auth',
  template: `
    @if (auth.loading()) {
      <span>Loading...</span>
    } @else if (auth.user(); as user) {
      <span>Signed in as {{ user.displayName ?? user.email }}</span>
      <button type="button" (click)="auth.signOut()">Sign out</button>
    } @else {
      <button type="button" (click)="auth.signIn()">Sign in with Google</button>
    }
    @if (auth.error(); as error) {
      <span class="error">{{ error }}</span>
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
export class AuthComponent {
  protected readonly auth = inject(AuthStore);
}
