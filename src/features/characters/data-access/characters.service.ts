import { Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { UniverseEntityService } from '@shared/data-access';
import { Character, CharacterDraft } from './character.types';

@Injectable({ providedIn: 'root' })
export class CharactersService extends UniverseEntityService<Character, CharacterDraft> {
  protected readonly collectionName = 'characters';
  protected readonly kind: EntityKind = 'character';

  readonly characters = this.entitiesSignal;

  async updateSprites(id: string, sprites: string[]): Promise<void> {
    await this.patchFields(id, { sprites });
  }
}
