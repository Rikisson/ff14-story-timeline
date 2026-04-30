import { inject, Injectable } from '@angular/core';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { UniverseStore } from '@features/universes';
import { FirebaseService } from '../../../app/firebase/firebase.service';

export type SceneAssetKind = 'background' | 'audio';

const MAX_BYTES: Record<SceneAssetKind, number> = {
  background: 5 * 1024 * 1024,
  audio: 15 * 1024 * 1024,
};

const ALLOWED_PREFIX: Record<SceneAssetKind, string> = {
  background: 'image/',
  audio: 'audio/',
};

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
    assertAcceptable(kind, file);
    const safeName = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const path = `universes/${universeId}/stories/${storyId}/scenes/${sceneId}/${kind}/${safeName}`;
    const objectRef = ref(this.firebase.storage, path);
    await uploadBytes(objectRef, file);
    return getDownloadURL(objectRef);
  }
}

function assertAcceptable(kind: SceneAssetKind, file: File): void {
  const expected = ALLOWED_PREFIX[kind];
  if (!file.type.startsWith(expected)) {
    throw new Error(
      `Unsupported file type for ${kind}: "${file.type || file.name}". Expected ${expected}*.`,
    );
  }
  const max = MAX_BYTES[kind];
  if (file.size > max) {
    throw new Error(
      `File is too large (${formatMb(file.size)}). Maximum for ${kind} is ${formatMb(max)}.`,
    );
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
