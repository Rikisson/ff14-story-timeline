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
import { filter, map, of, switchMap, timer } from 'rxjs';
import { AuthButtonComponent, AuthStore } from '@features/auth';
import { CharactersService } from '@features/characters';
import { CodexEntriesService } from '@features/codex';
import { EventsService } from '@features/events';
import { FactionsService } from '@features/factions';
import { ItemsService } from '@features/items';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { StoriesService } from '@features/stories';
import { UniverseSelectorComponent, UniverseStore } from '@features/universes';
import { GhostButtonComponent } from '@shared/ui';
import { SEED_AUTHOR_UID } from '../mocks/seed-author';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AuthButtonComponent,
    GhostButtonComponent,
    UniverseSelectorComponent,
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly user = inject(AuthStore).user;
  private readonly universes = inject(UniverseStore);
  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly events = inject(EventsService);
  private readonly stories = inject(StoriesService);
  private readonly plotlines = inject(PlotlinesService);
  private readonly items = inject(ItemsService);
  private readonly factions = inject(FactionsService);
  private readonly codex = inject(CodexEntriesService);

  protected readonly canSeed = computed(() => this.user()?.uid === SEED_AUTHOR_UID);
  protected readonly seeding = signal(false);

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

  protected readonly refreshErrors = computed<{ label: string; message: string }[]>(() => {
    const errors: { label: string; message: string }[] = [];
    const c = this.characters.refreshError();
    if (c) errors.push({ label: 'Characters', message: c });
    const p = this.places.refreshError();
    if (p) errors.push({ label: 'Places', message: p });
    const e = this.events.refreshError();
    if (e) errors.push({ label: 'Events', message: e });
    const s = this.stories.refreshError();
    if (s) errors.push({ label: 'Stories', message: s });
    const pl = this.plotlines.refreshError();
    if (pl) errors.push({ label: 'Plotlines', message: pl });
    const it = this.items.refreshError();
    if (it) errors.push({ label: 'Items', message: it });
    const fa = this.factions.refreshError();
    if (fa) errors.push({ label: 'Factions', message: fa });
    const cx = this.codex.refreshError();
    if (cx) errors.push({ label: 'Codex', message: cx });
    return errors;
  });

  protected async seedTestData(): Promise<void> {
    const u = this.user();
    if (!u || !this.canSeed()) return;
    const ok = window.confirm(
      'Seed test data? This will overwrite the default universe and any existing seeded characters, places, events, and stories.',
    );
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
