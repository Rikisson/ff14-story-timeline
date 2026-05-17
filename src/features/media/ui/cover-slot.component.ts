import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AssetThumbResolver } from '@shared/data-access';
import {
  GhostButtonComponent,
  SecondaryButtonComponent,
} from '@shared/ui';
import { AssetPickerComponent } from './asset-picker.component';
import mediaEn from '../i18n/en.json';
import mediaUk from '../i18n/uk.json';

@Component({
  selector: 'app-cover-slot',
  imports: [
    NgOptimizedImage,
    AssetPickerComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'media',
      loader: {
        en: () => Promise.resolve(mediaEn),
        uk: () => Promise.resolve(mediaUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'media'">
      <ng-container *transloco="let g; prefix: 'general'">
        <div class="flex flex-col gap-2">
          @if (label(); as l) {
            <span class="text-sm font-medium text-foreground-muted">{{ l }}</span>
          }
          @if (url(); as u) {
            <div
              class="relative aspect-video w-full overflow-hidden rounded border border-border bg-surface-muted"
            >
              <img [ngSrc]="u" alt="" fill class="object-cover" />
            </div>
            <div class="flex gap-2">
              <button uiSecondary type="button" (click)="picker.open()">{{ g('action.replace') }}</button>
              <button uiGhost type="button" (click)="clear()">{{ g('action.remove') }}</button>
            </div>
          } @else {
            <button uiSecondary type="button" (click)="picker.open()">{{ t('action.pickCover') }}</button>
          }
          <app-asset-picker
            #picker
            kind="cover"
            [title]="t('tooltip.pickCoverTitle')"
            [currentSelection]="selection()"
            (picked)="onPicked($event)"
          />
        </div>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverSlotComponent {
  readonly assetId = input<string | undefined>();
  readonly label = input<string>('');
  readonly picked = output<string | undefined>();

  private readonly assets = inject(AssetThumbResolver);

  protected readonly url = computed(() => this.assets.resolve(this.assetId())()?.url);
  protected readonly selection = computed(() => {
    const id = this.assetId();
    return id ? [id] : [];
  });

  protected onPicked(ids: string[]): void {
    this.picked.emit(ids[0]);
  }

  protected clear(): void {
    this.picked.emit(undefined);
  }
}
