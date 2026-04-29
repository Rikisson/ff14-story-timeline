import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@features/auth';
import { SlugTakenError, UniversesService } from '../data-access/universes.service';
import { UniverseStore } from '../data-access/universe.store';
import { UniverseDraft } from '../data-access/universe.types';
import { UniverseFormComponent } from './universe-form.component';

@Component({
  selector: 'app-universe-selector',
  imports: [UniverseFormComponent],
  template: `
    <div class="relative">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-lg font-semibold text-slate-900 hover:bg-slate-100"
        [attr.aria-haspopup]="'menu'"
        [attr.aria-expanded]="open()"
        aria-label="Switch universe"
        (click)="toggle()"
      >
        <span>{{ label() }}</span>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="5 8 10 13 15 8" />
        </svg>
      </button>

      @if (open()) {
        <div
          role="menu"
          class="absolute left-0 top-full z-10 mt-1 min-w-[260px] rounded-md border border-slate-200 bg-white shadow-lg"
        >
          @if (universes().length === 0) {
            <p class="m-0 p-3 text-sm text-slate-600">No universes yet.</p>
          } @else {
            <ul class="m-0 max-h-72 list-none overflow-y-auto p-1">
              @for (u of universes(); track u.id) {
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                    [class.font-semibold]="u.id === activeId()"
                    [class.text-blue-700]="u.id === activeId()"
                    (click)="select(u.id)"
                  >
                    <span class="truncate">{{ u.name }}</span>
                    @if (u.id === activeId()) {
                      <span class="shrink-0 text-xs">Active</span>
                    }
                  </button>
                </li>
              }
            </ul>
          }
          @if (canCreate()) {
            <div class="border-t border-slate-200 p-1">
              <button
                type="button"
                role="menuitem"
                class="block w-full rounded px-2 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                (click)="openCreate()"
              >+ Create universe</button>
            </div>
          }
        </div>
      }
    </div>

    <dialog
      #createDialog
      class="rounded-lg p-0 backdrop:bg-slate-900/40"
      aria-label="Create universe"
      (close)="onDialogClose()"
      (click)="onDialogBackdropClick($event)"
    >
      <div class="w-[min(28rem,90vw)] p-2">
        <app-universe-form
          [busy]="busy()"
          [errorMessage]="errorMessage()"
          (submitted)="onSubmit($event)"
          (cancelled)="closeCreate()"
        />
      </div>
    </dialog>
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseSelectorComponent {
  private readonly store = inject(UniverseStore);
  private readonly service = inject(UniversesService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly createDialog = viewChild.required<ElementRef<HTMLDialogElement>>('createDialog');

  protected readonly universes = this.store.universes;
  protected readonly activeId = this.store.activeUniverseId;
  protected readonly canCreate = this.store.canCreateUniverse;
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly label = computed(() => {
    const u = this.store.activeUniverse();
    return u?.name ?? 'Universes';
  });

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected select(id: string): void {
    this.store.setActive(id);
    this.close();
    void this.router.navigate(['/']);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected openCreate(): void {
    this.close();
    this.errorMessage.set(null);
    this.createDialog().nativeElement.showModal();
  }

  protected closeCreate(): void {
    this.createDialog().nativeElement.close();
  }

  protected onDialogClose(): void {
    this.errorMessage.set(null);
    this.busy.set(false);
  }

  protected onDialogBackdropClick(event: MouseEvent): void {
    if (event.target === this.createDialog().nativeElement) {
      this.closeCreate();
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as Node;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  protected async onSubmit(draft: UniverseDraft): Promise<void> {
    const u = this.auth.user();
    if (!u) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const id = await this.service.create(draft, u.uid);
      await this.store.refresh();
      this.store.setActive(id);
      this.closeCreate();
      await this.router.navigate(['/']);
    } catch (err) {
      if (err instanceof SlugTakenError) {
        this.errorMessage.set(err.message);
      } else {
        this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      }
    } finally {
      this.busy.set(false);
    }
  }
}
