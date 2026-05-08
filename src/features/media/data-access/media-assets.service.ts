import { computed, effect, inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection as fsCollection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  QueryConstraint,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore/lite';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { UniverseStore } from '@features/universes';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import {
  AssetDoc,
  AssetKind,
  AssetListFilter,
  AssetUploadInput,
  AUDIO_ASSET_KINDS,
  IMAGE_ASSET_KINDS,
  StoredAsset,
} from './asset.types';

const ASSETS_COLLECTION = '_assets';
const CACHE_CONTROL = 'public, max-age=31536000';

const IMAGE_MIME = 'image/webp';
const AUDIO_MIMES: readonly string[] = [
  'audio/webm',
  'audio/ogg',
  'audio/opus',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
];

const MAX_BYTES: Record<AssetKind, number> = {
  cover: 5 * 1024 * 1024,
  sprite: 5 * 1024 * 1024,
  background: 8 * 1024 * 1024,
  ambient: 15 * 1024 * 1024,
  sfx: 5 * 1024 * 1024,
};

const MAX_DIMENSIONS: Record<'cover' | 'sprite' | 'background', { w: number; h: number }> = {
  cover: { w: 1600, h: 1600 },
  sprite: { w: 1600, h: 2400 },
  background: { w: 2560, h: 1440 },
};

@Injectable({ providedIn: 'root' })
export class MediaAssetsService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _assets = signal<AssetDoc[]>([]);
  readonly assets: Signal<AssetDoc[]> = this._assets.asReadonly();

  private readonly _byId = computed<Record<string, AssetDoc>>(() => {
    const map: Record<string, AssetDoc> = {};
    for (const a of this._assets()) map[a.id] = a;
    return map;
  });

  private refreshSeq = 0;

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const id = this.universes.activeUniverseId();
        if (!id) {
          this._assets.set([]);
          return;
        }
        void this.refresh(id);
      });
    }
  }

  byId(assetId: string | undefined | null): AssetDoc | undefined {
    if (!assetId) return undefined;
    return this._byId()[assetId];
  }

  urlFor(assetId: string | undefined | null): string | undefined {
    return this.byId(assetId)?.url;
  }

  async refresh(universeId?: string): Promise<void> {
    const id = universeId ?? this.universes.activeUniverseId();
    const seq = ++this.refreshSeq;
    if (!id) {
      this._assets.set([]);
      return;
    }
    const q = query(
      fsCollection(this.firebase.firestore, 'universes', id, ASSETS_COLLECTION),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    if (seq !== this.refreshSeq) return;
    this._assets.set(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredAsset) })),
    );
  }

  async upload(input: AssetUploadInput, authorUid: string): Promise<AssetDoc> {
    const universeId = this.requireUniverseId();
    assertMimeAndSize(input.kind, input.file);
    if (isImageKind(input.kind)) {
      await assertImageDimensions(input.kind, input.file);
    }

    const assetId = crypto.randomUUID();
    const safeName = sanitizeFilename(input.file.name);
    const path = `universes/${universeId}/${input.kind}/${assetId}/${safeName}`;
    const objectRef = ref(this.firebase.storage, path);

    await uploadBytes(objectRef, input.file, {
      cacheControl: CACHE_CONTROL,
      contentType: input.file.type,
    });
    const url = await getDownloadURL(objectRef);

    const stored: StoredAsset = {
      kind: input.kind,
      url,
      label: input.label?.trim() || stripExtension(input.file.name),
      blurDataUrl: input.blurDataUrl,
      tags: input.tags,
      authorUid,
      createdAt: Date.now(),
    };

    try {
      await setDoc(
        doc(this.firebase.firestore, 'universes', universeId, ASSETS_COLLECTION, assetId),
        stored,
      );
    } catch (err) {
      await deleteObject(objectRef).catch(() => undefined);
      throw err;
    }
    const created: AssetDoc = { id: assetId, ...stored };
    this._assets.update((curr) => [created, ...curr]);
    return created;
  }

  async list(filter: AssetListFilter = {}): Promise<AssetDoc[]> {
    const universeId = this.requireUniverseId();
    const constraints: QueryConstraint[] = [];
    if (filter.kind) constraints.push(where('kind', '==', filter.kind));
    if (filter.tag) constraints.push(where('tags', 'array-contains', filter.tag));
    constraints.push(orderBy('createdAt', 'desc'));
    const q = query(
      fsCollection(this.firebase.firestore, 'universes', universeId, ASSETS_COLLECTION),
      ...constraints,
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredAsset) }));
  }

  async rename(assetId: string, label: string): Promise<void> {
    const universeId = this.requireUniverseId();
    const trimmed = label.trim();
    await updateDoc(
      doc(this.firebase.firestore, 'universes', universeId, ASSETS_COLLECTION, assetId),
      { label: trimmed, updatedAt: Date.now() },
    );
    this._assets.update((curr) =>
      curr.map((a) => (a.id === assetId ? { ...a, label: trimmed, updatedAt: Date.now() } : a)),
    );
  }

  async delete(asset: AssetDoc): Promise<void> {
    const universeId = this.requireUniverseId();
    try {
      await deleteObject(ref(this.firebase.storage, asset.url));
    } catch {
      // Object may already be missing; proceed with doc removal so the
      // library doesn't keep a row pointing at nothing.
    }
    await deleteDoc(
      doc(this.firebase.firestore, 'universes', universeId, ASSETS_COLLECTION, asset.id),
    );
    this._assets.update((curr) => curr.filter((a) => a.id !== asset.id));
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}

function isImageKind(kind: AssetKind): kind is 'cover' | 'sprite' | 'background' {
  return IMAGE_ASSET_KINDS.includes(kind);
}

function assertMimeAndSize(kind: AssetKind, file: File): void {
  if (isImageKind(kind)) {
    if (file.type !== IMAGE_MIME) {
      throw new Error(
        `Unsupported image type for ${kind}: "${file.type || file.name}". Expected ${IMAGE_MIME}.`,
      );
    }
  } else if (AUDIO_ASSET_KINDS.includes(kind)) {
    if (!AUDIO_MIMES.includes(file.type)) {
      throw new Error(
        `Unsupported audio type for ${kind}: "${file.type || file.name}". Expected Opus or AAC.`,
      );
    }
  } else {
    throw new Error(`Unsupported asset kind: ${kind}`);
  }
  const max = MAX_BYTES[kind];
  if (file.size > max) {
    throw new Error(
      `File is too large (${formatMb(file.size)}). Maximum for ${kind} is ${formatMb(max)}.`,
    );
  }
}

async function assertImageDimensions(
  kind: 'cover' | 'sprite' | 'background',
  file: File,
): Promise<void> {
  const { w, h } = MAX_DIMENSIONS[kind];
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > w || bitmap.height > h) {
      throw new Error(
        `Image is too large (${bitmap.width}×${bitmap.height}). Maximum for ${kind} is ${w}×${h}.`,
      );
    }
  } finally {
    bitmap.close();
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]/g, '_');
}

function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
