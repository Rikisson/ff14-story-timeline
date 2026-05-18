import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Standard inner-page shell. Owns the padding + vertical-stack contract
 * that used to live on `<main>` in `app.html`, so individual pages can
 * opt out (player full-screen, future reader mode) by skipping the
 * wrapper and rendering directly into `<main>`.
 *
 * Scroll lives on `<main>`, not here.
 */
@Component({
  selector: 'app-page',
  host: { class: 'flex flex-col gap-4 p-6' },
  template: `<ng-content />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageComponent {}
