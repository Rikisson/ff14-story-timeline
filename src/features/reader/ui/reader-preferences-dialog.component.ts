import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { FontSize, ReaderPreferencesService } from '@shared/services';
import { GhostButtonComponent, ToggleButtonComponent } from '@shared/ui';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';

const FONT_SIZES: readonly FontSize[] = ['small', 'medium', 'large', 'xl'];

/**
 * Reader Preferences dialog. Native `<dialog>` for parity with
 * `app-asset-picker`. Settings update immediately — no Apply button —
 * because the underlying `ReaderPreferencesService` persists each
 * mutation to localStorage.
 */
@Component({
  selector: 'app-reader-preferences-dialog',
  imports: [TranslocoDirective, GhostButtonComponent, ToggleButtonComponent],
  providers: [
    provideTranslocoScope({
      scope: 'reader',
      loader: {
        en: () => Promise.resolve(readerEn),
        uk: () => Promise.resolve(readerUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'reader'">
      <dialog
        #dialog
        class="m-auto rounded-lg p-0 bg-surface text-foreground backdrop:bg-backdrop"
        [attr.aria-label]="t('prefs.title')"
        (click)="onBackdropClick($event)"
      >
        <div class="flex max-h-[80vh] w-[min(28rem,92vw)] flex-col">
          <header class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h3 class="m-0 text-base font-semibold text-foreground">{{ t('prefs.title') }}</h3>
            <button
              uiGhost
              type="button"
              class="h-8 w-8 p-0 text-lg leading-none"
              [attr.aria-label]="t('action.close')"
              (click)="close()"
            >×</button>
          </header>

          <div class="flex flex-col gap-5 px-4 py-4">
            <section class="flex flex-col gap-2">
              <app-toggle-button
                [label]="t('prefs.allowTextAnimations')"
                [checked]="prefs.allowTextAnimations()"
                (checkedChange)="prefs.setAllowTextAnimations($event)"
              />
              <p class="m-0 text-xs text-foreground-faint">{{ t('prefs.allowTextAnimationsHelp') }}</p>
            </section>

            <section class="flex flex-col gap-2">
              <label class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                {{ t('prefs.fontSize') }}
              </label>
              <div role="radiogroup" class="flex flex-wrap gap-2" [attr.aria-label]="t('prefs.fontSize')">
                @for (size of fontSizes; track size) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="prefs.fontSize() === size ? 'true' : 'false'"
                    [class]="sizeButtonClass(size)"
                    (click)="prefs.setFontSize(size)"
                  >{{ t('size.' + size) }}</button>
                }
              </div>
            </section>

            <section class="flex flex-col gap-2">
              <label for="prefs-bgm-volume" class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                {{ t('prefs.bgmVolume') }}
              </label>
              <div class="flex items-center gap-3">
                <input
                  id="prefs-bgm-volume"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  class="flex-1"
                  [value]="bgmPercent()"
                  (input)="onBgmInput($event)"
                />
                <span class="w-10 text-right text-sm tabular-nums text-foreground-muted">{{ bgmPercent() }}</span>
              </div>
            </section>

            <section class="flex flex-col gap-2">
              <label for="prefs-sfx-volume" class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                {{ t('prefs.sfxVolume') }}
              </label>
              <div class="flex items-center gap-3">
                <input
                  id="prefs-sfx-volume"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  class="flex-1"
                  [value]="sfxPercent()"
                  (input)="onSfxInput($event)"
                />
                <span class="w-10 text-right text-sm tabular-nums text-foreground-muted">{{ sfxPercent() }}</span>
              </div>
            </section>

            <section class="flex flex-col gap-2">
              <label for="prefs-text-opacity" class="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                {{ t('prefs.textBoxOpacity') }}
              </label>
              <div class="flex items-center gap-3">
                <input
                  id="prefs-text-opacity"
                  type="range"
                  min="40"
                  max="100"
                  step="1"
                  class="flex-1"
                  [value]="opacityPercent()"
                  (input)="onOpacityInput($event)"
                />
                <span class="w-10 text-right text-sm tabular-nums text-foreground-muted">{{ opacityPercent() }}</span>
              </div>
            </section>
          </div>
        </div>
      </dialog>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderPreferencesDialogComponent {
  protected readonly prefs = inject(ReaderPreferencesService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly fontSizes = FONT_SIZES;

  open(): void {
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected bgmPercent(): number {
    return Math.round(this.prefs.bgmVolume() * 100);
  }

  protected sfxPercent(): number {
    return Math.round(this.prefs.sfxVolume() * 100);
  }

  protected onBgmInput(event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(v)) this.prefs.setBgmVolume(v / 100);
  }

  protected onSfxInput(event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(v)) this.prefs.setSfxVolume(v / 100);
  }

  protected opacityPercent(): number {
    return Math.round(this.prefs.textBoxOpacity() * 100);
  }

  protected onOpacityInput(event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(v)) this.prefs.setTextBoxOpacity(v / 100);
  }

  protected sizeButtonClass(size: FontSize): string {
    const base =
      'inline-flex items-center justify-center rounded-md border h-9 px-3 text-sm transition-colors ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';
    return this.prefs.fontSize() === size
      ? `${base} border-accent-ring bg-accent-soft text-accent-soft-foreground focus-visible:ring-accent-ring`
      : `${base} border-border-strong bg-surface text-foreground hover:bg-surface-muted focus-visible:ring-foreground-faint`;
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.close();
    }
  }
}
