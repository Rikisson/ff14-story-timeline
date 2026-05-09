import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { SecondaryButtonComponent } from '@shared/ui';
import playerEn from '../i18n/en.json';
import playerUk from '../i18n/uk.json';

export interface Choice {
  label?: string;
  sceneId: string;
}

@Component({
  selector: 'app-choice-list',
  imports: [SecondaryButtonComponent, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'player',
      loader: {
        en: () => Promise.resolve(playerEn),
        uk: () => Promise.resolve(playerUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'player'">
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
