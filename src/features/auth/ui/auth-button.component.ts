import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { AuthActions } from '../data-access/auth.actions';
import { authFeature } from '../data-access/auth.feature';

@Component({
  selector: 'app-auth-button',
  template: `
    @if (loading()) {
      <span>Loading...</span>
    } @else if (user(); as u) {
      <span>Signed in as {{ u.displayName ?? u.email }}</span>
      <button type="button" (click)="signOut()">Sign out</button>
    } @else {
      <button type="button" (click)="signIn()">Sign in with Google</button>
    }
    @if (error(); as err) {
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
  private readonly store = inject(Store);
  protected readonly user = this.store.selectSignal(authFeature.selectUser);
  protected readonly loading = this.store.selectSignal(authFeature.selectLoading);
  protected readonly error = this.store.selectSignal(authFeature.selectError);

  signIn(): void {
    this.store.dispatch(AuthActions.login());
  }

  signOut(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
