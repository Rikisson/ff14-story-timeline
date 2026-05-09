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
import { CharactersService } from '@features/characters';
import { CodexCategoriesService, CodexEntriesService } from '@features/codex';
import { EventsService } from '@features/events';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { StoriesService } from '@features/stories';
import { UniverseSelectorComponent, UniverseStore } from '@features/universes';
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
  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly events = inject(EventsService);
  private readonly stories = inject(StoriesService);
  private readonly plotlines = inject(PlotlinesService);
  private readonly codex = inject(CodexEntriesService);
  private readonly codexCategories = inject(CodexCategoriesService);
  private readonly calendar = inject(CalendarService);

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

  protected readonly refreshErrors = computed<{ entityKey: string; message: string }[]>(() => {
    const errors: { entityKey: string; message: string }[] = [];
    const c = this.characters.refreshError();
    if (c) errors.push({ entityKey: 'characters', message: c });
    const p = this.places.refreshError();
    if (p) errors.push({ entityKey: 'places', message: p });
    const e = this.events.refreshError();
    if (e) errors.push({ entityKey: 'events', message: e });
    const s = this.stories.refreshError();
    if (s) errors.push({ entityKey: 'stories', message: s });
    const pl = this.plotlines.refreshError();
    if (pl) errors.push({ entityKey: 'plotlines', message: pl });
    const cx = this.codex.refreshError();
    if (cx) errors.push({ entityKey: 'codex', message: cx });
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
