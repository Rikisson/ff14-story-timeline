import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 class="m-0 text-3xl font-semibold text-slate-900">Page not found</h1>
      <p class="m-0 text-slate-600">We couldn't find what you were looking for.</p>
      <a routerLink="/" class="text-indigo-700 hover:underline">Back to stories</a>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
