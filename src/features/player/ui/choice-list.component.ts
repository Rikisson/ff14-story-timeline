import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SecondaryButtonComponent } from '@shared/ui';

export interface Choice {
  label?: string;
  sceneId: string;
}

@Component({
  selector: 'app-choice-list',
  imports: [SecondaryButtonComponent],
  template: `
    <ul class="flex flex-col items-stretch gap-2">
      @for (choice of choices(); track $index) {
        <li>
          <button
            uiSecondary
            type="button"
            className="w-full justify-start"
            (click)="select.emit(choice.sceneId)"
          >
            {{ choice.label ?? 'Continue' }}
          </button>
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChoiceListComponent {
  readonly choices = input.required<Choice[]>();
  readonly select = output<string>();
}
