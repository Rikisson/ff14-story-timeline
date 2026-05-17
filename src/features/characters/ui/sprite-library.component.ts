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
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AssetPickerComponent } from '@features/media';
import { AssetThumbResolver } from '@shared/data-access';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { CharactersService } from '../data-access/characters.service';
import characterEn from '../i18n/en.json';
import characterUk from '../i18n/uk.json';

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
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'character',
      loader: {
        en: () => Promise.resolve(characterEn),
        uk: () => Promise.resolve(characterUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'character'">
      <ng-container *transloco="let g; prefix: 'general'">
        <section class="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm">
          <header class="flex items-center justify-between">
            <h4 class="m-0 text-sm font-semibold text-foreground">{{ t('field.spritesHeader') }}</h4>
            <span class="text-xs text-foreground-faint">{{ t('message.spriteDefaultHint') }}</span>
          </header>

          @if (error(); as e) {
            <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
          }

          @if (resolved().length === 0) {
            <p class="m-0 text-sm italic text-foreground-faint">{{ t('empty.spritesList') }}</p>
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
                      class="rounded bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground"
                    >
                      {{ t('field.spriteDefaultBadge') }}
                    </span>
                  } @else {
                    <button uiGhost type="button" (click)="setDefault(s.id)">{{ t('action.setSpriteDefault') }}</button>
                  }
                  <button uiDanger type="button" (click)="remove(s.id)">{{ g('action.remove') }}</button>
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
              {{ t('action.addSpriteFromLibrary') }}
            </button>
          </div>

          <app-asset-picker
            #picker
            kind="sprite"
            [title]="t('tooltip.spritePickerTitle')"
            [multiSelect]="true"
            [currentSelection]="sprites()"
            (picked)="onPicked($event)"
          />
        </section>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpriteLibraryComponent {
  readonly characterId = input.required<string>();
  readonly sprites = input<string[]>([]);

  private readonly assets = inject(AssetThumbResolver);
  private readonly service = inject(CharactersService);
  private readonly transloco = inject(TranslocoService);
  protected readonly picker = viewChild.required(AssetPickerComponent);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly resolvedThumbs = this.assets.resolveMany(this.sprites);
  protected readonly resolved = computed<ResolvedSprite[]>(() => {
    const map = this.resolvedThumbs();
    const out: ResolvedSprite[] = [];
    for (const id of this.sprites()) {
      const thumb = map.get(id);
      if (thumb) {
        out.push({ id: thumb.id, label: thumb.label ?? id, url: thumb.url });
      }
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
    if (!confirm(this.transloco.translate('character.message.removeSpriteConfirm'))) return;
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
