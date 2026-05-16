import { inject, Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { DirectoryRowInputs, UniverseEntityService } from '@shared/data-access';
import { CodexCategoriesService } from './codex-categories.service';
import { CodexEntry, CodexEntryDraft } from './codex-entry.types';

@Injectable({ providedIn: 'root' })
export class CodexEntriesService extends UniverseEntityService<CodexEntry, CodexEntryDraft> {
  protected readonly collectionName = 'codexEntries';
  protected readonly kind: EntityKind = 'codexEntry';

  private readonly categoriesService = inject(CodexCategoriesService);

  readonly entries = this.entitiesSignal;

  protected toDirectoryInputs(entity: CodexEntry): DirectoryRowInputs {
    return {
      label: entity.title,
      coverAssetId: entity.coverAssetId,
      categoryKey: entity.categoryKey,
      secondary: entity.categoryKey
        ? this.categoriesService.categories().find((c) => c.key === entity.categoryKey)?.label
        : undefined,
    };
  }
}
