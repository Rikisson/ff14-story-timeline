import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { SecondaryButtonComponent } from '@shared/ui';

@Component({
  selector: 'app-migration-kit-card',
  imports: [TranslocoDirective, SecondaryButtonComponent],
  template: `
    <ng-container *transloco="let t; prefix: 'universeTransfer'">
      <div class="flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-3">
        <div>
          <h3 class="m-0 text-sm font-semibold text-foreground">{{ t('field.kitHeader') }}</h3>
          <p class="m-0 mt-0.5 text-xs text-foreground-subtle">{{ t('message.kitSubtitle') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a uiSecondary href="migration-kit/universe.schema.json" download>
            {{ t('action.downloadSchema') }}
          </a>
          <a uiSecondary href="migration-kit/example-universe.json" download>
            {{ t('action.downloadExample') }}
          </a>
          <a uiSecondary href="migration-kit/README.md" download>
            {{ t('action.downloadReadme') }}
          </a>
        </div>
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MigrationKitCardComponent {}
