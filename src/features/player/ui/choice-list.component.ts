import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface Choice {
  label?: string;
  sceneId: string;
}

@Component({
  selector: 'app-choice-list',
  template: `
    @for (choice of choices(); track $index) {
      <button type="button" (click)="select.emit(choice.sceneId)">
        {{ choice.label ?? 'Continue' }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 640px;
      align-items: flex-start;
    }
    button {
      padding: 0.5rem 1rem;
      text-align: left;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChoiceListComponent {
  readonly choices = input.required<Choice[]>();
  readonly select = output<string>();
}
