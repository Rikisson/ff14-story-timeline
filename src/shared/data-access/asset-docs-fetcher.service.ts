import { inject, Injectable } from '@angular/core';
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from 'firebase/firestore/lite';
import { FirebaseService } from '../../app/firebase/firebase.service';
import type { AssetThumb } from './asset-thumb-resolver.service';

const ASSETS_COLLECTION = '_assets';

@Injectable({ providedIn: 'root' })
export class AssetDocsFetcher {
  private readonly firebase = inject(FirebaseService);

  async fetchAssets(
    universeId: string,
    assetIds: readonly string[],
  ): Promise<Map<string, AssetThumb>> {
    const out = new Map<string, AssetThumb>();
    if (assetIds.length === 0) return out;
    const q = query(
      collection(this.firebase.firestore, 'universes', universeId, ASSETS_COLLECTION),
      where(documentId(), 'in', [...assetIds]),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as {
        url: string;
        thumbUrl?: string;
        blurDataUrl?: string;
        label?: string;
      };
      out.set(d.id, {
        id: d.id,
        url: data.url,
        thumbUrl: data.thumbUrl,
        blurDataUrl: data.blurDataUrl,
        label: data.label,
      });
    }
    return out;
  }
}
