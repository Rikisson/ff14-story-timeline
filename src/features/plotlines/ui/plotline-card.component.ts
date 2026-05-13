import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { MediaAssetsService } from '@features/media';
import { ContentLangDirective } from '@features/universes';
import { TagComponent, TagTone, UTILITY_DANGER, UTILITY_SECONDARY } from '@shared/ui';
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
    TagComponent,
    TranslocoDirective,
    ContentLangDirective,
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
          class="relative h-full w-full overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
        >
          @if (coverUrl(); as u) {
            <img
              [ngSrc]="u"
              alt=""
              fill
              class="absolute inset-0 object-cover"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-scrim/80 via-scrim/40 to-scrim/20"
              aria-hidden="true"
            ></div>
          }

          @if (statusInfo(); as s) {
            <span class="absolute left-3 top-3 z-10">
              <app-tag [tone]="s.tone">{{ t(s.labelKey) }}</app-tag>
            </span>
          }

          @if (canEdit()) {
            <div class="absolute right-3 top-3 z-20 flex items-center gap-2">
              <button type="button" [class]="utilSecondaryClass" (click)="edit.emit()">{{ g('action.edit') }}</button>
              <button type="button" [class]="utilDangerClass" (click)="remove.emit()">{{ g('action.delete') }}</button>
            </div>
          }

          <div
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-12 text-center"
          >
            <div appContentLang class="contents">
              <div class="flex items-center justify-center gap-3">
                @if (plotline().color; as c) {
                  <span
                    class="inline-block size-4 shrink-0 rounded-full border border-border shadow"
                    [style.background-color]="c"
                    aria-hidden="true"
                  ></span>
                }
                <h2
                  class="m-0 text-2xl font-bold sm:text-3xl"
                  [class.text-scrim-foreground]="hasImage()"
                  [class.drop-shadow-md]="hasImage()"
                  [class.text-foreground]="!hasImage()"
                >{{ plotline().title }}</h2>
              </div>

              @if (plotline().description; as d) {
                <p
                  class="m-0 max-w-2xl whitespace-pre-line text-sm line-clamp-6"
                  [class.text-scrim-foreground]="hasImage()"
                  [class.drop-shadow]="hasImage()"
                  [class.text-foreground-muted]="!hasImage()"
                >{{ d }}</p>
              }
            </div>

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

  protected readonly utilSecondaryClass = UTILITY_SECONDARY;
  protected readonly utilDangerClass = UTILITY_DANGER;

  protected readonly statusInfo = computed(() => {
    const s = this.plotline().status;
    if (!s) return null;
    return { labelKey: STATUS_KEY_SUFFIX[s], tone: STATUS_TONE[s] };
  });
  protected readonly coverUrl = computed(() => this.media.urlFor(this.plotline().coverAssetId));
  protected readonly hasImage = computed(() => !!this.coverUrl());
}
