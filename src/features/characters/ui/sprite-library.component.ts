import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { AuthStore } from '@features/auth';
import { MediaAssetsService } from '@features/media';
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
    DangerButtonComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
  ],
  template: `
    <section class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="flex items-center justify-between">
        <h4 class="m-0 text-sm font-semibold text-slate-900">Sprites</h4>
        <span class="text-xs text-slate-500">First sprite is the default.</span>
      </header>

      @if (error(); as e) {
        <p class="m-0 text-sm text-red-700">{{ e }}</p>
      }

      @if (resolved().length === 0) {
        <p class="m-0 text-sm italic text-slate-500">No sprites yet.</p>
      } @else {
        <ul class="flex flex-col gap-2">
          @for (s of resolved(); track s.id; let i = $index) {
            <li class="flex items-center gap-2 rounded-md border border-slate-200 p-2">
              <img
                [ngSrc]="s.url"
                alt=""
                width="48"
                height="48"
                class="size-12 rounded object-cover"
              />
              <input
                type="text"
                class="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                [value]="s.label"
                (change)="onRename(s.id, $event)"
                [attr.aria-label]="'Label for sprite ' + (i + 1)"
              />
              @if (i === 0) {
                <span
                  class="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
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
          (click)="fileInput.click()"
        >
          + Add sprite
        </button>
        <input
          #fileInput
          type="file"
          accept="image/webp"
          class="hidden"
          (change)="onPick($event)"
        />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpriteLibraryComponent {
  readonly characterId = input.required<string>();
  readonly sprites = input<string[]>([]);

  private readonly media = inject(MediaAssetsService);
  private readonly auth = inject(AuthStore);
  private readonly service = inject(CharactersService);

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

  protected async onPick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    await this.run(async () => {
      const label = file.name.replace(/\.[^.]+$/, '') || 'Sprite';
      const asset = await this.media.upload({ kind: 'sprite', file, label }, uid);
      const next = [...this.sprites(), asset.id];
      await this.service.updateSprites(this.characterId(), next);
    });
  }

  protected async onRename(id: string, event: Event): Promise<void> {
    const label = (event.target as HTMLInputElement).value.trim();
    if (!label) return;
    const current = this.media.byId(id);
    if (!current || current.label === label) return;
    await this.run(() => this.media.rename(id, label));
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
