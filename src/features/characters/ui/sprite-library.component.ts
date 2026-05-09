import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AssetPickerComponent, MediaAssetsService } from '@features/media';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { CharactersService } from '../data-access/characters.service';

interface ResolvedSprite {
  id: string;
  label: string;
  url: string;
}

@Component({
  selector: 'app-character-sprite-library',
  imports: [
    NgOptimizedImage,
    AssetPickerComponent,
    DangerButtonComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
  ],
  template: `
    <section class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <header class="flex items-center justify-between">
        <h4 class="m-0 text-sm font-semibold text-foreground">Sprites</h4>
        <span class="text-xs text-foreground-faint">First sprite is the default.</span>
      </header>

      @if (error(); as e) {
        <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
      }

      @if (resolved().length === 0) {
        <p class="m-0 text-sm italic text-foreground-faint">No sprites yet.</p>
      } @else {
        <ul class="flex flex-col gap-2">
          @for (s of resolved(); track s.id; let i = $index) {
            <li class="flex items-center gap-2 rounded-md border border-border p-2">
              <img
                [ngSrc]="s.url"
                alt=""
                width="48"
                height="48"
                class="size-12 rounded object-cover"
              />
              <span class="flex-1 truncate text-sm text-foreground">{{ s.label }}</span>
              @if (i === 0) {
                <span
                  class="rounded bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200"
                >
                  DEFAULT
                </span>
              } @else {
                <button uiGhost type="button" (click)="setDefault(s.id)">Set default</button>
              }
              <button uiDanger type="button" (click)="remove(s.id)">Remove</button>
            </li>
          }
        </ul>
      }

      <div>
        <button
          uiSecondary
          type="button"
          [loading]="busy()"
          (click)="picker.open()"
        >
          + Add from library
        </button>
      </div>

      <app-asset-picker
        #picker
        kind="sprite"
        title="Pick sprites for this character"
        [multiSelect]="true"
        [currentSelection]="sprites()"
        (picked)="onPicked($event)"
      />
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpriteLibraryComponent {
  readonly characterId = input.required<string>();
  readonly sprites = input<string[]>([]);

  private readonly media = inject(MediaAssetsService);
  private readonly service = inject(CharactersService);
  protected readonly picker = viewChild.required(AssetPickerComponent);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly resolved = computed<ResolvedSprite[]>(() => {
    const out: ResolvedSprite[] = [];
    for (const id of this.sprites()) {
      const asset = this.media.byId(id);
      if (asset) out.push({ id: asset.id, label: asset.label, url: asset.url });
    }
    return out;
  });

  protected async onPicked(ids: string[]): Promise<void> {
    await this.run(() => this.service.updateSprites(this.characterId(), ids));
  }

  protected async setDefault(id: string): Promise<void> {
    const current = this.sprites();
    if (!current.includes(id)) return;
    const next = [id, ...current.filter((x) => x !== id)];
    await this.run(() => this.service.updateSprites(this.characterId(), next));
  }

  protected async remove(id: string): Promise<void> {
    if (!confirm('Remove this sprite from the character?')) return;
    const next = this.sprites().filter((x) => x !== id);
    await this.run(() => this.service.updateSprites(this.characterId(), next));
  }

  private async run(work: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await work();
    } catch (err) {
      this.error.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }
}
