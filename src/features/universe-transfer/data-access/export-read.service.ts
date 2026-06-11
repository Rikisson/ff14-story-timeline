import { inject, Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore/lite';
import { Calendar } from '@features/calendar';
import { Character } from '@features/characters';
import { CodexCategoriesConfig, CodexEntry } from '@features/codex';
import { Connection } from '@features/connections';
import { TimelineEvent } from '@features/events';
import { AssetDoc } from '@features/media';
import { Place } from '@features/places';
import { Plotline } from '@features/plotlines';
import { Story, StoryContent, normalizeStoryContent } from '@features/stories';
import { DEFAULT_UNIVERSE_LOCALE, Universe } from '@features/universes';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { ExportInput } from './to-archive';

export type UniverseExportData = Omit<ExportInput, 'generator'>;

@Injectable({ providedIn: 'root' })
export class ExportReadService {
  private readonly firebase = inject(FirebaseService);

  async read(universeId: string): Promise<UniverseExportData> {
    const [
      universe,
      calendar,
      categories,
      assets,
      characters,
      places,
      plotlines,
      events,
      codexEntries,
      storyMetas,
      connections,
    ] = await Promise.all([
      this.readUniverse(universeId),
      this.readMeta<Calendar>(universeId, 'calendar'),
      this.readMeta<CodexCategoriesConfig>(universeId, 'codex_categories'),
      this.readCollection<AssetDoc>(universeId, '_assets'),
      this.readCollection<Character>(universeId, 'characters'),
      this.readCollection<Place>(universeId, 'places'),
      this.readCollection<Plotline>(universeId, 'plotlines'),
      this.readCollection<TimelineEvent>(universeId, 'events'),
      this.readCollection<CodexEntry>(universeId, 'codexEntries'),
      this.readCollection<Story>(universeId, 'stories'),
      this.readCollection<Connection>(universeId, 'connections'),
    ]);

    const stories = await Promise.all(
      storyMetas.map(async (story) => ({
        story,
        content: await this.readStoryContent(universeId, story.id),
      })),
    );

    return {
      universe,
      calendar,
      categories,
      assets,
      characters,
      places,
      plotlines,
      events,
      codexEntries,
      stories,
      connections,
    };
  }

  private async readUniverse(universeId: string): Promise<Universe> {
    const snap = await getDoc(doc(this.firebase.firestore, 'universes', universeId));
    if (!snap.exists()) throw new Error('Universe not found.');
    const data = snap.data() as Omit<Universe, 'id'>;
    return { ...data, id: snap.id, locale: data.locale ?? DEFAULT_UNIVERSE_LOCALE };
  }

  private async readMeta<T>(universeId: string, metaDoc: string): Promise<T | undefined> {
    const snap = await getDoc(
      doc(this.firebase.firestore, 'universes', universeId, '_meta', metaDoc),
    );
    return snap.exists() ? (snap.data() as T) : undefined;
  }

  private async readCollection<T extends { id: string }>(
    universeId: string,
    name: string,
  ): Promise<T[]> {
    const snap = await getDocs(collection(this.firebase.firestore, 'universes', universeId, name));
    return snap.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<T, 'id'>) }) as T);
  }

  private async readStoryContent(universeId: string, storyId: string): Promise<StoryContent> {
    const snap = await getDoc(
      doc(this.firebase.firestore, 'universes', universeId, 'stories', storyId, '_content', 'main'),
    );
    return snap.exists()
      ? normalizeStoryContent(snap.data() as Record<string, unknown>)
      : { defaultEntrySceneId: '', scenes: {} };
  }
}
