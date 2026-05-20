import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';

export interface Choice {
  label?: string;
  sceneId: string;
}

@Component({
  selector: 'app-choice-list',
  imports: [TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'reader',
      loader: {
        en: () => Promise.resolve(readerEn),
        uk: () => Promise.resolve(readerUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'reader'">
      <ul class="flex flex-col gap-[0.35em]">
        @for (choice of choices(); track $index) {
          <li class="shrink-0">
            <button
              type="button"
              class="reader-action"
              (click)="choose.emit(choice.sceneId)"
            >
              {{ choice.label ?? t('action.continue') }}
            </button>
          </li>
        }
      </ul>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChoiceListComponent {
  readonly choices = input.required<Choice[]>();
  readonly choose = output<string>();
}
