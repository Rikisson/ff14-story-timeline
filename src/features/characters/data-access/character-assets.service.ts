import { inject, Injectable } from '@angular/core';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { UniverseStore } from '@features/universes';
import { FirebaseService } from '../../../app/firebase/firebase.service';

@Injectable({ providedIn: 'root' })
export class CharacterAssetsService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);

  async uploadPortrait(characterId: string, portraitId: string, file: File): Promise<string> {
    const universeId = this.universes.activeUniverseId();
    if (!universeId) throw new Error('No active universe selected.');
    const safeName = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const path = `universes/${universeId}/characters/${characterId}/portraits/${portraitId}/${safeName}`;
    const objectRef = ref(this.firebase.storage, path);
    await uploadBytes(objectRef, file);
    return getDownloadURL(objectRef);
  }
}
