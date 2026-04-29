import { inject, Injectable } from '@angular/core';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { UniverseStore } from '@features/universes';
import { FirebaseService } from '../../../app/firebase/firebase.service';

export type SceneAssetKind = 'background' | 'character' | 'audio';

@Injectable({ providedIn: 'root' })
export class StoryAssetsService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);

  async upload(
    storyId: string,
    sceneId: string,
    kind: SceneAssetKind,
    file: File,
  ): Promise<string> {
    const universeId = this.universes.activeUniverseId();
    if (!universeId) throw new Error('No active universe selected.');
    const safeName = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const path = `universes/${universeId}/stories/${storyId}/scenes/${sceneId}/${kind}/${safeName}`;
    const objectRef = ref(this.firebase.storage, path);
    await uploadBytes(objectRef, file);
    return getDownloadURL(objectRef);
  }
}
