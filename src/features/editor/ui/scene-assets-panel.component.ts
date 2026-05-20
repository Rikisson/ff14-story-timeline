import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AssetPickerComponent } from '@features/media';
import { BgmTransition, Scene, SceneTransition, TextSpeed } from '@features/stories';
import { AssetThumbResolver } from '@shared/data-access';
import { BackgroundEffect } from '@shared/models';
import {
  CollapsibleSectionComponent,
  GhostButtonComponent,
  SecondaryButtonComponent,
  SegmentedControlComponent,
  SegmentOption,
  ToggleButtonComponent,
} from '@shared/ui';
import editorEn from '../i18n/en.json';
import editorUk from '../i18n/uk.json';

const TEXT_SPEEDS: readonly TextSpeed[] = ['slow', 'normal', 'fast', 'instant'];
const BGM_TRANSITIONS: readonly BgmTransition[] = ['crossfade', 'cut'];
type SceneTransitionOption = SceneTransition | 'none';
const SCENE_TRANSITIONS: readonly SceneTransitionOption[] = [
  'none',
  'crossfade',
  'fade-through-black',
];
const TRANSITION_DURATIONS = [
  { key: 'fast', ms: 250 },
  { key: 'normal', ms: 500 },
  { key: 'slow', ms: 1000 },
] as const;
const DEFAULT_TRANSITION_MS = 500;
type BackgroundEffectOption = BackgroundEffect | 'none';
const BG_EFFECTS: readonly BackgroundEffectOption[] = [
  'none',
  'darken',
  'desaturate',
  'sepia',
  'cool',
  'warm',
];

