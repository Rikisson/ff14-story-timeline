import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { WorldIconComponent } from '../world-icon';

@Component({
  selector: 'app-explore-button',
  imports: [RouterLink, RouterLinkActive, WorldIconComponent, TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <a
        routerLink="/explore"
        routerLinkActive="bg-surface-muted text-foreground"
        ariaCurrentWhenActive="page"
        class="inline-flex size-9 items-center justify-center rounded-md text-foreground-subtle
               hover:bg-surface-muted hover:text-foreground
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-faint"
        [attr.aria-label]="t('nav.explore')"
        [title]="t('nav.explore')"
      >
        <app-world-icon class="size-5" />
      </a>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreButtonComponent {}
