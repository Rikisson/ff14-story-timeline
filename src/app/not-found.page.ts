import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <div class="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 class="m-0 text-3xl font-semibold text-foreground">{{ t('empty.notFoundTitle') }}</h1>
        <p class="m-0 text-foreground-subtle">{{ t('empty.notFoundMessage') }}</p>
        <a routerLink="/timeline" class="text-accent hover:underline">{{ t('action.backToTimeline') }}</a>
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
