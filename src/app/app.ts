import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { filter, map, of, switchMap, timer } from 'rxjs';
import { AuthButtonComponent, AuthStore } from '@features/auth';
import { CalendarService } from '@features/calendar';
import { CodexCategoriesService } from '@features/codex';
import { UniverseSelectorComponent, UniverseStore } from '@features/universes';
import { LayoutStore } from '@shared/data-access';
import {
  ArchivesButtonComponent,
  BrandComponent,
  LocaleToggleComponent,
  ThemeToggleComponent,
} from '@shared/ui';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    TranslocoDirective,
    ArchivesButtonComponent,
    AuthButtonComponent,
    BrandComponent,
    LocaleToggleComponent,
    ThemeToggleComponent,
    UniverseSelectorComponent,
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly user = inject(AuthStore).user;
  private readonly universes = inject(UniverseStore);
  private readonly codexCategories = inject(CodexCategoriesService);
  private readonly calendar = inject(CalendarService);
  private readonly layout = inject(LayoutStore);

  protected readonly chromeHidden = this.layout.chromeHidden;
  protected readonly hasActiveUniverse = computed(() => !!this.universes.activeUniverse());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly isLanding = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    return path === '' || path === '/';
  });

  protected readonly isNavigating = toSignal(
    this.router.events.pipe(
      filter(
        (e) =>
          e instanceof NavigationStart ||
          e instanceof NavigationEnd ||
          e instanceof NavigationCancel ||
          e instanceof NavigationError,
      ),
      switchMap((e) =>
        e instanceof NavigationStart ? timer(150).pipe(map(() => true)) : of(false),
      ),
    ),
    { initialValue: false },
  );

  // Per-kind services no longer hold a universe-wide preload, so the
  // app-level refresh-error banner shrinks to the two config docs that
  // are still auto-hydrated per universe (categories + calendar).
  // Page-level read errors surface inside the directory / timeline
  // stores that own them.
  protected readonly refreshErrors = computed<{ entityKey: string; message: string }[]>(() => {
    const errors: { entityKey: string; message: string }[] = [];
    const ccx = this.codexCategories.refreshError();
    if (ccx) errors.push({ entityKey: 'codexCategories', message: ccx });
    const ca = this.calendar.refreshError();
    if (ca) errors.push({ entityKey: 'calendar', message: ca });
    return errors;
  });
}
