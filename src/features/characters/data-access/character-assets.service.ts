import { inject, Injectable } from '@angular/core';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { UniverseStore } from '@features/universes';
import { FirebaseService } from '../../../app/firebase/firebase.service';

const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class CharacterAssetsService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);

  async uploadPortrait(characterId: string, portraitId: string, file: File): Promise<string> {
    const universeId = this.universes.activeUniverseId();
    if (!universeId) throw new Error('No active universe selected.');
    assertPortraitAcceptable(file);
    const safeName = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const path = `universes/${universeId}/characters/${characterId}/portraits/${portraitId}/${safeName}`;
    const objectRef = ref(this.firebase.storage, path);
    await uploadBytes(objectRef, file);
    return getDownloadURL(objectRef);
  }
}

function assertPortraitAcceptable(file: File): void {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      `Unsupported portrait type: "${file.type || file.name}". Expected image/*.`,
    );
  }
  if (file.size > MAX_PORTRAIT_BYTES) {
    throw new Error(
      `Portrait is too large (${formatMb(file.size)}). Maximum is ${formatMb(MAX_PORTRAIT_BYTES)}.`,
    );
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
