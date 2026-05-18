import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { SortDirection } from '@shared/data-access';
import { TimelineLaneComponent } from './timeline-lane.component';

export interface TimelineLaneDescriptor {
  /** null = global stream; string = per-lane stream (incl. `__unassigned__`). */
  laneKey: string | null;
  label: string;
  color?: string;
}

/**
 * Vertical stack of timeline streams. Each lane owns its own store, so
 * cursors and *Load more* state stay independent per
 * `docs/narrative-engine-impl.md` *Timeline UX*. The parent computes the
 * lane descriptor list from the active filter selection.
 *
 * The component is intentionally thin: filter, fetch, sort, and
 * pagination logic all live in `TimelineLaneComponent` and its store.
 */
@Component({
  selector: 'app-catalog-timeline',
  imports: [TimelineLaneComponent],
  template: `
    <div class="flex flex-col gap-6">
      @for (lane of lanes(); track lane.laneKey ?? '__global__') {
        <app-timeline-lane
          [laneKey]="lane.laneKey"
          [label]="lane.label"
          [color]="lane.color"
          [sortDirection]="sortDirection()"
        />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogTimelineComponent {
  readonly lanes = input.required<TimelineLaneDescriptor[]>();
  readonly sortDirection = input<SortDirection>('asc');
}
