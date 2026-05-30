import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import { BrandComponent, PageComponent } from '@shared/ui';

@Component({
  selector: 'app-landing-page',
  imports: [BrandComponent, PageComponent, TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <app-page>
        <div class="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <app-brand size="hero" class="brand-enter mb-4" />
        @if (loading()) {
          <span
            class="inline-block size-10 rounded-full border-4 border-border-strong border-t-foreground animate-spin"
            aria-hidden="true"
          ></span>
          <p class="m-0 text-foreground-subtle">{{ t('message.loadingUniverses') }}</p>
        } @else if (universes().length === 0) {
          <h1 class="m-0 font-display text-3xl font-semibold text-foreground">{{ t('empty.landingNoUniversesTitle') }}</h1>
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
          <h1 class="m-0 font-display text-3xl font-semibold text-foreground">{{ t('message.landingPickTitle') }}</h1>
          <p class="m-0 text-foreground-subtle">
            {{ t('message.landingPickHint') }}
            @if (!user()) {
              {{ t('message.landingSignInHint') }}
            }
          </p>
        }
        </div>
      </app-page>
    </ng-container>
  `,
  styles: `
    .brand-enter {
      animation: brand-enter 0.6s ease-out both;
    }
    @keyframes brand-enter {
      from {
        opacity: 0;
        transform: translateY(0.5rem);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .brand-enter {
        animation: none;
      }
    }
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
        void this.router.navigate(['/explore'], { replaceUrl: true });
      }
    });
  }
}
