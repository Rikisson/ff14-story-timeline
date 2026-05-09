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
import { AuthStore } from '@features/auth';
import {
  DangerButtonComponent,
  GhostButtonComponent,
  PrimaryButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { AssetDoc, AssetKind, AUDIO_ASSET_KINDS } from '../data-access/asset.types';
import { MediaAssetsService } from '../data-access/media-assets.service';

@Component({
  selector: 'app-asset-picker',
  imports: [
    NgOptimizedImage,
    DangerButtonComponent,
    GhostButtonComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
  ],
  template: `
    <dialog
      #dialog
      class="rounded-lg p-0 backdrop:bg-slate-900/40 dark:bg-slate-900 dark:text-slate-100"
      [attr.aria-label]="title()"
      (close)="onDialogClose()"
      (click)="onBackdropClick($event)"
    >
      <div class="flex max-h-[80vh] w-[min(48rem,92vw)] flex-col">
        <header class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 class="m-0 text-base font-semibold text-foreground">{{ title() }}</h3>
          <button
            uiGhost
            type="button"
            class="h-8 w-8 p-0 text-lg leading-none"
            aria-label="Close"
            (click)="cancel()"
          >×</button>
        </header>

        <div class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <input
            type="text"
            class="flex-1 rounded-md border border-border-strong bg-surface text-foreground dark:placeholder:text-slate-500 px-3 py-1.5 text-sm"
            placeholder="Filter by tag…"
            [value]="tagFilter()"
            (input)="onTagInput($event)"
          />
          <button
            uiSecondary
            type="button"
            [loading]="uploading()"
            (click)="fileInput.click()"
          >+ Upload</button>
          <input
            #fileInput
            type="file"
            class="hidden"
            [accept]="acceptAttr()"
            (change)="onPick($event)"
          />
        </div>

        @if (uploadError(); as e) {
          <p class="m-0 px-4 py-2 text-sm text-red-700 dark:text-red-400">{{ e }}</p>
        }

        <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          @if (visible().length === 0) {
            <p class="m-0 py-8 text-center text-sm italic text-foreground-faint">
              @if (allForKind().length === 0) {
                No {{ kind() }} assets yet. Upload one to get started.
              } @else {
                No assets match the current tag filter.
              }
            </p>
          } @else if (isAudio()) {
            <ul class="m-0 flex list-none flex-col gap-2 p-0">
              @for (a of visible(); track a.id) {
                <li
                  class="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center"
                  [class.border-indigo-500]="isSelected(a.id)"
                  [class.bg-indigo-50]="isSelected(a.id)"
                  [class.dark:bg-indigo-950/60]="isSelected(a.id)"
                  [class.border-border]="!isSelected(a.id)"
                >
                  <button
                    type="button"
                    class="text-left text-sm font-medium text-foreground hover:underline"
                    (click)="toggle(a.id)"
                  >{{ a.label }}</button>
                  <audio class="ml-auto" controls preload="none" [src]="a.url"></audio>
                  <div class="flex shrink-0 gap-2">
                    <button uiGhost type="button" (click)="renamePrompt(a)">Rename</button>
                    <button uiDanger type="button" (click)="confirmDelete(a)">Delete</button>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <ul class="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
              @for (a of visible(); track a.id) {
                <li
                  class="flex flex-col gap-2 overflow-hidden rounded-md border bg-surface"
                  [class.border-indigo-500]="isSelected(a.id)"
                  [class.ring-2]="isSelected(a.id)"
                  [class.ring-indigo-300]="isSelected(a.id)"
                  [class.border-border]="!isSelected(a.id)"
                >
                  <button
                    type="button"
                    class="relative aspect-square w-full overflow-hidden bg-surface-muted"
                    [attr.aria-label]="'Select ' + a.label"
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
                        class="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow"
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
                      >Rename</button>
                      <button
                        uiDanger
                        type="button"
                        class="flex-1 px-1 py-0.5 text-xs"
                        (click)="confirmDelete(a)"
                      >Delete</button>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        </div>

        <footer class="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button uiGhost type="button" (click)="cancel()">Cancel</button>
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetPickerComponent {
  readonly kind = input.required<AssetKind>();
  readonly multiSelect = input<boolean>(false);
  readonly currentSelection = input<string[]>([]);
  readonly title = input<string>('Pick asset');

  readonly picked = output<string[]>();

  private readonly media = inject(MediaAssetsService);
  private readonly auth = inject(AuthStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly selection = signal<string[]>([]);
  protected readonly tagFilter = signal<string>('');
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);

  protected readonly isAudio = computed(() => AUDIO_ASSET_KINDS.includes(this.kind()));

  protected readonly acceptAttr = computed(() => (this.isAudio() ? 'audio/*' : 'image/webp'));

  protected readonly allForKind = computed(() =>
    this.media.assets().filter((a) => a.kind === this.kind()),
  );

  protected readonly visible = computed(() => {
    const tag = this.tagFilter().trim().toLowerCase();
    if (!tag) return this.allForKind();
    return this.allForKind().filter((a) =>
      (a.tags ?? []).some((t) => t.toLowerCase().includes(tag)),
    );
  });

  protected readonly confirmLabel = computed(() => {
    const n = this.selection().length;
    if (!this.multiSelect()) return 'Use this asset';
    if (n === 0) return 'Pick at least one';
    if (n === 1) return 'Use 1 asset';
    return `Use ${n} assets`;
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
  }

  close(): void {
    this.dialog().nativeElement.close();
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

  protected async onPick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const uid = this.auth.user()?.uid;
    if (!uid) {
      this.uploadError.set('Sign in to upload.');
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
    } catch (err) {
      this.uploadError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async renamePrompt(asset: AssetDoc): Promise<void> {
    const next = window.prompt('Rename asset', asset.label);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === asset.label) return;
    try {
      await this.media.rename(asset.id, trimmed);
    } catch (err) {
      this.uploadError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }

  protected async confirmDelete(asset: AssetDoc): Promise<void> {
    if (!window.confirm(`Delete "${asset.label}" from the library? This cannot be undone.`)) {
      return;
    }
    try {
      await this.media.delete(asset);
      this.selection.update((curr) => curr.filter((x) => x !== asset.id));
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
