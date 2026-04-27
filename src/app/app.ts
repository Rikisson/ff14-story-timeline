import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthButtonComponent, authFeature } from '@features/auth';
import { GhostButtonComponent } from '@shared/ui';
import { SEED_AUTHOR_UID } from '../mocks/seed-data';
import { SeederService } from '../mocks/seeder.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AuthButtonComponent,
    GhostButtonComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly seeder = inject(SeederService);
  private readonly user = inject(Store).selectSignal(authFeature.selectUser);

  protected readonly canSeed = computed(() => this.user()?.uid === SEED_AUTHOR_UID);
  protected readonly seeding = signal(false);

  protected async seedTestData(): Promise<void> {
    const u = this.user();
    if (!u || !this.canSeed()) return;
    this.seeding.set(true);
    try {
      await this.seeder.seedAll(u.uid);
    } catch (err) {
      console.error('Seed failed', err);
    } finally {
      this.seeding.set(false);
    }
  }
}
