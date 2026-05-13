import { TimelineEvent } from '@features/events';
import { Plotline } from '@features/plotlines';
import { Story } from '@features/stories';
import { InGameDate, isInGameDateEmpty } from '@shared/models';
import { compareInGameDate } from '@shared/utils';
import { SortDirection } from './catalog-filters.component';

export interface PlotlineChip {
  id: string;
  label: string;
  color?: string;
}

export interface TimelineCard {
  kind: 'story' | 'event';
  id: string;
  story?: Story;
  event?: TimelineEvent;
  laneColor?: string;
  plotlines: PlotlineChip[];
  date: InGameDate;
  dated: boolean;
}

export interface TimelineLane {
  key: string;
  label: string;
  color?: string;
  dated: TimelineCard[];
  undated: TimelineCard[];
}

export const DEFAULT_LANE_KEY = '__all__';
// The label for this lane comes from i18n at the consumer; the empty string
// here keeps `lane.label` truthy-checks honest (consumers gate on the key).
export const UNASSIGNED_LANE_KEY = '__unassigned__';

interface BuildArgs {
  stories: Story[];
  events: TimelineEvent[];
  plotlines: Plotline[];
  selectedPlotlineIds: string[];
  showUnassignedLane: boolean;
  sortDirection: SortDirection;
  eraOrdinalLookup: (id: string) => number | undefined;
}

export function buildTimelineLanes(args: BuildArgs): TimelineLane[] {
  const {
    stories,
    events,
    plotlines,
    selectedPlotlineIds,
    showUnassignedLane,
    sortDirection,
    eraOrdinalLookup,
  } = args;

  const plotlineById = new Map<string, Plotline>();
  for (const p of plotlines) plotlineById.set(p.id, p);

  const allChips = (refs: { id: string }[] | undefined): PlotlineChip[] =>
    (refs ?? [])
      .map((r) => plotlineById.get(r.id))
      .filter((p): p is Plotline => !!p)
      .map((p) => ({ id: p.id, label: p.title, color: p.color }));

  const baseCards: TimelineCard[] = [];
  for (const story of stories) {
    baseCards.push({
      kind: 'story',
      id: story.id,
      story,
      plotlines: allChips(story.plotlineRefs),
      date: story.inGameDate,
      dated: !isInGameDateEmpty(story.inGameDate),
    });
  }
  for (const event of events) {
    baseCards.push({
      kind: 'event',
      id: event.id,
      event,
      plotlines: allChips(event.plotlineRefs),
      date: event.inGameDate,
      dated: !isInGameDateEmpty(event.inGameDate),
    });
  }

  // Default lane only when the user has expressed no preference at all —
  // neither a real plotline nor the synthetic "Unassigned" selection.
  if (selectedPlotlineIds.length === 0 && !showUnassignedLane) {
    return [partitionLane(DEFAULT_LANE_KEY, '', undefined, baseCards, sortDirection, eraOrdinalLookup)];
  }

  const lanes: TimelineLane[] = [];
  for (const id of selectedPlotlineIds) {
    const plotline = plotlineById.get(id);
    if (!plotline) continue;
    const matched = baseCards
      .filter((c) => c.plotlines.some((p) => p.id === id))
      .map((c) => ({ ...c, laneColor: plotline.color }));
    lanes.push(
      partitionLane(plotline.id, plotline.title, plotline.color, matched, sortDirection, eraOrdinalLookup),
    );
  }

  if (showUnassignedLane) {
    // "Unassigned" is a literal property of an item — it has no surviving
    // plotline refs — not a relative complement of the current selection.
    // This lets the user pick "Unassigned" alone and get a focused view of
    // unattached items.
    const unassigned = baseCards.filter((c) => c.plotlines.length === 0);
    lanes.push(
      partitionLane(
        UNASSIGNED_LANE_KEY,
        '',
        undefined,
        unassigned,
        sortDirection,
        eraOrdinalLookup,
      ),
    );
  }

  return lanes;
}

function partitionLane(
  key: string,
  label: string,
  color: string | undefined,
  cards: TimelineCard[],
  sortDirection: SortDirection,
  eraOrdinalLookup: (id: string) => number | undefined,
): TimelineLane {
  const dated: TimelineCard[] = [];
  const undated: TimelineCard[] = [];
  for (const card of cards) (card.dated ? dated : undated).push(card);

  dated.sort((a, b) => {
    const cmp = compareInGameDate(a.date, b.date, eraOrdinalLookup);
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });
  if (sortDirection === 'desc') dated.reverse();

  undated.sort((a, b) => a.id.localeCompare(b.id));

  return { key, label, color, dated, undated };
}
