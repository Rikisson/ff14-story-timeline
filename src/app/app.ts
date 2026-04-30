import { ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthButtonComponent, AuthStore } from '@features/auth';
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
  private readonly user = inject(AuthStore).user;
  private readonly universes = inject(UniverseStore);

  protected readonly canSeed = computed(() => this.user()?.uid === SEED_AUTHOR_UID);
  protected readonly seeding = signal(false);

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
