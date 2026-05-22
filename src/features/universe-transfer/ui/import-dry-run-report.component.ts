import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { DryRunReport } from '../data-access/dry-run-report.types';

@Component({
  selector: 'app-import-dry-run-report',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t; prefix: 'universeTransfer'">
      <div class="flex flex-col gap-3">
        <div
          class="rounded-md border p-3"
          [class.border-success-border]="report().ok"
          [class.bg-success]="report().ok"
          [class.border-danger-border]="!report().ok"
          [class.bg-danger]="!report().ok"
        >
          <p
            class="m-0 text-sm font-semibold"
            [class.text-success-foreground]="report().ok"
            [class.text-danger-foreground]="!report().ok"
          >
            @if (report().ok) {
              {{ t('message.reportReady') }}
            } @else {
              {{ t('message.reportBlocked', { count: report().errors.length }) }}
            }
          </p>
          @if (report().sourceUniverseName; as name) {
            <p class="m-0 mt-0.5 text-xs text-foreground-subtle">
              {{ t('message.packageSource', { name }) }}
            </p>
          }
        </div>

        <div class="flex flex-col gap-1">
          <h3 class="m-0 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            {{ t('report.countsHeader') }}
          </h3>
          @for (kind of report().kinds; track kind.kind) {
            @if (kind.incoming > 0) {
              <p class="m-0 text-sm text-foreground-muted">
                {{ kind.incoming }} {{ t('enum.' + kind.kind) }}
                @if (kind.collisions > 0) {
                  <span class="text-foreground-faint">
                    — {{ t('message.collisionNote', { count: kind.collisions }) }}
                  </span>
                }
              </p>
            }
          }
          @if (report().assets.total > 0) {
            <p class="m-0 text-sm text-foreground-muted">
              {{
                t('message.assetsLine', {
                  withBinary: report().assets.withBinary,
                  total: report().assets.total,
                  size: sizeLabel(),
                })
              }}
            </p>
          }
        </div>

        @if (report().config.applyCalendar || report().config.newCategoryKeys.length > 0) {
          <div class="flex flex-col gap-1">
            <h3 class="m-0 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              {{ t('report.configHeader') }}
            </h3>
            @if (report().config.applyCalendar) {
              <p class="m-0 text-sm text-foreground-muted">
                {{ t('message.calendarApply', { count: report().config.packageCalendarEras }) }}
              </p>
            }
            @if (report().config.newCategoryKeys.length > 0) {
              <p class="m-0 text-sm text-foreground-muted">
                {{ t('message.categoriesNew', { count: report().config.newCategoryKeys.length }) }}
              </p>
            }
          </div>
        }

        @if (report().errors.length > 0) {
          <div class="flex flex-col gap-1.5">
            <h3 class="m-0 text-xs font-semibold uppercase tracking-wide text-danger-foreground">
              {{ t('report.errorsHeader') }}
            </h3>
            @for (issue of report().errors; track $index) {
              <div class="rounded border border-danger-border bg-danger px-2 py-1.5">
                <p class="m-0 text-sm text-danger-foreground">{{ issue.message }}</p>
                @if (issue.hint; as hint) {
                  <p class="m-0 mt-0.5 text-xs text-foreground-subtle">{{ hint }}</p>
                }
                <p class="m-0 mt-0.5 text-xs text-foreground-faint">{{ issue.path }}</p>
              </div>
            }
          </div>
        }

        @if (report().warnings.length > 0) {
          <details class="flex flex-col gap-1.5">
            <summary
              class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-warning-foreground"
            >
              {{ t('report.warningsHeader') }} ({{ report().warnings.length }})
            </summary>
            <div class="mt-1.5 flex flex-col gap-1.5">
              @for (issue of report().warnings; track $index) {
                <div class="rounded border border-warning-border bg-warning px-2 py-1.5">
                  <p class="m-0 text-sm text-foreground-muted">{{ issue.message }}</p>
                  @if (issue.hint; as hint) {
                    <p class="m-0 mt-0.5 text-xs text-foreground-subtle">{{ hint }}</p>
                  }
                </div>
              }
            </div>
          </details>
        }
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportDryRunReportComponent {
  readonly report = input.required<DryRunReport>();

  protected readonly sizeLabel = computed(() => formatBytes(this.report().assets.totalBytes));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
