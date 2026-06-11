import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { GhostButtonComponent } from '@shared/ui';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';

export interface BackOption {
  key: string;
  label: string;
  link: readonly [string, string];
  queryParams?: Record<string, string>;
  highlighted?: boolean;
}

/**
 * Unified Back control. Within-story history wins (plain button →
 * `back` output); at an entry scene the cross-entity options take
 * over: one option renders as a direct link, several open a small
 * popup with the session referrer on top. No options → disabled.
 */
@Component({
  selector: 'app-reader-back-menu',
  imports: [RouterLink, GhostButtonComponent, TranslocoDirective],
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
      @if (canGoBack()) {
        <button uiGhost type="button" (click)="back.emit()">{{ t('action.back') }}</button>
      } @else if (single(); as option) {
        <a
          uiGhost
          [routerLink]="option.link"
          [queryParams]="option.queryParams ?? null"
          [attr.aria-label]="t('aria.backTo', { title: option.label })"
          (click)="navigated.emit(option)"
        >
          {{ t('action.back') }}
        </a>
      } @else if (options().length > 1) {
        <div class="relative">
          <button
            uiGhost
            type="button"
            aria-haspopup="menu"
            [attr.aria-expanded]="open()"
            (click)="open.set(!open())"
            (keydown.escape)="open.set(false)"
          >
            {{ t('action.back') }}
          </button>
          @if (open()) {
            <div
              class="absolute right-0 top-full z-50 mt-1 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-lg"
              role="menu"
              [attr.aria-label]="t('aria.backMenu')"
            >
              @for (option of options(); track option.key) {
                <a
                  class="block truncate rounded px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised focus-visible:bg-surface-raised"
                  [class.font-semibold]="option.highlighted"
                  role="menuitem"
                  [routerLink]="option.link"
                  [queryParams]="option.queryParams ?? null"
                  (click)="onPick(option)"
                  (keydown.escape)="open.set(false)"
                >
                  {{ option.label }}
                </a>
              }
            </div>
          }
        </div>
      } @else {
        <button uiGhost type="button" [disabled]="true">{{ t('action.back') }}</button>
      }
    </ng-container>
  `,
  host: { '(document:click)': 'onDocumentClick($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderBackMenuComponent {
  readonly canGoBack = input.required<boolean>();
  readonly options = input<BackOption[]>([]);

  readonly back = output<void>();
  readonly navigated = output<BackOption>();

  protected readonly open = signal(false);
  protected readonly single = computed<BackOption | null>(() => {
    const opts = this.options();
    return opts.length === 1 ? opts[0] : null;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected onPick(option: BackOption): void {
    this.open.set(false);
    this.navigated.emit(option);
  }

  protected onDocumentClick(event: Event): void {
    if (!this.open()) return;
    if (event.target instanceof Node && this.host.nativeElement.contains(event.target)) return;
    this.open.set(false);
  }
}
