import { inject, Injectable } from '@angular/core';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore/lite';
import { Calendar } from '@features/calendar';
import { CodexCategoriesConfig } from '@features/codex';
import { EntityKind } from '@shared/models';
import { foldLabel } from '@shared/utils';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { ARCHIVE_ENTITY_KINDS } from './archive-format';
import { ImportContext, blankKindMaps } from './mint-ids';

@Injectable({ providedIn: 'root' })
export class ImportContextService {
  private readonly firebase = inject(FirebaseService);

  async read(universeId: string): Promise<ImportContext> {
    const fs = this.firebase.firestore;
    const [slugIndex, calendarSnap, categoriesSnap] = await Promise.all([
      getDocs(collection(fs, 'universes', universeId, '_slugIndex')),
      getDoc(doc(fs, 'universes', universeId, '_meta', 'calendar')),
      getDoc(doc(fs, 'universes', universeId, '_meta', 'codex_categories')),
    ]);

    const existingEntityIds = blankKindMaps();
    for (const entry of slugIndex.docs) {
      const separator = entry.id.indexOf('_');
      if (separator < 0) continue;
      const kind = entry.id.slice(0, separator);
      const slug = entry.id.slice(separator + 1);
      const entityId = (entry.data() as { entityId?: string }).entityId;
      if (entityId && isEntityKind(kind)) {
        existingEntityIds[kind].set(slug, entityId);
      }
    }

    const calendar = calendarSnap.exists() ? (calendarSnap.data() as Calendar) : undefined;
    const existingEraIdBySlug = new Map<string, string>();
    for (const era of calendar?.eras ?? []) {
      existingEraIdBySlug.set(era.slug || foldLabel(era.name) || era.id, era.id);
    }

    const categories = categoriesSnap.exists()
      ? (categoriesSnap.data() as CodexCategoriesConfig).categories
      : [];
    const existingCategoryKeys = new Set<string>();
    for (const category of categories) {
      if (category.key) existingCategoryKeys.add(category.key);
    }

    return {
      existingEntityIds,
      existingEraIdBySlug,
      existingCategoryKeys,
      targetHasCalendar: (calendar?.eras.length ?? 0) > 0,
    };
  }
}

function isEntityKind(value: string): value is EntityKind {
  return (ARCHIVE_ENTITY_KINDS as readonly string[]).includes(value);
}
