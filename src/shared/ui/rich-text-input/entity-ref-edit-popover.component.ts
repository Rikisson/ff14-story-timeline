import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  afterNextRender,
  Signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { EntityResolverCache, ResolvedDirectoryRow } from '@shared/data-access';
import { EntityKind } from '@shared/models';
import { ENTITY_KIND_LABEL } from '../entity-ref/entity-ref-hover.service';

@Component({
  selector: 'app-entity-ref-edit-popover',
  imports: [FormsModule, TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <div
        role="dialog"
        [attr.aria-label]="t('tooltip.tiptapEditRef')"
        class="pointer-events-auto flex w-72 flex-col gap-2 rounded-md border border-border bg-surface p-3 text-sm shadow-lg"
        (keydown)="onKeydown($event)"
      >
        <p class="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-foreground-faint">
          {{ kindLabel() }}
        </p>
        <label class="flex flex-col gap-1 text-xs text-foreground-muted">
          {{ t('field.label') }}
          <input
            #input
            type="text"
            class="rounded border border-border-strong bg-surface-strong px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent-ring"
            [(ngModel)]="draft"
            [attr.aria-label]="t('field.label')"
          />
        </label>
        <div class="flex items-center justify-between gap-2">
          <button
            type="button"
            class="text-xs text-foreground-faint underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:text-foreground-faint/50 disabled:no-underline"
            [disabled]="!canReset()"
            (click)="resetToEntityName()"
          >
            {{ t('action.tiptapResetLabel') }}
          </button>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded px-2 py-1 text-xs text-foreground-muted hover:bg-surface-muted"
              (click)="cancel.emit()"
            >
              {{ t('action.cancel') }}
            </button>
            <button
              type="button"
              class="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-foreground hover:bg-accent-strong"
              (click)="commit()"
            >
              {{ t('action.save') }}
            </button>
          </div>
        </div>
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityRefEditPopoverComponent {
  readonly kind = input.required<EntityKind>();
  readonly id = input.required<string>();
  readonly initialDisplayText = input.required<string>();

  readonly save = output<string>();
  readonly cancel = output<void>();

  private readonly resolver = inject(EntityResolverCache);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly draft = signal<string>('');

  private readonly resolved: Signal<ResolvedDirectoryRow | null> = computed(() =>
    this.resolver.resolve({ kind: this.kind(), id: this.id() })(),
  );

  protected readonly kindLabel = computed(() => ENTITY_KIND_LABEL[this.kind()]);

  protected readonly canReset = computed(() => {
    const row = this.resolved();
    if (!row?.label) return false;
    return row.label !== this.draft();
  });

  constructor() {
    afterNextRender(() => {
      this.draft.set(this.initialDisplayText());
      const el = this.inputRef().nativeElement;
      el.focus();
      el.select();
    });
  }

  protected resetToEntityName(): void {
    const row = this.resolved();
    if (!row?.label) return;
    this.draft.set(row.label);
    const el = this.inputRef().nativeElement;
    el.focus();
    el.select();
  }

  protected commit(): void {
    const next = this.draft().trim();
    if (!next) return;
    this.save.emit(next);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      this.commit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel.emit();
    }
  }
}
