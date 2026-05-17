import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AssetPickerComponent } from '@features/media';
import { BgmTransition, Scene, TextSpeed } from '@features/stories';
import { AssetThumbResolver } from '@shared/data-access';
import { GhostButtonComponent, SecondaryButtonComponent, ToggleButtonComponent } from '@shared/ui';
import editorEn from '../i18n/en.json';
import editorUk from '../i18n/uk.json';

const TEXT_SPEEDS: readonly TextSpeed[] = ['slow', 'normal', 'fast', 'instant'];
const BGM_TRANSITIONS: readonly BgmTransition[] = ['crossfade', 'cut'];

@Component({
  selector: 'app-scene-assets-panel',
  imports: [
    AssetPickerComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
    ToggleButtonComponent,
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

        <details class="rounded border border-border bg-surface-muted/40 px-3 py-2 [&>summary]:cursor-pointer">
          <summary class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
            {{ t('section.sceneBgm') }}
          </summary>
          <div class="mt-3 flex flex-col gap-3">
            <div class="flex flex-col gap-2">
              <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                {{ t('field.sceneBgm') }}
              </label>
              @if (bgmSilence()) {
                <p class="m-0 text-xs italic text-foreground-faint">{{ t('empty.bgmSilencedHint') }}</p>
              } @else if (bgmOverrideUrl(); as url) {
                <audio class="w-full" controls preload="none" [src]="url"></audio>
                <div class="flex gap-2">
                  <button uiSecondary type="button" (click)="bgmPicker.open()">{{ t('action.replaceBgm') }}</button>
                  <button uiGhost type="button" (click)="clearBgmOverride()">{{ t('action.removeBgm') }}</button>
                </div>
              } @else {
                <button uiSecondary type="button" [disabled]="bgmSilence()" (click)="bgmPicker.open()">
                  {{ t('action.pickBgm') }}
                </button>
                <p class="m-0 text-xs text-foreground-faint">{{ t('empty.bgmOverrideHint') }}</p>
              }
              <app-asset-picker
                #bgmPicker
                kind="ambient"
                [title]="t('tooltip.pickBgmTitle')"
                [currentSelection]="bgmSelection()"
                (picked)="onBgmPicked($event)"
              />
            </div>

            <app-toggle-button
              [label]="t('field.bgmSilence')"
              [checked]="bgmSilence()"
              (checkedChange)="onBgmSilenceChange($event)"
            />

            <div class="flex flex-col gap-2">
              <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                {{ t('field.bgmTransition') }}
              </label>
              <div role="radiogroup" class="flex flex-wrap gap-2" [attr.aria-label]="t('field.bgmTransition')">
                @for (mode of bgmTransitions; track mode) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="resolvedBgmTransition() === mode ? 'true' : 'false'"
                    [class]="segmentClass(resolvedBgmTransition() === mode)"
                    (click)="onBgmTransitionChange(mode)"
                  >{{ t('transition.' + mode) }}</button>
                }
              </div>
            </div>
          </div>
        </details>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
            {{ t('field.textSpeed') }}
          </label>
          <div role="radiogroup" class="flex flex-wrap gap-2" [attr.aria-label]="t('field.textSpeed')">
            @for (speed of textSpeeds; track speed) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="resolvedTextSpeed() === speed ? 'true' : 'false'"
                [class]="segmentClass(resolvedTextSpeed() === speed)"
                (click)="onTextSpeedChange(speed)"
              >{{ t('speed.' + speed) }}</button>
            }
          </div>
          <p class="m-0 text-xs text-foreground-faint">{{ t('field.textSpeedHelp') }}</p>
        </div>
      </section>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneAssetsPanelComponent {
  private readonly assets = inject(AssetThumbResolver);

  readonly backgroundAssetId = input<string | undefined>();
  readonly audioAssetId = input<string | undefined>();
  readonly bgmAssetId = input<string | undefined>();
  readonly bgmSilence = input<boolean>(false);
  readonly bgmTransition = input<BgmTransition | undefined>();
  readonly textSpeed = input<TextSpeed | undefined>();

  readonly update = output<Partial<Scene>>();

  protected readonly textSpeeds = TEXT_SPEEDS;
  protected readonly bgmTransitions = BGM_TRANSITIONS;

  protected readonly backgroundUrl = computed(() =>
    this.assets.resolve(this.backgroundAssetId())()?.url,
  );
  protected readonly audioUrl = computed(() => this.assets.resolve(this.audioAssetId())()?.url);
  protected readonly bgmOverrideUrl = computed(() =>
    this.assets.resolve(this.bgmAssetId())()?.url,
  );

  protected readonly backgroundSelection = computed(() => {
    const id = this.backgroundAssetId();
    return id ? [id] : [];
  });
  protected readonly audioSelection = computed(() => {
    const id = this.audioAssetId();
    return id ? [id] : [];
  });
  protected readonly bgmSelection = computed(() => {
    const id = this.bgmAssetId();
    return id ? [id] : [];
  });

  protected readonly resolvedTextSpeed = computed<TextSpeed>(() => this.textSpeed() ?? 'fast');
  protected readonly resolvedBgmTransition = computed<BgmTransition>(
    () => this.bgmTransition() ?? 'crossfade',
  );

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

  protected onBgmPicked(ids: string[]): void {
    this.update.emit({ bgmAssetId: ids[0] });
  }

  protected clearBgmOverride(): void {
    this.update.emit({ bgmAssetId: undefined });
  }

  protected onBgmSilenceChange(silence: boolean): void {
    this.update.emit({ bgmSilence: silence ? true : undefined });
  }

  protected onBgmTransitionChange(mode: BgmTransition): void {
    this.update.emit({ bgmTransition: mode === 'crossfade' ? undefined : mode });
  }

  protected onTextSpeedChange(speed: TextSpeed): void {
    this.update.emit({ textSpeed: speed });
  }

  protected segmentClass(active: boolean): string {
    const base =
      'inline-flex items-center justify-center rounded-md border h-9 px-3 text-sm transition-colors ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';
    return active
      ? `${base} border-accent-ring bg-accent-soft text-accent-soft-foreground focus-visible:ring-accent-ring`
      : `${base} border-border-strong bg-surface text-foreground hover:bg-surface-muted focus-visible:ring-foreground-faint`;
  }
}
