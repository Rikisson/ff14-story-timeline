import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-editor-list-page',
  imports: [RouterLink],
  template: `
    <h2>My stories</h2>
    <p>List of stories you authored, plus a "new story" button.</p>
    <p>
      <a [routerLink]="['/edit', 'demo']">Open demo editor</a>
    </p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorListPage {}
