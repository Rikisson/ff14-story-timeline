import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { CharacterAssetsService } from '../data-access/character-assets.service';
import { CharactersService } from '../data-access/characters.service';
import { CharacterPortrait } from '../data-access/character.types';

@Component({
  selector: 'app-character-portrait-library',
  imports: [
    NgOptimizedImage,
    DangerButtonComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
  ],
  template: `
    <section class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header class="flex items-center justify-between">
        <h4 class="m-0 text-sm font-semibold text-slate-900">Portraits</h4>
        <span class="text-xs text-slate-500">First portrait is the default.</span>
      </header>

      @if (error(); as e) {
        <p class="m-0 text-sm text-red-700">{{ e }}</p>
      }

      @if (portraits().length === 0) {
        <p class="m-0 text-sm italic text-slate-500">No portraits yet.</p>
      } @else {
        <ul class="flex flex-col gap-2">
          @for (p of portraits(); track p.id; let i = $index) {
            <li class="flex items-center gap-2 rounded-md border border-slate-200 p-2">
              <img
                [ngSrc]="p.url"
                alt=""
                width="48"
                height="48"
                class="size-12 rounded object-cover"
              />
              <input
                type="text"
                class="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                [value]="p.label"
                (change)="onRename(p.id, $event)"
                [attr.aria-label]="'Label for portrait ' + (i + 1)"
              />
              @if (i === 0) {
                <span
                  class="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                >
                  DEFAULT
                </span>
              } @else {
                <button uiGhost type="button" (click)="setDefault(p.id)">Set default</button>
              }
              <button uiDanger type="button" (click)="remove(p.id)">Remove</button>
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
          + Add portrait
        </button>
        <input
          #fileInput
          type="file"
          accept="image/*"
          class="hidden"
          (change)="onPick($event)"
        />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortraitLibraryComponent {
  readonly characterId = input.required<string>();
  readonly portraits = input<CharacterPortrait[]>([]);

  private readonly assets = inject(CharacterAssetsService);
  private readonly service = inject(CharactersService);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly defaultId = computed(() => this.portraits()[0]?.id ?? null);

  protected async onPick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.run(async () => {
      const portraitId = crypto.randomUUID();
      const url = await this.assets.uploadPortrait(this.characterId(), portraitId, file);
      const label = file.name.replace(/\.[^.]+$/, '') || 'Portrait';
      const next: CharacterPortrait[] = [
        ...this.portraits(),
        { id: portraitId, label, url },
      ];
      await this.service.updatePortraits(this.characterId(), next);
    });
  }

  protected async onRename(id: string, event: Event): Promise<void> {
    const label = (event.target as HTMLInputElement).value.trim();
    if (!label) return;
    const current = this.portraits();
    if (current.find((p) => p.id === id)?.label === label) return;
    const next = current.map((p) => (p.id === id ? { ...p, label } : p));
    await this.run(() => this.service.updatePortraits(this.characterId(), next));
  }

  protected async setDefault(id: string): Promise<void> {
    const current = this.portraits();
    const target = current.find((p) => p.id === id);
    if (!target) return;
    const next = [target, ...current.filter((p) => p.id !== id)];
    await this.run(() => this.service.updatePortraits(this.characterId(), next));
  }

  protected async remove(id: string): Promise<void> {
    if (!confirm('Remove this portrait?')) return;
    const next = this.portraits().filter((p) => p.id !== id);
    await this.run(() => this.service.updatePortraits(this.characterId(), next));
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
