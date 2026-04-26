import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-catalog-page',
  template: `
    <h2>Catalog</h2>
    <p>Story list and timeline view will live here.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage {}
