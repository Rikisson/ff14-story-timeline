import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';

@Component({
  selector: 'app-landing-page',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <div class="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        @if (loading()) {
          <span
            class="inline-block size-10 rounded-full border-4 border-border-strong border-t-foreground animate-spin"
            aria-hidden="true"
          ></span>
          <p class="m-0 text-foreground-subtle">{{ t('message.loadingUniverses') }}</p>
        } @else if (universes().length === 0) {
          <h1 class="m-0 text-2xl font-semibold text-foreground">{{ t('empty.landingNoUniversesTitle') }}</h1>
          <p class="m-0 text-foreground-subtle">
            @if (canCreate()) {
              {{ t('empty.landingNoUniversesAuthor') }}
            } @else if (user()) {
              {{ t('empty.landingNoUniversesUser') }}
            } @else {
              {{ t('empty.landingNoUniversesGuest') }}
            }
          </p>
        } @else {
          <h1 class="m-0 text-2xl font-semibold text-foreground">{{ t('message.landingPickTitle') }}</h1>
          <p class="m-0 text-foreground-subtle">
            {{ t('message.landingPickHint') }}
            @if (!user()) {
              {{ t('message.landingSignInHint') }}
            }
          </p>
        }
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  private readonly universeStore = inject(UniverseStore);
  private readonly router = inject(Router);
  protected readonly user = inject(AuthStore).user;
  protected readonly loading = this.universeStore.loading;
  protected readonly universes = this.universeStore.universes;
  protected readonly activeId = this.universeStore.activeUniverseId;
  protected readonly canCreate = this.universeStore.canCreateUniverse;

  constructor() {
    effect(() => {
      if (this.activeId()) {
        void this.router.navigate(['/timeline'], { replaceUrl: true });
      }
    });
  }
}
