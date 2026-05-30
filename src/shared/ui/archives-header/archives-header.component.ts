import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

interface ArchiveLink {
  path: string;
  labelKey: string;
}

const ARCHIVE_LINKS: readonly ArchiveLink[] = [
  { path: '/stories', labelKey: 'nav.stories' },
  { path: '/events', labelKey: 'nav.events' },
  { path: '/plotlines', labelKey: 'nav.plotlines' },
  { path: '/characters', labelKey: 'nav.characters' },
  { path: '/places', labelKey: 'nav.places' },
  { path: '/codex', labelKey: 'nav.codex' },
];

@Component({
  selector: 'app-archives-header',
  imports: [RouterLink, RouterLinkActive, TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <header class="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-border pb-3">
        <h1 class="m-0 font-display text-3xl font-semibold text-foreground">{{ t('nav.archives') }}</h1>
        <nav class="flex flex-wrap items-center gap-x-4 gap-y-1" [attr.aria-label]="t('nav.archives')">
          @for (link of links; track link.path) {
            <a
              [routerLink]="link.path"
              routerLinkActive="border-foreground font-bold text-foreground"
              ariaCurrentWhenActive="page"
              class="border-b-2 border-transparent pb-0.5 text-sm text-foreground-subtle no-underline transition-colors hover:text-foreground
                     focus-visible:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-accent-ring"
            >{{ t(link.labelKey) }}</a>
          }
        </nav>
      </header>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivesHeaderComponent {
  protected readonly links = ARCHIVE_LINKS;
}
