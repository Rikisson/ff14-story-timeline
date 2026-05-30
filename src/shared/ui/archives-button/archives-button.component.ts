import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslocoDirective } from '@jsverse/transloco';

const ARCHIVE_PREFIXES = ['/stories', '/events', '/plotlines', '/characters', '/places', '/codex'];

@Component({
  selector: 'app-archives-button',
  imports: [RouterLink, TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <a
        routerLink="/stories"
        class="inline-flex size-9 items-center justify-center rounded-md text-foreground-subtle
               hover:bg-surface-muted hover:text-foreground
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-faint"
        [class.bg-surface-muted]="active()"
        [class.text-foreground]="active()"
        [attr.aria-current]="active() ? 'page' : null"
        [attr.aria-label]="t('tooltip.archivesAria')"
        [title]="t('nav.archives')"
      >
        <svg
          class="size-5"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
          <path d="M10 12h4" />
        </svg>
      </a>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivesButtonComponent {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly active = computed(() =>
    ARCHIVE_PREFIXES.some((p) => this.url().startsWith(p)),
  );
}
