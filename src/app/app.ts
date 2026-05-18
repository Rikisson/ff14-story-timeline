import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { filter, map, of, switchMap, timer } from 'rxjs';
import { AuthButtonComponent, AuthStore } from '@features/auth';
import { CalendarService } from '@features/calendar';
import { CodexCategoriesService } from '@features/codex';
import { UniverseSelectorComponent, UniverseStore } from '@features/universes';
import { LayoutStore } from '@shared/data-access';
import { GhostButtonComponent, LocaleToggleComponent, ThemeToggleComponent } from '@shared/ui';
import { SEED_AUTHOR_UID } from '../mocks/seed-author';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoDirective,
    AuthButtonComponent,
    GhostButtonComponent,
    LocaleToggleComponent,
    ThemeToggleComponent,
    UniverseSelectorComponent,
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly user = inject(AuthStore).user;
  private readonly universes = inject(UniverseStore);
  private readonly codexCategories = inject(CodexCategoriesService);
  private readonly calendar = inject(CalendarService);
  private readonly layout = inject(LayoutStore);

  protected readonly chromeHidden = this.layout.chromeHidden;
  protected readonly canSeed = computed(() => this.user()?.uid === SEED_AUTHOR_UID);
  protected readonly seeding = signal(false);
  protected readonly hasActiveUniverse = computed(() => !!this.universes.activeUniverse());

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

  protected async seedTestData(): Promise<void> {
    const u = this.user();
    if (!u || !this.canSeed()) return;
    const ok = window.confirm(this.transloco.translate('general.message.seedConfirm'));
    if (!ok) return;
    this.seeding.set(true);
    try {
      const { SeederService, DEFAULT_UNIVERSE_ID } = await import('../mocks/seeder.service');
      await this.injector.get(SeederService).seedAll(u.uid);
      await this.universes.refresh();
      this.universes.setActive(DEFAULT_UNIVERSE_ID);
    } catch (err) {
      console.error('Seed failed', err);
    } finally {
      this.seeding.set(false);
    }
  }
}
