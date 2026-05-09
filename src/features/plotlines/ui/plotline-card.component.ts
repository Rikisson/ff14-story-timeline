import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { MediaAssetsService } from '@features/media';
import { DangerButtonComponent, GhostButtonComponent, TagComponent, TagTone } from '@shared/ui';
import { Plotline, PlotlineStatus } from '../data-access/plotline.types';
import plotlineEn from '../i18n/en.json';
import plotlineUk from '../i18n/uk.json';

const STATUS_TONE: Record<PlotlineStatus, TagTone> = {
  planned: 'neutral',
  active: 'emerald',
  resolved: 'indigo',
};

const STATUS_KEY_SUFFIX: Record<PlotlineStatus, string> = {
  planned: 'field.statusPlanned',
  active: 'field.statusActive',
  resolved: 'field.statusResolved',
};

@Component({
  selector: 'app-plotline-card',
  imports: [
    NgOptimizedImage,
    GhostButtonComponent,
    DangerButtonComponent,
    TagComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'plotline',
      loader: {
        en: () => Promise.resolve(plotlineEn),
        uk: () => Promise.resolve(plotlineUk),
      },
    }),
  ],
  host: { class: 'block h-full' },
  template: `
    <ng-container *transloco="let t; prefix: 'plotline'">
      <ng-container *transloco="let g; prefix: 'general'">
        <article
          class="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
        >
          @if (coverUrl(); as u) {
            <div class="relative aspect-video w-full bg-surface-muted">
              <img [ngSrc]="u" alt="" fill class="object-cover" />
            </div>
          }
          <div class="flex flex-1 flex-col gap-3 p-4">
            <div class="flex items-start gap-2">
              @if (plotline().color; as c) {
                <span
                  class="mt-1 inline-block size-3 shrink-0 rounded-full border border-border"
                  [style.background-color]="c"
                  aria-hidden="true"
                ></span>
              }
              <h3 class="m-0 flex-1 text-lg font-semibold text-foreground">{{ plotline().title }}</h3>
              <div class="flex shrink-0 items-center gap-2">
                @if (statusInfo(); as s) {
                  <app-tag [tone]="s.tone">{{ t(s.labelKey) }}</app-tag>
                }
                @if (canEdit()) {
                  <button uiGhost type="button" (click)="edit.emit()">{{ g('action.edit') }}</button>
                  <button uiDanger type="button" (click)="remove.emit()">{{ g('action.delete') }}</button>
                }
              </div>
            </div>
            @if (plotline().description; as d) {
              <p class="m-0 whitespace-pre-line text-sm text-foreground-muted">{{ d }}</p>
            }
          </div>
        </article>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlotlineCardComponent {
  readonly plotline = input.required<Plotline>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly media = inject(MediaAssetsService);

  protected readonly statusInfo = computed(() => {
    const s = this.plotline().status;
    if (!s) return null;
    return { labelKey: STATUS_KEY_SUFFIX[s], tone: STATUS_TONE[s] };
  });
  protected readonly coverUrl = computed(() => this.media.urlFor(this.plotline().coverAssetId));
}
