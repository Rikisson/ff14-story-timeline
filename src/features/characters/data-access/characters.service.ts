import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { DirectoryRowInputs, UniverseEntityService } from '@shared/data-access';
import { Character, CharacterDraft } from './character.types';

@Injectable({ providedIn: 'root' })
export class CharactersService extends UniverseEntityService<Character, CharacterDraft> {
  protected readonly collectionName = 'characters';
  protected readonly kind: EntityKind = 'character';

  readonly characters = this.entitiesSignal;

  protected toDirectoryInputs(entity: Character): DirectoryRowInputs {
    return {
      label: entity.name,
      coverAssetId: entity.coverAssetId,
      // `secondary` (first-relatedRef resolved name) is deferred to phase 2
      // once `EntityResolverCache` is wired through the entity-write path.
    };
  }

  async updateSprites(id: string, sprites: string[]): Promise<void> {
    await this.patchFields(id, { sprites });
  }
}