@Component({
  selector: 'app-scene-assets-panel',
  imports: [
    AssetPickerComponent,
    CollapsibleSectionComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
    SegmentedControlComponent,
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
      <section class="flex flex-col gap-3">
        <h4 class="m-0 text-sm font-semibold text-foreground-muted">{{ t('field.assets') }}</h4>

        <app-collapsible-section [title]="t('section.background')">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
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
              @if (placeBackgrounds().length > 0) {
                <span class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                  {{ t('field.placeBackgrounds') }}
                </span>
                <div class="grid grid-cols-3 gap-2">
                  @for (id of placeBackgrounds(); track id) {
                    @if (placeBackgroundThumbs().get(id); as thumb) {
                      <button
                        type="button"
                        class="relative aspect-video overflow-hidden rounded border"
                        [class.border-accent-ring]="backgroundAssetId() === id"
                        [class.ring-2]="backgroundAssetId() === id"
                        [class.ring-accent-ring]="backgroundAssetId() === id"
                        [class.border-border]="backgroundAssetId() !== id"
                        [attr.aria-pressed]="backgroundAssetId() === id"
                        [attr.aria-label]="t('tooltip.usePlaceBackground', { label: thumb.label ?? '' })"
                        (click)="onBackgroundPicked([id])"
                      >
                        <img [ngSrc]="thumb.url" alt="" fill class="object-cover" />
                      </button>
                    }
                  }
                </div>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                {{ t('field.backgroundEffect') }}
              </label>
              <app-segmented-control
                [options]="backgroundEffectOptions()"
                [value]="resolvedBackgroundEffect()"
                [ariaLabel]="t('field.backgroundEffect')"
                (valueChange)="onBackgroundEffectChange($event)"
              />
            </div>
          </div>
        </app-collapsible-section>

        <app-collapsible-section [title]="t('section.audio')">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">{{ t('field.sfx') }}</label>
              @if (sfxUrl(); as a) {
                <audio class="w-full" controls preload="none" [src]="a"></audio>
                <div class="flex gap-2">
                  <button uiSecondary type="button" (click)="sfxPicker.open()">{{ t('action.replace') }}</button>
                  <button uiGhost type="button" (click)="clearSfx()">{{ t('action.remove') }}</button>
                </div>
              } @else {
                <button uiSecondary type="button" (click)="sfxPicker.open()">
                  {{ t('action.pickSfx') }}
                </button>
              }
              <p class="m-0 text-xs text-foreground-faint">{{ t('empty.sfxHint') }}</p>
              <app-asset-picker
                #sfxPicker
                kind="sfx"
                [title]="t('tooltip.pickSfxTitle')"
                [currentSelection]="sfxSelection()"
                (picked)="onSfxPicked($event)"
              />
            </div>

            <div class="flex flex-col gap-3">
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
                <app-segmented-control
                  [options]="bgmTransitionOptions()"
                  [value]="resolvedBgmTransition()"
                  [ariaLabel]="t('field.bgmTransition')"
                  (valueChange)="onBgmTransitionChange($event)"
                />
              </div>
            </div>
          </div>
        </app-collapsible-section>

        <app-collapsible-section [title]="t('section.playback')">
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                {{ t('field.sceneTransition') }}
              </label>
              <app-segmented-control
                [options]="sceneTransitionOptions()"
                [value]="resolvedTransition()"
                [ariaLabel]="t('field.sceneTransition')"
                (valueChange)="onTransitionChange($event)"
              />
              @if (resolvedTransition() !== 'none') {
                <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                  {{ t('field.transitionDuration') }}
                </label>
                <app-segmented-control
                  [options]="transitionDurationOptions()"
                  [value]="resolvedTransitionMs()"
                  [ariaLabel]="t('field.transitionDuration')"
                  (valueChange)="onTransitionMsChange($event)"
                />
              }
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                {{ t('field.textSpeed') }}
              </label>
              <app-segmented-control
                [options]="textSpeedOptions()"
                [value]="resolvedTextSpeed()"
                [ariaLabel]="t('field.textSpeed')"
                (valueChange)="onTextSpeedChange($event)"
              />
              <p class="m-0 text-xs text-foreground-faint">{{ t('field.textSpeedHelp') }}</p>
            </div>
          </div>
        </app-collapsible-section>
      </section>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneAssetsPanelComponent {
  private readonly assets = inject(AssetThumbResolver);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly backgroundAssetId = input<string | undefined>();
  readonly backgroundEffect = input<BackgroundEffect | undefined>();
  readonly placeBackgrounds = input<string[]>([]);
  readonly sfxAssetId = input<string | undefined>();
  readonly bgmAssetId = input<string | undefined>();
  readonly bgmSilence = input<boolean>(false);
  readonly bgmTransition = input<BgmTransition | undefined>();
  readonly textSpeed = input<TextSpeed | undefined>();
  readonly transition = input<SceneTransition | undefined>();
  readonly transitionMs = input<number | undefined>();

  readonly update = output<Partial<Scene>>();

  protected readonly backgroundUrl = computed(() =>
    this.assets.resolve(this.backgroundAssetId())()?.url,
  );
  protected readonly placeBackgroundThumbs = this.assets.resolveMany(this.placeBackgrounds);
  protected readonly sfxUrl = computed(() => this.assets.resolve(this.sfxAssetId())()?.url);
  protected readonly bgmOverrideUrl = computed(() =>
    this.assets.resolve(this.bgmAssetId())()?.url,
  );

  protected readonly backgroundSelection = computed(() => {
    const id = this.backgroundAssetId();
    return id ? [id] : [];
  });
  protected readonly sfxSelection = computed(() => {
    const id = this.sfxAssetId();
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
  protected readonly resolvedBackgroundEffect = computed<BackgroundEffectOption>(
    () => this.backgroundEffect() ?? 'none',
  );
  protected readonly resolvedTransition = computed<SceneTransitionOption>(
    () => this.transition() ?? 'none',
  );
  protected readonly resolvedTransitionMs = computed<number>(
    () => this.transitionMs() ?? DEFAULT_TRANSITION_MS,
  );

  protected readonly backgroundEffectOptions = computed<SegmentOption<BackgroundEffectOption>[]>(
    () => {
      this.activeLang();
      return BG_EFFECTS.map((effect) => ({
        value: effect,
        label: this.transloco.translate('editor.effect.' + effect),
      }));
    },
  );
  protected readonly sceneTransitionOptions = computed<SegmentOption<SceneTransitionOption>[]>(
    () => {
      this.activeLang();
      return SCENE_TRANSITIONS.map((mode) => ({
        value: mode,
        label: this.transloco.translate('editor.sceneTransition.' + mode),
      }));
    },
  );
  protected readonly transitionDurationOptions = computed<SegmentOption<number>[]>(() => {
    this.activeLang();
    return TRANSITION_DURATIONS.map((duration) => ({
      value: duration.ms,
      label: this.transloco.translate('editor.transitionDuration.' + duration.key),
    }));
  });
  protected readonly bgmTransitionOptions = computed<SegmentOption<BgmTransition>[]>(() => {
    this.activeLang();
    return BGM_TRANSITIONS.map((mode) => ({
      value: mode,
      label: this.transloco.translate('editor.transition.' + mode),
    }));
  });
  protected readonly textSpeedOptions = computed<SegmentOption<TextSpeed>[]>(() => {
    this.activeLang();
    return TEXT_SPEEDS.map((speed) => ({
      value: speed,
      label: this.transloco.translate('editor.speed.' + speed),
    }));
  });

  protected onBackgroundPicked(ids: string[]): void {
    this.update.emit({ backgroundAssetId: ids[0] });
  }

  protected onSfxPicked(ids: string[]): void {
    this.update.emit({ sfxAssetId: ids[0] });
  }

  protected clearBackground(): void {
    this.update.emit({ backgroundAssetId: undefined });
  }

  protected clearSfx(): void {
    this.update.emit({ sfxAssetId: undefined });
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

  protected onBackgroundEffectChange(effect: BackgroundEffectOption): void {
    this.update.emit({ backgroundEffect: effect === 'none' ? undefined : effect });
  }

  protected onTransitionChange(mode: SceneTransitionOption): void {
    if (mode === 'none') {
      this.update.emit({ transition: undefined, transitionMs: undefined });
    } else {
      this.update.emit({ transition: mode });
    }
  }

  protected onTransitionMsChange(ms: number): void {
    this.update.emit({ transitionMs: ms === DEFAULT_TRANSITION_MS ? undefined : ms });
  }
}
