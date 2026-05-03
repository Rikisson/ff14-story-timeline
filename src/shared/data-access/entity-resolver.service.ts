import { inject, Injectable } from '@angular/core';
import { CharactersService } from '@features/characters';
import { CodexEntriesService } from '@features/codex';
import { EventsService } from '@features/events';
import { FactionsService } from '@features/factions';
import { ItemsService } from '@features/items';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { StoriesService } from '@features/stories';
import { EntityKind, EntityRef } from '@shared/models';

export interface ResolvedEntity {
  kind: EntityKind;
  id: string;
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
}

export const ENTITY_KIND_LABEL: Record<EntityKind, string> = {
  character: 'Character',
  place: 'Place',
  event: 'Event',
  story: 'Story',
  plotline: 'Plotline',
  item: 'Item',
  faction: 'Faction',
  codexEntry: 'Codex',
};

@Injectable({ providedIn: 'root' })
export class EntityResolverService {
  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly events = inject(EventsService);
  private readonly stories = inject(StoriesService);
  private readonly plotlines = inject(PlotlinesService);
  private readonly items = inject(ItemsService);
  private readonly factions = inject(FactionsService);
  private readonly codex = inject(CodexEntriesService);

  resolve(ref: EntityRef): ResolvedEntity | null {
    switch (ref.kind) {
      case 'character': {
        const c = this.characters.characters().find((x) => x.id === ref.id);
        return c
          ? {
              kind: 'character',
              id: c.id,
              name: c.name,
              slug: c.slug,
              shortDescription: c.shortDescription,
              description: c.description,
            }
          : null;
      }
      case 'place': {
        const p = this.places.places().find((x) => x.id === ref.id);
        return p
          ? {
              kind: 'place',
              id: p.id,
              name: p.name,
              slug: p.slug,
              shortDescription: p.shortDescription,
              description: p.description,
            }
          : null;
      }
      case 'event': {
        const e = this.events.events().find((x) => x.id === ref.id);
        return e
          ? {
              kind: 'event',
              id: e.id,
              name: e.name,
              slug: e.slug,
              shortDescription: e.summary,
              description: e.description,
            }
          : null;
      }
      case 'story': {
        const s = this.stories.publishedStories().find((x) => x.id === ref.id);
        return s
          ? {
              kind: 'story',
              id: s.id,
              name: s.title,
              slug: s.slug,
              shortDescription: s.summary,
              description: s.description,
            }
          : null;
      }
      case 'plotline': {
        const p = this.plotlines.plotlines().find((x) => x.id === ref.id);
        return p
          ? {
              kind: 'plotline',
              id: p.id,
              name: p.title,
              slug: p.slug,
              shortDescription: p.summary,
            }
          : null;
      }
      case 'item': {
        const i = this.items.items().find((x) => x.id === ref.id);
        return i
          ? {
              kind: 'item',
              id: i.id,
              name: i.name,
              slug: i.slug,
              description: i.description,
            }
          : null;
      }
      case 'faction': {
        const f = this.factions.factions().find((x) => x.id === ref.id);
        return f
          ? {
              kind: 'faction',
              id: f.id,
              name: f.name,
              slug: f.slug,
              description: f.description,
            }
          : null;
      }
      case 'codexEntry': {
        const c = this.codex.entries().find((x) => x.id === ref.id);
        return c
          ? {
              kind: 'codexEntry',
              id: c.id,
              name: c.title,
              slug: c.slug,
              shortDescription: truncate(c.body, 200),
            }
          : null;
      }
    }
  }
}

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}
