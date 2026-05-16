import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { DirectoryRowInputs, UniverseEntityService } from '@shared/data-access';
import { buildCharacterDirectoryInputs } from './character-projection';
import { Character, CharacterDraft } from './character.types';

@Injectable({ providedIn: 'root' })
export class CharactersService extends UniverseEntityService<Character, CharacterDraft> {
  protected readonly collectionName = 'characters';
  protected readonly kind: EntityKind = 'character';

  readonly characters = this.entitiesSignal;

  protected toDirectoryInputs(entity: Character): DirectoryRowInputs {
    return buildCharacterDirectoryInputs(entity);
  }

  async updateSprites(id: string, sprites: string[]): Promise<void> {
    await this.patchFields(id, { sprites });
  }
}
