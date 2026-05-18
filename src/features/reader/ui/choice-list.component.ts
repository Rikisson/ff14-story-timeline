import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { SecondaryButtonComponent } from '@shared/ui';
import readerEn from '../i18n/en.json';
import readerUk from '../i18n/uk.json';

export interface Choice {
  label?: string;
  sceneId: string;
}

@Component({
  selector: 'app-choice-list',
  imports: [SecondaryButtonComponent, TranslocoDirective],
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
      <ul class="flex flex-col items-stretch gap-2">
        @for (choice of choices(); track $index) {
          <li>
            <button
              uiSecondary
              type="button"
              className="w-full justify-start"
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
