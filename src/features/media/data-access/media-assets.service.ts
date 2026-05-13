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
import { UniverseStore } from '@features/universes';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { R2ObjectRef, R2Service } from '../../../app/r2/r2.service';
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

const SPRITE_INPUT_MIME = 'image/webp';
const TRANSCODED_INPUT_MIMES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];
const AUDIO_MIMES: readonly string[] = [
  'audio/webm',
  'audio/ogg',
  'audio/opus',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
];

const MAX_BYTES: Record<AssetKind, number> = {
  cover: 10 * 1024 * 1024,
  sprite: 5 * 1024 * 1024,
  background: 10 * 1024 * 1024,
  ambient: 15 * 1024 * 1024,
  sfx: 5 * 1024 * 1024,
};

const MAX_DIMENSIONS: Record<'cover' | 'sprite' | 'background', { w: number; h: number }> = {
  cover: { w: 2560, h: 1440 },
  sprite: { w: 1600, h: 2400 },
  background: { w: 2560, h: 1440 },
};

// Kinds that get transcoded + downscaled in-browser before upload.
// Sprite stays a pure WebP passthrough so authored transparency is preserved bit-exact.
const TRANSCODED_IMAGE_KINDS: readonly AssetKind[] = ['cover', 'background'];

const MIN_WIDTH: Record<'cover' | 'background', number> = {
  cover: 1280,
  background: 1280,
};

const WEBP_QUALITY = 0.75;
const THUMB_WIDTH = 640;
const THUMB_QUALITY = 0.7;
const THUMB_SUFFIX = '.thumb';

@Injectable({ providedIn: 'root' })
export class MediaAssetsService {
  private readonly firebase = inject(FirebaseService);
  private readonly r2 = inject(R2Service);
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

  // Prefer the 640w thumb when available; fall back to the full image so assets
  // uploaded before the thumb pipeline still render in card slots.
  thumbUrlFor(assetId: string | undefined | null): string | undefined {
    const asset = this.byId(assetId);
    return asset?.thumbUrl ?? asset?.url;
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

    let file = input.file;
    let thumbFile: File | undefined;
    if (isImageKind(input.kind)) {
      if (isTranscodedKind(input.kind)) {
        const processed = await processImage(input.kind, file);
        file = processed.full;
        thumbFile = processed.thumb;
      } else {
        await assertImageDimensions(input.kind, file);
      }
    }

    const assetId = crypto.randomUUID();
    const objectRef: R2ObjectRef = {
      universeId,
      kind: input.kind,
      assetId,
      filename: sanitizeFilename(file.name),
    };

    await this.putObject(objectRef, file);

    let thumbRef: R2ObjectRef | undefined;
    if (thumbFile) {
      thumbRef = {
        universeId,
        kind: input.kind,
        assetId,
        filename: sanitizeFilename(thumbFile.name),
      };
      try {
        await this.putObject(thumbRef, thumbFile);
      } catch (err) {
        // The full image is already in R2; clean it up so we don't leave an
        // orphan when the thumb leg fails.
        await this.deleteObject(objectRef).catch(() => undefined);
        throw err;
      }
    }

    const stored: StoredAsset = {
      kind: input.kind,
      url: this.r2.publicUrlFor(objectRef),
      thumbUrl: thumbRef ? this.r2.publicUrlFor(thumbRef) : undefined,
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
      // Best-effort cleanup so the bucket doesn't accumulate orphans when the
      // metadata write fails. If the cleanup itself fails, surface the original
      // error — the orphan is recoverable, the failed write isn't.
      await this.deleteObject(objectRef).catch(() => undefined);
      if (thumbRef) await this.deleteObject(thumbRef).catch(() => undefined);
      throw err;
    }
    const created: AssetDoc = { id: assetId, ...stored };
    this._assets.update((curr) => [created, ...curr]);
    return created;
  }

  private async putObject(ref: R2ObjectRef, file: File): Promise<void> {
    const uploadUrl = await this.r2.signUpload(ref);
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type, 'Cache-Control': CACHE_CONTROL },
    });
    if (!res.ok) {
      throw new Error(`Upload failed (${res.status}).`);
    }
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
    const refs = [asset.url, asset.thumbUrl]
      .filter((u): u is string => !!u)
      .map((u) => this.r2.parseObjectRef(u))
      .filter((r): r is R2ObjectRef => r !== null);
    for (const ref of refs) {
      await this.deleteObject(ref).catch(() => undefined);
    }
    await deleteDoc(
      doc(this.firebase.firestore, 'universes', universeId, ASSETS_COLLECTION, asset.id),
    );
    this._assets.update((curr) => curr.filter((a) => a.id !== asset.id));
  }

  private async deleteObject(ref: R2ObjectRef): Promise<void> {
    const deleteUrl = await this.r2.signDelete(ref);
    await fetch(deleteUrl, { method: 'DELETE' });
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

function isTranscodedKind(kind: AssetKind): kind is 'cover' | 'background' {
  return TRANSCODED_IMAGE_KINDS.includes(kind);
}

function assertMimeAndSize(kind: AssetKind, file: File): void {
  if (isImageKind(kind)) {
    const accepted = isTranscodedKind(kind) ? TRANSCODED_INPUT_MIMES : [SPRITE_INPUT_MIME];
    if (!accepted.includes(file.type)) {
      throw new Error(
        `Unsupported image type for ${kind}: "${file.type || file.name}". Expected ${accepted.join(', ')}.`,
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

// Decode → validate minimum width → downscale to per-kind max (preserving aspect ratio)
// → re-encode as WebP. Covers also get a 640w thumb encoded from the same decoded
// bitmap so timeline/list cards never have to download the full-res image.
async function processImage(
  kind: 'cover' | 'background',
  file: File,
): Promise<{ full: File; thumb?: File }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const minW = MIN_WIDTH[kind];
    if (bitmap.width < minW) {
      throw new Error(
        `Image is too small (${bitmap.width}×${bitmap.height}). Minimum width for ${kind} is ${minW}px.`,
      );
    }
    const full = await encodeBitmapToWebP(
      bitmap,
      file.name,
      MAX_DIMENSIONS[kind],
      WEBP_QUALITY,
      '',
    );
    if (kind !== 'cover') return { full };
    const thumb = await encodeBitmapToWebP(
      bitmap,
      file.name,
      { w: THUMB_WIDTH, h: Number.MAX_SAFE_INTEGER },
      THUMB_QUALITY,
      THUMB_SUFFIX,
    );
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}

async function encodeBitmapToWebP(
  bitmap: ImageBitmap,
  sourceName: string,
  maxDims: { w: number; h: number },
  quality: number,
  suffix: string,
): Promise<File> {
  const scale = Math.min(1, maxDims.w / bitmap.width, maxDims.h / bitmap.height);
  const targetW = Math.max(1, Math.round(bitmap.width * scale));
  const targetH = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  );
  if (!blob) throw new Error('WebP encoding failed.');
  return new File([blob], `${stripExtension(sourceName)}${suffix}.webp`, { type: 'image/webp' });
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
