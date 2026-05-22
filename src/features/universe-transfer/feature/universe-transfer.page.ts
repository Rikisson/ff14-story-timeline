import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideTranslocoScope } from '@jsverse/transloco';
import { UniverseExportPanelComponent } from '../ui/universe-export-panel.component';
import { UniverseImportPanelComponent } from '../ui/universe-import-panel.component';
import universeTransferEn from '../i18n/en.json';
import universeTransferUk from '../i18n/uk.json';

@Component({
  selector: 'app-universe-transfer-page',
  imports: [UniverseExportPanelComponent, UniverseImportPanelComponent],
  providers: [
    provideTranslocoScope({
      scope: 'universeTransfer',
      loader: {
        en: () => Promise.resolve(universeTransferEn),
        uk: () => Promise.resolve(universeTransferUk),
      },
    }),
  ],
  template: `
    <div class="flex flex-col gap-3">
      <app-universe-export-panel />
      <app-universe-import-panel />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseTransferPage {}
