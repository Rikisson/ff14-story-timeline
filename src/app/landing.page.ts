import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';

@Component({
  selector: 'app-landing-page',
  template: `
    <div class="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      @if (loading()) {
        <span
          class="inline-block size-10 rounded-full border-4 border-slate-300 border-t-slate-700 animate-spin"
          aria-hidden="true"
        ></span>
        <p class="m-0 text-slate-600">Loading universes…</p>
      } @else if (!user()) {
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Welcome</h1>
        <p class="m-0 text-slate-600">
          Sign in with the button in the top-right to begin.
        </p>
      } @else if (universes().length === 0) {
        <h1 class="m-0 text-2xl font-semibold text-slate-900">No universes available</h1>
        <p class="m-0 text-slate-600">
          You aren't a member of any universe yet.
          @if (canCreate()) {
            Use the universe menu in the top-left to create one.
          } @else {
            Ask a universe owner to add you.
          }
        </p>
      } @else {
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Pick a universe</h1>
        <p class="m-0 text-slate-600">
          Use the universe menu in the top-left to choose where to work.
        </p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  private readonly universeStore = inject(UniverseStore);
  private readonly router = inject(Router);
  protected readonly user = inject(AuthStore).user;
  protected readonly loading = this.universeStore.loading;
  protected readonly universes = this.universeStore.universes;
  protected readonly activeId = this.universeStore.activeUniverseId;
  protected readonly canCreate = this.universeStore.canCreateUniverse;

  constructor() {
    effect(() => {
      if (this.activeId()) {
        void this.router.navigate(['/timeline'], { replaceUrl: true });
      }
    });
  }
}
