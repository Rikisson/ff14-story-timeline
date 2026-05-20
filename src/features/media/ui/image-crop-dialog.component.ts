import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { GhostButtonComponent, PrimaryButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import {
  ClampOptions,
  CropAspect,
  CropCorner,
  CropRect,
  clampCropRect,
  cropFileToFile,
  initialCropRect,
  moveCropRect,
  resizeCropRect,
} from '../data-access/image-crop';
import mediaEn from '../i18n/en.json';
import mediaUk from '../i18n/uk.json';

export interface CropOpenOptions {
  aspect: CropAspect;
  minSourceWidth?: number;
}

interface DragState {
  corner: CropCorner | null;
  startRect: CropRect;
  startX: number;
  startY: number;
  stageW: number;
  stageH: number;
}

const ASPECTS: readonly CropAspect[] = ['free', '16:9', '9:16', '1:1'];

/**
 * Standalone image cropper. Opened imperatively with `open(file, opts)`; emits
 * a cropped `File` on `confirmed` (or the untouched original via "Use full
 * image") and `cancelled` otherwise. Self-contained — depends only on the pure
 * `image-crop` helpers — so any upload surface can embed it.
 */
@Component({
  selector: 'app-image-crop-dialog',
  imports: [
    TranslocoDirective,
    GhostButtonComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
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
          [attr.aria-label]="t('crop.title')"
          (close)="onNativeClose()"
          (click)="onBackdropClick($event)"
        >
          <div class="flex max-h-[90vh] w-[min(56rem,94vw)] flex-col">
            <header class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 class="m-0 text-base font-semibold text-foreground">{{ t('crop.title') }}</h3>
              <button
                uiGhost
                type="button"
                class="h-8 w-8 p-0 text-lg leading-none"
                [attr.aria-label]="g('action.close')"
                (click)="cancel()"
              >×</button>
            </header>

            <div
              class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
              role="group"
              [attr.aria-label]="t('crop.aspectLabel')"
            >
              @for (opt of aspectOptions(); track opt.value) {
                <button
                  type="button"
                  class="rounded-md border px-3 py-1.5 text-sm font-medium"
                  [class.border-accent-ring]="aspect() === opt.value"
                  [class.bg-accent-soft]="aspect() === opt.value"
                  [class.text-accent-soft-foreground]="aspect() === opt.value"
                  [class.border-border]="aspect() !== opt.value"
                  [class.text-foreground-muted]="aspect() !== opt.value"
                  [attr.aria-pressed]="aspect() === opt.value"
                  (click)="setAspect(opt.value)"
                >{{ opt.label }}</button>
              }
            </div>

            <p class="m-0 px-4 pt-3 text-xs text-foreground-faint">{{ t('crop.instructions') }}</p>

            @if (cropError(); as e) {
              <p class="m-0 px-4 pt-2 text-sm text-danger-foreground">{{ e }}</p>
            }

            <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
              @if (objectUrl(); as src) {
                <div #stage class="crop-stage">
                  <img
                    [src]="src"
                    alt=""
                    draggable="false"
                    class="crop-image"
                    (load)="onImageLoad($event)"
                  />
                  @if (cropRect(); as rect) {
                    <div
                      #rectEl
                      class="crop-rect"
                      tabindex="0"
                      role="group"
                      [attr.aria-label]="t('crop.areaLabel')"
                      [style.left.%]="pct().x"
                      [style.top.%]="pct().y"
                      [style.width.%]="pct().w"
                      [style.height.%]="pct().h"
                      (pointerdown)="onPointerDown($event)"
                      (pointermove)="onPointerMove($event)"
                      (pointerup)="onPointerUp($event)"
                      (pointercancel)="onPointerUp($event)"
                      (keydown)="onKeydown($event)"
                    >
                      <span class="crop-handle crop-handle-nw" aria-hidden="true" (pointerdown)="armResize('nw')"></span>
                      <span class="crop-handle crop-handle-ne" aria-hidden="true" (pointerdown)="armResize('ne')"></span>
                      <span class="crop-handle crop-handle-sw" aria-hidden="true" (pointerdown)="armResize('sw')"></span>
                      <span class="crop-handle crop-handle-se" aria-hidden="true" (pointerdown)="armResize('se')"></span>
                    </div>
                  }
                </div>
              }
            </div>

            <p class="sr-only" aria-live="polite">{{ announcement() }}</p>

            <footer class="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button uiGhost type="button" (click)="cancel()">{{ g('action.cancel') }}</button>
              <button uiSecondary type="button" (click)="useFullImage()">{{ t('crop.useFullImage') }}</button>
              <button
                uiPrimary
                type="button"
                [loading]="processing()"
                [disabled]="!cropRect()"
                (click)="confirm()"
              >{{ t('crop.confirm') }}</button>
            </footer>
          </div>
        </dialog>
      </ng-container>
    </ng-container>
  `,
  styles: `
    .crop-stage {
      position: relative;
      line-height: 0;
      overflow: hidden;
      max-width: 100%;
    }
    .crop-image {
      display: block;
      max-width: 100%;
      max-height: 60vh;
      width: auto;
      height: auto;
      user-select: none;
      -webkit-user-drag: none;
    }
    .crop-rect {
      position: absolute;
      box-sizing: border-box;
      border: 2px solid var(--color-accent);
      box-shadow: 0 0 0 100vmax rgb(0 0 0 / 0.55);
      cursor: move;
      touch-action: none;
    }
    .crop-rect:focus-visible {
      outline: 2px solid var(--color-accent-ring);
      outline-offset: 2px;
    }
    .crop-handle {
      position: absolute;
      width: 14px;
      height: 14px;
      box-sizing: border-box;
      background: var(--color-accent);
      border: 2px solid var(--color-surface);
      touch-action: none;
    }
    .crop-handle-nw { top: -8px; left: -8px; cursor: nwse-resize; }
    .crop-handle-ne { top: -8px; right: -8px; cursor: nesw-resize; }
    .crop-handle-sw { bottom: -8px; left: -8px; cursor: nesw-resize; }
    .crop-handle-se { bottom: -8px; right: -8px; cursor: nwse-resize; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageCropDialogComponent {
  readonly confirmed = output<File>();
  readonly cancelled = output<void>();

  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly rectEl = viewChild<ElementRef<HTMLElement>>('rectEl');

  protected readonly objectUrl = signal<string | null>(null);
  protected readonly sourceSize = signal<{ w: number; h: number } | null>(null);
  protected readonly cropRect = signal<CropRect | null>(null);
  protected readonly aspect = signal<CropAspect>('free');
  protected readonly processing = signal(false);
  protected readonly cropError = signal<string | null>(null);
  protected readonly announcement = signal('');

  private file: File | null = null;
  private minSourceWidth: number | undefined;
  private pendingCorner: CropCorner | null = null;
  private drag: DragState | null = null;
  private settled = false;

  protected readonly pct = computed(() => {
    const rect = this.cropRect();
    const size = this.sourceSize();
    if (!rect || !size) return { x: 0, y: 0, w: 0, h: 0 };
    return {
      x: (rect.x / size.w) * 100,
      y: (rect.y / size.h) * 100,
      w: (rect.w / size.w) * 100,
      h: (rect.h / size.h) * 100,
    };
  });

  protected readonly aspectOptions = computed(() => {
    this.activeLang();
    return ASPECTS.map((value) => ({
      value,
      label: value === 'free' ? this.transloco.translate('media.crop.free') : value,
    }));
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeUrl());
  }

  open(file: File, opts: CropOpenOptions): void {
    this.file = file;
    this.minSourceWidth = opts.minSourceWidth;
    this.aspect.set(opts.aspect);
    this.sourceSize.set(null);
    this.cropRect.set(null);
    this.processing.set(false);
    this.cropError.set(null);
    this.announcement.set('');
    this.settled = false;
    this.drag = null;
    this.pendingCorner = null;
    this.revokeUrl();
    this.objectUrl.set(URL.createObjectURL(file));
    this.dialog().nativeElement.showModal();
  }

  private clampOpts(): ClampOptions {
    return { aspect: this.aspect(), minWidth: this.minSourceWidth };
  }

  protected onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    const size = { w: img.naturalWidth, h: img.naturalHeight };
    if (!size.w || !size.h) return;
    this.sourceSize.set(size);
    this.cropRect.set(initialCropRect(size, this.clampOpts()));
    this.announce();
    setTimeout(() => this.rectEl()?.nativeElement.focus(), 0);
  }

  protected setAspect(value: CropAspect): void {
    this.aspect.set(value);
    const rect = this.cropRect();
    const size = this.sourceSize();
    if (rect && size) {
      this.cropRect.set(clampCropRect(rect, size, this.clampOpts()));
      this.announce();
    }
  }

  protected armResize(corner: CropCorner): void {
    this.pendingCorner = corner;
  }

  protected onPointerDown(event: PointerEvent): void {
    const size = this.sourceSize();
    const rect = this.cropRect();
    const stage = this.stage()?.nativeElement.getBoundingClientRect();
    if (!size || !rect || !stage) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    // preventDefault above suppresses the implicit focus — restore it so a
    // mouse user can immediately nudge the crop with the keyboard.
    target.focus();
    this.drag = {
      corner: this.pendingCorner,
      startRect: rect,
      startX: event.clientX,
      startY: event.clientY,
      stageW: stage.width,
      stageH: stage.height,
    };
    this.pendingCorner = null;
  }

  protected onPointerMove(event: PointerEvent): void {
    const d = this.drag;
    const size = this.sourceSize();
    if (!d || !size) return;
    const dx = ((event.clientX - d.startX) * size.w) / d.stageW;
    const dy = ((event.clientY - d.startY) * size.h) / d.stageH;
    const opts = this.clampOpts();
    this.cropRect.set(
      d.corner
        ? resizeCropRect(d.startRect, d.corner, dx, dy, size, opts)
        : moveCropRect(d.startRect, dx, dy, size),
    );
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.drag) return;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    this.drag = null;
    this.announce();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const size = this.sourceSize();
    const rect = this.cropRect();
    if (!size || !rect) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.confirm();
      return;
    }
    const step = Math.max(1, Math.round(Math.min(size.w, size.h) * 0.02));
    const opts = this.clampOpts();
    let next: CropRect | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        next = event.shiftKey
          ? resizeCropRect(rect, 'se', -step, 0, size, opts)
          : moveCropRect(rect, -step, 0, size);
        break;
      case 'ArrowRight':
        next = event.shiftKey
          ? resizeCropRect(rect, 'se', step, 0, size, opts)
          : moveCropRect(rect, step, 0, size);
        break;
      case 'ArrowUp':
        next = event.shiftKey
          ? resizeCropRect(rect, 'se', 0, -step, size, opts)
          : moveCropRect(rect, 0, -step, size);
        break;
      case 'ArrowDown':
        next = event.shiftKey
          ? resizeCropRect(rect, 'se', 0, step, size, opts)
          : moveCropRect(rect, 0, step, size);
        break;
      default:
        return;
    }
    event.preventDefault();
    this.cropRect.set(next);
    this.announce();
  }

  private announce(): void {
    const rect = this.cropRect();
    if (!rect) return;
    this.announcement.set(
      this.transloco.translate('media.crop.dimensions', { width: rect.w, height: rect.h }),
    );
  }

  protected async confirm(): Promise<void> {
    const rect = this.cropRect();
    if (!rect || !this.file || this.processing()) return;
    this.processing.set(true);
    this.cropError.set(null);
    try {
      const cropped = await cropFileToFile(this.file, rect);
      this.settled = true;
      this.close();
      this.confirmed.emit(cropped);
    } catch (err) {
      this.processing.set(false);
      this.cropError.set(err instanceof Error ? err.message : String(err));
    }
  }

  protected useFullImage(): void {
    if (!this.file) return;
    this.settled = true;
    const file = this.file;
    this.close();
    this.confirmed.emit(file);
  }

  protected cancel(): void {
    this.close();
  }

  private close(): void {
    this.dialog().nativeElement.close();
  }

  protected onNativeClose(): void {
    if (!this.settled) this.cancelled.emit();
    this.settled = false;
    this.revokeUrl();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  private revokeUrl(): void {
    const url = this.objectUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.objectUrl.set(null);
    }
  }
}
