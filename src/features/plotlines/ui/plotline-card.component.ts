import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { ContentLangDirective } from '@features/universes';
import {
  DangerButtonComponent,
  DetailCardComponent,
  GhostButtonComponent,
  TagComponent,
  TagTone,
} from '@shared/ui';
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
    DetailCardComponent,
    TagComponent,
    GhostButtonComponent,
    DangerButtonComponent,
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
        <app-detail-card [coverAssetId]="plotline().coverAssetId">
          @if (canEdit()) {
            <div class="flex shrink-0 items-center justify-end gap-2">
              <button uiGhost type="button" (click)="edit.emit()">{{ g('action.edit') }}</button>
              <button uiDanger type="button" (click)="remove.emit()">{{ g('action.delete') }}</button>
            </div>
          }

          <div appContentLang class="contents">
            <div class="flex items-center gap-2">
              @if (plotline().color; as c) {
                <span
                  class="inline-block size-4 shrink-0 rounded-full border border-border"
                  [style.background-color]="c"
                  aria-hidden="true"
                ></span>
              }
              <h2 class="m-0 font-display text-2xl font-semibold text-foreground">{{ plotline().title }}</h2>
            </div>

            @if (statusInfo(); as s) {
              <div class="flex flex-wrap items-center gap-2">
                <app-tag [tone]="s.tone">{{ t(s.labelKey) }}</app-tag>
              </div>
            }

            @if (plotline().description; as d) {
              <p class="m-0 max-w-prose whitespace-pre-line text-sm text-foreground-muted">{{ d }}</p>
            }
          </div>
        </app-detail-card>
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

  protected readonly statusInfo = computed(() => {
    const s = this.plotline().status;
    if (!s) return null;
    return { labelKey: STATUS_KEY_SUFFIX[s], tone: STATUS_TONE[s] };
  });
}
