import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { EntityKind } from '@shared/models';
import { PrimaryButtonComponent } from '@shared/ui';
import { ConflictResolution, ImportResult } from '../data-access/dry-run-report.types';
import { DryRunResult, UniverseImportService } from '../data-access/universe-import.service';
import { ImportDryRunReportComponent } from './import-dry-run-report.component';
import { MigrationKitCardComponent } from './migration-kit-card.component';

@Component({
  selector: 'app-universe-import-panel',
  imports: [
    TranslocoDirective,
    PrimaryButtonComponent,
    MigrationKitCardComponent,
    ImportDryRunReportComponent,
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'universeTransfer'">
      <section class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div>
          <h2 class="m-0 text-lg font-semibold text-foreground">{{ t('field.importHeader') }}</h2>
          <p class="m-0 mt-0.5 text-sm text-foreground-subtle">{{ t('message.importSubtitle') }}</p>
        </div>

        <app-migration-kit-card />

        <div class="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".universe,.zip,.json"
            [disabled]="committing()"
            [attr.aria-label]="t('field.chooseFile')"
            (change)="onFileChange($event)"
            class="text-sm text-foreground-muted file:mr-3 file:rounded-md file:border file:border-border-strong file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
          <button
            uiPrimary
            type="button"
            [loading]="validating()"
            [disabled]="!file() || validating() || committing()"
            (click)="validate()"
          >
            {{ t('action.validate') }}
          </button>
        </div>

        @if (error(); as message) {
          <p class="m-0 text-sm text-danger-foreground">
            {{ t('message.readError', { error: message }) }}
          </p>
        }

        @if (result(); as dryRun) {
          <app-import-dry-run-report [report]="dryRun.report" />

          @if (importResult(); as outcome) {
            <div class="flex flex-col gap-1 rounded-md border border-success-border bg-success p-3">
              <p class="m-0 text-sm font-semibold text-success-foreground">
                {{ t('message.importComplete') }}
              </p>
              <p class="m-0 text-sm text-foreground-muted">
                {{
                  t('message.importCounts', {
                    created: outcome.created,
                    renamed: outcome.renamed.length,
                    skipped: outcome.skipped,
                  })
                }}
              </p>
              @if (outcome.assetsUploaded > 0) {
                <p class="m-0 text-sm text-foreground-muted">
                  {{ t('message.importMedia', { uploaded: outcome.assetsUploaded }) }}
                </p>
              }
              @if (outcome.failed > 0) {
                <p class="m-0 text-sm text-warning-foreground">
                  {{ t('message.importFailed', { failed: outcome.failed }) }}
                </p>
              }
            </div>
          } @else if (dryRun.report.ok) {
            @if (totalCollisions() > 0) {
              <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
                <legend class="mb-1 p-0 text-sm font-medium text-foreground-muted">
                  {{ t('field.onConflict') }}
                </legend>
                <label class="flex items-center gap-1.5 text-sm text-foreground-muted">
                  <input
                    type="radio"
                    name="conflictPolicy"
                    [checked]="conflictPolicy() === 'rename'"
                    (change)="conflictPolicy.set('rename')"
                  />
                  {{ t('action.conflictRename') }}
                </label>
                <label class="flex items-center gap-1.5 text-sm text-foreground-muted">
                  <input
                    type="radio"
                    name="conflictPolicy"
                    [checked]="conflictPolicy() === 'skip'"
                    (change)="conflictPolicy.set('skip')"
                  />
                  {{ t('action.conflictSkip') }}
                </label>
              </fieldset>
            }

            @if (dryRun.report.warnings.length > 0) {
              <label class="flex items-center gap-1.5 text-sm text-foreground-muted">
                <input
                  type="checkbox"
                  [checked]="acknowledgeWarnings()"
                  (change)="acknowledgeWarnings.set(!acknowledgeWarnings())"
                />
                {{ t('field.acknowledgeWarnings') }}
              </label>
            }

            <div class="flex flex-wrap items-center gap-3">
              <button
                uiPrimary
                type="button"
                [loading]="committing()"
                [disabled]="!canImport()"
                (click)="onImport()"
              >
                {{ t('action.import') }}
              </button>
              @if (committing()) {
                <span class="text-sm text-foreground-subtle">{{ t('message.importing') }}</span>
              }
            </div>
          }
        }
      </section>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseImportPanelComponent {
  private readonly importService = inject(UniverseImportService);

  protected readonly file = signal<File | null>(null);
  protected readonly validating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<DryRunResult | null>(null);
  protected readonly conflictPolicy = signal<ConflictResolution>('rename');
  protected readonly acknowledgeWarnings = signal(false);
  protected readonly importResult = signal<ImportResult | null>(null);

  private readonly commitProgress = this.importService.commitProgress;

  protected readonly committing = computed(() => {
    const phase = this.commitProgress().phase;
    return (
      phase === 'validating' || phase === 'config' || phase === 'uploading' || phase === 'writing'
    );
  });

  protected readonly totalCollisions = computed(() => {
    const dryRun = this.result();
    return dryRun ? dryRun.report.kinds.reduce((sum, kind) => sum + kind.collisions, 0) : 0;
  });

  protected readonly canImport = computed(() => {
    const dryRun = this.result();
    if (!dryRun || !dryRun.report.ok || this.committing()) return false;
    return dryRun.report.warnings.length === 0 || this.acknowledgeWarnings();
  });

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.[0] ?? null);
    this.result.set(null);
    this.importResult.set(null);
    this.acknowledgeWarnings.set(false);
    this.error.set(null);
  }

  protected async validate(): Promise<void> {
    const file = this.file();
    if (!file) return;
    this.validating.set(true);
    this.error.set(null);
    this.result.set(null);
    this.importResult.set(null);
    this.acknowledgeWarnings.set(false);
    try {
      this.result.set(await this.importService.dryRun(file));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.validating.set(false);
    }
  }

  protected async onImport(): Promise<void> {
    const dryRun = this.result();
    if (!dryRun || !dryRun.report.ok) return;
    const policy = this.conflictPolicy();
    const perKind: Record<EntityKind, ConflictResolution> = {
      character: policy,
      place: policy,
      event: policy,
      story: policy,
      plotline: policy,
      codexEntry: policy,
    };
    this.error.set(null);
    try {
      this.importResult.set(await this.importService.commit(dryRun, perKind));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
