import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { EntityKind } from '@shared/models';
import { PrimaryButtonComponent } from '@shared/ui';
import { ARCHIVE_ENTITY_KINDS } from '../data-access/archive-format';
import { UniverseExportService } from '../data-access/universe-export.service';

@Component({
  selector: 'app-universe-export-panel',
  imports: [TranslocoDirective, PrimaryButtonComponent],
  template: `
    <ng-container *transloco="let t; prefix: 'universeTransfer'">
      <section class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div>
          <h2 class="m-0 text-lg font-semibold text-foreground">{{ t('field.exportHeader') }}</h2>
          <p class="m-0 mt-0.5 text-sm text-foreground-subtle">{{ t('message.exportSubtitle') }}</p>
        </div>

        <div class="flex flex-wrap gap-x-4 gap-y-2">
          @for (kind of kinds; track kind) {
            <label class="flex items-center gap-1.5 text-sm text-foreground-muted">
              <input type="checkbox" [checked]="selected().has(kind)" (change)="toggle(kind)" />
              {{ t('enum.' + kind) }}
            </label>
          }
        </div>

        <label class="flex items-center gap-1.5 text-sm text-foreground-muted">
          <input
            type="checkbox"
            [checked]="includeMedia()"
            (change)="includeMedia.set(!includeMedia())"
          />
          {{ t('field.includeMedia') }}
        </label>

        <div class="flex flex-wrap items-center gap-3">
          <button
            uiPrimary
            type="button"
            [loading]="busy()"
            [disabled]="busy() || selected().size === 0"
            (click)="onExport()"
          >
            {{ t('action.export') }}
          </button>

          @if (progress().phase === 'downloading' || progress().phase === 'packing') {
            <span class="text-sm text-foreground-subtle">
              {{
                t('message.exporting', {
                  done: progress().assetsDone,
                  total: progress().assetsTotal,
                })
              }}
            </span>
          }
          @if (progress().phase === 'done') {
            @if (progress().assetsFailed > 0) {
              <span class="text-sm text-warning-foreground">
                {{ t('message.exportPartial', { failed: progress().assetsFailed }) }}
              </span>
            } @else {
              <span class="text-sm text-success-foreground">{{ t('message.exportDone') }}</span>
            }
          }
        </div>

        @if (progress().phase === 'error') {
          <p class="m-0 text-sm text-danger-foreground">
            {{ t('message.exportFailed', { error: progress().error }) }}
          </p>
        }
      </section>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseExportPanelComponent {
  private readonly exportService = inject(UniverseExportService);

  protected readonly kinds = ARCHIVE_ENTITY_KINDS;
  protected readonly progress = this.exportService.progress;
  protected readonly selected = signal(new Set<EntityKind>(ARCHIVE_ENTITY_KINDS));
  protected readonly includeMedia = signal(true);

  protected readonly busy = computed(() => {
    const phase = this.progress().phase;
    return phase === 'reading' || phase === 'downloading' || phase === 'packing';
  });

  protected toggle(kind: EntityKind): void {
    const next = new Set(this.selected());
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    this.selected.set(next);
  }

  protected async onExport(): Promise<void> {
    const selected = this.selected();
    const full = selected.size === ARCHIVE_ENTITY_KINDS.length;
    try {
      await this.exportService.exportUniverse({
        kinds: full ? undefined : [...selected],
        includeAssets: this.includeMedia(),
      });
    } catch {
      // The export service's progress signal already carries the failure.
    }
  }
}
