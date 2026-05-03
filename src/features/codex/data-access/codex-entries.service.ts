import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { UniverseEntityService } from '@shared/data-access';
import { CodexEntry, CodexEntryDraft } from './codex-entry.types';

@Injectable({ providedIn: 'root' })
export class CodexEntriesService extends UniverseEntityService<CodexEntry, CodexEntryDraft> {
  protected readonly collectionName = 'codexEntries';
  protected readonly kind: EntityKind = 'codexEntry';

  readonly entries = this.entitiesSignal;
}
