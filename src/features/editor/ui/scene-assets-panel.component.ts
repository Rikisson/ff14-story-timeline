import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AssetPickerComponent, MediaAssetsService } from '@features/media';
import { Scene } from '@features/stories';
import { GhostButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import editorEn from '../i18n/en.json';
import editorUk from '../i18n/uk.json';

@Component({
  selector: 'app-scene-assets-panel',
  imports: [
    AssetPickerComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
    NgOptimizedImage,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'editor',
      loader: {
        en: () => Promise.resolve(editorEn),
        uk: () => Promise.resolve(editorUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'editor'">
      <section class="flex flex-col gap-4">
        <h4 class="m-0 text-sm font-semibold text-foreground-muted">{{ t('field.assets') }}</h4>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
            {{ t('field.background') }}
          </label>
          @if (backgroundUrl(); as bg) {
            <div class="relative aspect-video w-full overflow-hidden rounded border border-border">
              <img [ngSrc]="bg" [alt]="t('tooltip.sceneBackgroundAlt')" fill class="object-cover" />
            </div>
            <div class="flex gap-2">
              <button uiSecondary type="button" (click)="bgPicker.open()">{{ t('action.replace') }}</button>
              <button uiGhost type="button" (click)="clearBackground()">{{ t('action.remove') }}</button>
            </div>
          } @else {
            <button uiSecondary type="button" (click)="bgPicker.open()">
              {{ t('action.pickBackground') }}
            </button>
          }
          <app-asset-picker
            #bgPicker
            kind="background"
            [title]="t('tooltip.pickBackgroundTitle')"
            [currentSelection]="backgroundSelection()"
            (picked)="onBackgroundPicked($event)"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">{{ t('field.audio') }}</label>
          @if (audioUrl(); as a) {
            <audio class="w-full" controls preload="none" [src]="a"></audio>
            <div class="flex gap-2">
              <button uiSecondary type="button" (click)="audioPicker.open()">{{ t('action.replace') }}</button>
              <button uiGhost type="button" (click)="clearAudio()">{{ t('action.remove') }}</button>
            </div>
          } @else {
            <button uiSecondary type="button" (click)="audioPicker.open()">
              {{ t('action.pickAudio') }}
            </button>
          }
          <app-asset-picker
            #audioPicker
            kind="ambient"
            [title]="t('tooltip.pickAudioTitle')"
            [currentSelection]="audioSelection()"
            (picked)="onAudioPicked($event)"
          />
        </div>
      </section>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneAssetsPanelComponent {
  private readonly media = inject(MediaAssetsService);

  readonly backgroundAssetId = input<string | undefined>();
  readonly audioAssetId = input<string | undefined>();

  readonly update = output<Partial<Scene>>();

  protected readonly backgroundUrl = computed(() => this.media.urlFor(this.backgroundAssetId()));
  protected readonly audioUrl = computed(() => this.media.urlFor(this.audioAssetId()));

  protected readonly backgroundSelection = computed(() => {
    const id = this.backgroundAssetId();
    return id ? [id] : [];
  });
  protected readonly audioSelection = computed(() => {
    const id = this.audioAssetId();
    return id ? [id] : [];
  });

  protected onBackgroundPicked(ids: string[]): void {
    this.update.emit({ backgroundAssetId: ids[0] });
  }

  protected onAudioPicked(ids: string[]): void {
    this.update.emit({ audioAssetId: ids[0] });
  }

  protected clearBackground(): void {
    this.update.emit({ backgroundAssetId: undefined });
  }

  protected clearAudio(): void {
    this.update.emit({ audioAssetId: undefined });
  }
}
