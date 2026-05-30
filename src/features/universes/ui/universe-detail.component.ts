import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { LOCALE_META } from '@shared/services';
import {
  DetailCardComponent,
  GhostButtonComponent,
  MarkdownTextComponent,
  PrimaryButtonComponent,
  TagComponent,
  WorldIconComponent,
} from '@shared/ui';
import { Universe } from '../data-access/universe.types';
import universeEn from '../i18n/en.json';
import universeUk from '../i18n/uk.json';

@Component({
  selector: 'app-universe-detail',
  imports: [
    DetailCardComponent,
    GhostButtonComponent,
    MarkdownTextComponent,
    PrimaryButtonComponent,
    TagComponent,
    WorldIconComponent,
    TranslocoDirective,
  ],
  host: { class: 'block h-full' },
  providers: [
    provideTranslocoScope({
      scope: 'universe',
      loader: {
        en: () => Promise.resolve(universeEn),
        uk: () => Promise.resolve(universeUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'universe'">
      <app-detail-card [coverAssetId]="universe().coverAssetId">
        <div class="flex items-start justify-between gap-3">
          <h2 class="m-0 min-w-0 flex-1 font-display text-2xl font-semibold text-foreground">
            {{ universe().name }}
          </h2>
          @if (canManage()) {
            <div class="flex shrink-0 items-center gap-2">
              <button uiGhost type="button" (click)="openSettings.emit()">{{ t('action.settingsMenu') }}</button>
            </div>
          }
        </div>

        <button uiPrimary class="self-start" type="button" (click)="enterUniverse.emit()">
          <app-world-icon icon-leading class="size-4" />
          {{ t('action.enter') }}
        </button>

        @if (universe().description; as desc) {
          <app-markdown-text class="text-sm text-foreground-muted" [text]="desc" />
        }

        <ul class="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
          <li><app-tag>{{ localeLabel() }}</app-tag></li>
        </ul>
      </app-detail-card>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseDetailComponent {
  readonly universe = input.required<Universe>();
  readonly canManage = input<boolean>(false);

  readonly enterUniverse = output<void>();
  readonly openSettings = output<void>();

  protected readonly localeLabel = computed(() => LOCALE_META[this.universe().locale].label);
}
