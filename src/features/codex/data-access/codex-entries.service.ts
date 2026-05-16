import { computed, inject, Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { DirectoryRowInputs, UniverseEntityService } from '@shared/data-access';
import { CodexCategoriesService } from './codex-categories.service';
import {
  buildCodexEntryDirectoryInputs,
  CodexCategoriesProjectionContext,
} from './codex-entry-projection';
import { CodexEntry, CodexEntryDraft } from './codex-entry.types';

@Injectable({ providedIn: 'root' })
export class CodexEntriesService extends UniverseEntityService<CodexEntry, CodexEntryDraft> {
  protected readonly collectionName = 'codexEntries';
  protected readonly kind: EntityKind = 'codexEntry';

  private readonly categoriesService = inject(CodexCategoriesService);
  private readonly categoryLabelByKey = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const c of this.categoriesService.categories()) {
      if (c.key) map.set(c.key, c.label);
    }
    return map;
  });

  readonly entries = this.entitiesSignal;

  protected toDirectoryInputs(entity: CodexEntry): DirectoryRowInputs {
    return buildCodexEntryDirectoryInputs(entity, this.categoriesContext());
  }

  private categoriesContext(): CodexCategoriesProjectionContext {
    return { categoryLabelByKey: this.categoryLabelByKey() };
  }
}
