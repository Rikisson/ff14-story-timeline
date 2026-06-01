import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslocoDirective } from '@jsverse/transloco';

interface ArchiveSection {
  path: string;
  labelKey: string;
}

const ARCHIVE_SECTIONS: readonly ArchiveSection[] = [
  { path: '/stories', labelKey: 'nav.stories' },
  { path: '/events', labelKey: 'nav.events' },
  { path: '/plotlines', labelKey: 'nav.plotlines' },
  { path: '/characters', labelKey: 'nav.characters' },
  { path: '/places', labelKey: 'nav.places' },
  { path: '/codex', labelKey: 'nav.codex' },
];

@Component({
  selector: 'app-archives-selector',
  imports: [TranslocoDirective],
  host: {
    class: 'relative inline-block',
    '(keydown)': 'onKeydown($event)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <button
        #trigger
        type="button"
        class="inline-flex max-w-full items-center gap-1.5 rounded-md text-foreground transition-colors hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="t('tooltip.archivesSwitcher', { name: t(activeSection().labelKey) })"
        (click)="toggle()"
      >
        <span class="truncate">{{ t(activeSection().labelKey) }}</span>
        <svg
          class="size-6 shrink-0 text-foreground-faint"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      @if (open()) {
        <div class="fixed inset-0 z-30" aria-hidden="true" (click)="dismiss()"></div>
        <div
          role="menu"
          [attr.aria-label]="t('nav.archives')"
          class="absolute left-0 top-full z-40 mt-2 min-w-[12rem] rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          @for (section of sections; track section.path) {
            <button
              #item
              type="button"
              role="menuitemradio"
              tabindex="-1"
              [attr.aria-checked]="section.path === activeSection().path"
              class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-sans text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
              (click)="select(section.path)"
            >
              <span class="grid size-4 shrink-0 place-items-center text-accent" aria-hidden="true">
                @if (section.path === activeSection().path) {
                  <svg
                    class="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                }
              </span>
              <span class="min-w-0 flex-1 truncate">{{ t(section.labelKey) }}</span>
            </button>
          }
        </div>
      }
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivesSelectorComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly sections = ARCHIVE_SECTIONS;

  protected readonly activeSection = computed(
    () => this.sections.find((s) => this.url().startsWith(s.path)) ?? this.sections[0],
  );

  protected readonly open = signal(false);
  private readonly focusedIndex = signal(0);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly items = viewChildren<ElementRef<HTMLButtonElement>>('item');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.items()[this.focusedIndex()]?.nativeElement.focus();
    });
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.openMenu();
    }
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  protected dismiss(): void {
    this.open.set(false);
  }

  protected onFocusOut(event: FocusEvent): void {
    if (!this.open()) return;
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    this.dismiss();
  }

  protected select(path: string): void {
    this.open.set(false);
    void this.router.navigate([path]);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.openMenu();
      }
      return;
    }

    const last = this.sections.length - 1;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.focusedIndex.update((i) => (i === last ? 0 : i + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusedIndex.update((i) => (i === 0 ? last : i - 1));
        break;
      case 'Home':
        event.preventDefault();
        this.focusedIndex.set(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusedIndex.set(last);
        break;
    }
  }

  private openMenu(): void {
    this.focusedIndex.set(this.sections.findIndex((s) => s.path === this.activeSection().path));
    this.open.set(true);
  }
}
