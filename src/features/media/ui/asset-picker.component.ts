import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { AssetDoc, AssetKind, AUDIO_ASSET_KINDS } from '../data-access/asset.types';
import { CropAspect } from '../data-access/image-crop';
import { MediaAssetsService } from '../data-access/media-assets.service';
import { ImageCropDialogComponent } from './image-crop-dialog.component';
import mediaEn from '../i18n/en.json';
import mediaUk from '../i18n/uk.json';

@Component({
  selector: 'app-asset-picker',
  imports: [
    NgOptimizedImage,
    DangerButtonComponent,
    GhostButtonComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    TranslocoDirective,
    ImageCropDialogComponent,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'media',
      loader: {
        en: () => Promise.resolve(mediaEn),
        uk: () => Promise.resolve(mediaUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'media'">
      <ng-container *transloco="let g; prefix: 'general'">
        <dialog
          #dialog
          class="m-auto rounded-lg p-0 bg-surface text-foreground backdrop:bg-backdrop"
          [attr.aria-label]="resolvedTitle()"
          (close)="onDialogClose()"
          (click)="onBackdropClick($event)"
        >
          <div class="flex max-h-[80vh] w-[min(48rem,92vw)] flex-col">
            <header class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 class="m-0 text-base font-semibold text-foreground">{{ resolvedTitle() }}</h3>
              <button
                uiGhost
                type="button"
                class="h-8 w-8 p-0 text-lg leading-none"
                [attr.aria-label]="g('action.close')"
                (click)="cancel()"
              >×</button>
            </header>

            <div class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <input
                type="text"
                class="flex-1 rounded-md border border-border-strong bg-surface text-foreground placeholder:text-foreground-faint px-3 py-1.5 text-sm"
                [placeholder]="t('empty.filterByTag')"
                [value]="tagFilter()"
                (input)="onTagInput($event)"
              />
              <button
                uiSecondary
                type="button"
                [loading]="uploading()"
                (click)="fileInput.click()"
              >{{ t('action.upload') }}</button>
              <input
                #fileInput
                type="file"
                class="hidden"
                [accept]="acceptAttr()"
                (change)="onPick($event)"
              />
            </div>

            @if (uploadHintKey(); as hintKey) {
              <p class="m-0 px-4 pb-2 text-xs text-foreground-faint">{{ t(hintKey) }}</p>
            }

            @if (uploadError(); as e) {
              <p class="m-0 px-4 py-2 text-sm text-danger-foreground">{{ e }}</p>
            }

            <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              @if (visible().length === 0) {
                <p class="m-0 py-8 text-center text-sm italic text-foreground-faint">
                  @if (allForKind().length === 0) {
                    {{ t('empty.noAssetsForKind', { kind: kind() }) }}
                  } @else {
                    {{ t('empty.noAssetsMatchTag') }}
                  }
                </p>
              } @else if (isAudio()) {
                <ul class="m-0 flex list-none flex-col gap-2 p-0">
                  @for (a of visible(); track a.id) {
                    <li
                      class="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center"
                      [class.border-accent-ring]="isSelected(a.id)"
                      [class.bg-accent-soft]="isSelected(a.id)"
                      [class.border-border]="!isSelected(a.id)"
                    >
                      <button
                        type="button"
                        class="text-left text-sm font-medium text-foreground hover:underline"
                        (click)="toggle(a.id)"
                      >{{ a.label }}</button>
                      <audio class="ml-auto" controls preload="none" [src]="a.url"></audio>
                      <div class="flex shrink-0 gap-2">
                        <button uiGhost type="button" (click)="renamePrompt(a)">{{ t('action.rename') }}</button>
                        <button uiDanger type="button" (click)="confirmDelete(a)">{{ g('action.delete') }}</button>
                      </div>
                    </li>
                  }
                </ul>
              } @else {
                <ul class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
                  @for (a of visible(); track a.id) {
                    <li
                      class="flex flex-col gap-2 overflow-hidden rounded-md border bg-surface"
                      [class.border-accent-ring]="isSelected(a.id)"
                      [class.ring-2]="isSelected(a.id)"
                      [class.ring-accent-ring]="isSelected(a.id)"
                      [class.border-border]="!isSelected(a.id)"
                    >
                      <button
                        type="button"
                        class="relative aspect-square w-full overflow-hidden bg-surface-muted"
                        [attr.aria-label]="t('tooltip.selectAsset', { label: a.label })"
                        [attr.aria-pressed]="isSelected(a.id)"
                        (click)="toggle(a.id)"
                      >
                        <img
                          [ngSrc]="a.url"
                          [alt]="a.label"
                          fill
                          class="object-cover"
                        />
                        @if (isSelected(a.id)) {
                          <span
                            class="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground shadow"
                            aria-hidden="true"
                          >✓</span>
                        }
                      </button>
                      <div class="flex flex-col gap-1 px-2 pb-2">
                        <p class="m-0 truncate text-xs font-medium text-foreground-muted">{{ a.label }}</p>
                        <div class="flex gap-1">
                          <button
                            uiGhost
                            type="button"
                            class="flex-1 px-1 py-0.5 text-xs"
                            (click)="renamePrompt(a)"
                          >{{ t('action.rename') }}</button>
                          <button
                            uiDanger
                            type="button"
                            class="flex-1 px-1 py-0.5 text-xs"
                            (click)="confirmDelete(a)"
                          >{{ g('action.delete') }}</button>
                        </div>
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>

            <footer class="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button uiGhost type="button" (click)="cancel()">{{ g('action.cancel') }}</button>
              <button
                uiPrimary
                type="button"
                [disabled]="selection().length === 0"
                (click)="confirm()"
              >
                {{ confirmLabel() }}
              </button>
            </footer>
          </div>
        </dialog>

        <app-image-crop-dialog #cropDialog (confirmed)="onCropConfirmed($event)" />
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetPickerComponent {
  readonly kind = input.required<AssetKind>();
  readonly multiSelect = input<boolean>(false);
  readonly currentSelection = input<string[]>([]);
  readonly title = input<string | undefined>(undefined);

  readonly picked = output<string[]>();

  private readonly media = inject(MediaAssetsService);
  private readonly auth = inject(AuthStore);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cropDialog = viewChild.required<ImageCropDialogComponent>('cropDialog');

  protected readonly selection = signal<string[]>([]);
  protected readonly tagFilter = signal<string>('');
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  // Asset library is fetched per-open via `MediaAssetsService.list()`
  // (see `docs/media-rules.md` *Loading — Asset-library surfaces preload by
  // kind/tag*). No universe-wide preload bridge.
  protected readonly allForKind = signal<AssetDoc[]>([]);
  private readonly loadingAssets = signal(false);

  protected readonly resolvedTitle = computed(() => {
    this.activeLang();
    return this.title() ?? this.transloco.translate('media.tooltip.defaultPickerTitle');
  });

  protected readonly isAudio = computed(() => AUDIO_ASSET_KINDS.includes(this.kind()));

  // Crop framing per image kind: covers and backgrounds default to landscape
  // 16:9 with a 1280px width floor (the `processImage` minimum); sprites
  // default to portrait 9:16 with no floor. The author can still switch the
  // ratio — or skip cropping — inside the dialog.
  private readonly defaultAspect = computed<CropAspect>(() =>
    this.kind() === 'sprite' ? '9:16' : '16:9',
  );
  private readonly cropMinWidth = computed<number | undefined>(() =>
    this.kind() === 'sprite' ? undefined : 1280,
  );

  // Every image kind accepts the same photo formats — covers and backgrounds
  // transcode to WebP, sprites normalize losslessly. Audio extensions are
  // listed explicitly because Windows maps `.webm` to `video/webm` by OS
  // extension table — an `accept="audio/*"` alone would hide WebM-Opus files
  // from the file picker dialog.
  protected readonly acceptAttr = computed(() => {
    if (this.isAudio()) return 'audio/*,.webm,.weba,.opus,.ogg,.oga,.m4a,.aac,.mp3';
    return 'image/jpeg,image/png,image/webp,image/avif';
  });

  // Key is relative to the `media` transloco prefix used in the template.
  protected readonly uploadHintKey = computed(() => {
    const k = this.kind();
    if (AUDIO_ASSET_KINDS.includes(k)) return 'hint.upload.audio' as const;
    return `hint.upload.${k}` as const;
  });

  protected readonly visible = computed(() => {
    const tag = this.tagFilter().trim().toLowerCase();
    if (!tag) return this.allForKind();
    return this.allForKind().filter((a) =>
      (a.tags ?? []).some((t) => t.toLowerCase().includes(tag)),
    );
  });

  protected readonly confirmLabel = computed(() => {
    this.activeLang();
    const n = this.selection().length;
    if (!this.multiSelect()) return this.transloco.translate('media.action.useAsset');
    if (n === 0) return this.transloco.translate('media.action.pickAtLeastOne');
    return this.transloco.translate('media.action.useAssetsCount', { count: n });
  });

  constructor() {
    // Reset selection when the input value changes (e.g., picker reopened
    // for a different entity).
    effect(() => {
      this.selection.set([...this.currentSelection()]);
    });
  }

  open(): void {
    this.uploadError.set(null);
    this.tagFilter.set('');
    this.selection.set([...this.currentSelection()]);
    this.dialog().nativeElement.showModal();
    void this.refreshAssets();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  private async refreshAssets(): Promise<void> {
    if (this.loadingAssets()) return;
    this.loadingAssets.set(true);
    try {
      const rows = await this.media.list({ kind: this.kind() });
      this.allForKind.set(rows);
    } catch (err) {
      this.uploadError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.loadingAssets.set(false);
    }
  }

  protected isSelected(id: string): boolean {
    return this.selection().includes(id);
  }

  protected toggle(id: string): void {
    if (!this.multiSelect()) {
      this.selection.set([id]);
      return;
    }
    this.selection.update((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );
  }

  protected onTagInput(event: Event): void {
    this.tagFilter.set((event.target as HTMLInputElement).value);
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    // Audio uploads pass through as authored. Image uploads route through the
    // crop dialog first; it emits a cropped file — or the original, via "Use
    // full image" — back to `onCropConfirmed`.
    if (this.isAudio()) {
      void this.uploadFile(file);
      return;
    }
    this.uploadError.set(null);
    this.cropDialog().open(file, {
      aspect: this.defaultAspect(),
      minSourceWidth: this.cropMinWidth(),
    });
  }

  protected onCropConfirmed(file: File): void {
    void this.uploadFile(file);
  }

  private async uploadFile(file: File): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) {
      this.uploadError.set(this.transloco.translate('media.message.signInToUpload'));
      return;
    }
    this.uploading.set(true);
    this.uploadError.set(null);
    try {
      const asset = await this.media.upload({ kind: this.kind(), file }, uid);
      // Auto-select the freshly uploaded asset so the user can confirm it
      // without re-finding it in the grid.
      if (this.multiSelect()) {
        this.selection.update((curr) => [...curr, asset.id]);
      } else {
        this.selection.set([asset.id]);
      }
      // Prepend so the new asset appears at the top of the grid without a
      // full re-fetch.
      this.allForKind.update((curr) => [asset, ...curr]);
    } catch (err) {
      this.uploadError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async renamePrompt(asset: AssetDoc): Promise<void> {
    const next = window.prompt(
      this.transloco.translate('media.message.renameAssetPrompt'),
      asset.label,
    );
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === asset.label) return;
    try {
      await this.media.rename(asset.id, trimmed);
      this.allForKind.update((curr) =>
        curr.map((a) => (a.id === asset.id ? { ...a, label: trimmed, updatedAt: Date.now() } : a)),
      );
    } catch (err) {
      this.uploadError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }

  protected async confirmDelete(asset: AssetDoc): Promise<void> {
    const message = this.transloco.translate('media.message.deleteAssetConfirm', {
      label: asset.label,
    });
    if (!window.confirm(message)) {
      return;
    }
    try {
      await this.media.delete(asset);
      this.selection.update((curr) => curr.filter((x) => x !== asset.id));
      this.allForKind.update((curr) => curr.filter((a) => a.id !== asset.id));
    } catch (err) {
      this.uploadError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }

  protected confirm(): void {
    if (this.selection().length === 0) return;
    this.picked.emit([...this.selection()]);
    this.close();
  }

  protected cancel(): void {
    this.close();
  }

  protected onDialogClose(): void {
    this.uploadError.set(null);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.close();
    }
  }
}
