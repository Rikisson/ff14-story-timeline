import { inject, Injectable } from '@angular/core';
import { FirebaseService } from '../firebase/firebase.service';
import { r2Config } from '../r2.config';
import type { AssetKind } from '@features/media';

export interface R2ObjectRef {
  universeId: string;
  kind: AssetKind;
  assetId: string;
  filename: string;
}

export interface BulkDeleteResult {
  key: string;
  ok: boolean;
  status: number;
}

@Injectable({ providedIn: 'root' })
export class R2Service {
  private readonly firebase = inject(FirebaseService);

  async signUpload(ref: R2ObjectRef, byteLength: number): Promise<string> {
    this.assertConfigured();
    const idToken = await this.firebase.auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Sign in to upload media.');
    const res = await fetch(`${r2Config.signerUrl}/sign-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ref, byteLength }),
    });
    const body = (await res.json().catch(() => ({}))) as { [k: string]: string | undefined };
    if (!res.ok) {
      throw new Error(body['error'] ?? `Media backend error (${res.status})`);
    }
    const url = body['uploadUrl'];
    if (!url) throw new Error('Media backend returned no URL.');
    return url;
  }

  async signDelete(ref: R2ObjectRef): Promise<string> {
    this.assertConfigured();
    const idToken = await this.firebase.auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Sign in to delete media.');
    const res = await fetch(`${r2Config.signerUrl}/sign-delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(ref),
    });
    const body = (await res.json().catch(() => ({}))) as { [k: string]: string | undefined };
    if (!res.ok) {
      throw new Error(body['error'] ?? `Media backend error (${res.status})`);
    }
    const url = body['deleteUrl'];
    if (!url) throw new Error('Media backend returned no URL.');
    return url;
  }

  async bulkDelete(universeId: string, keys: string[]): Promise<BulkDeleteResult[]> {
    this.assertConfigured();
    if (keys.length === 0) return [];
    const idToken = await this.firebase.auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Sign in to delete media.');
    const res = await fetch(`${r2Config.signerUrl}/bulk-delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ universeId, keys }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      results?: BulkDeleteResult[];
      error?: string;
    };
    if (!res.ok) throw new Error(body.error ?? `Media backend error (${res.status})`);
    return body.results ?? [];
  }

  publicUrlFor(ref: R2ObjectRef): string {
    this.assertConfigured();
    return `${r2Config.publicBase}/${objectKey(ref)}`;
  }

  parseObjectRef(url: string): R2ObjectRef | null {
    if (!r2Config.publicBase || !url.startsWith(`${r2Config.publicBase}/`)) return null;
    const parts = url.slice(r2Config.publicBase.length + 1).split('/');
    if (parts.length !== 5 || parts[0] !== 'universes') return null;
    const [, universeId, kind, assetId, filename] = parts;
    return { universeId, kind: kind as AssetKind, assetId, filename };
  }

  private assertConfigured(): void {
    if (!r2Config.signerUrl || !r2Config.publicBase) {
      throw new Error(
        'Media backend not configured. Set signerUrl and publicBase in src/app/r2.config.ts.',
      );
    }
  }
}

function objectKey(ref: R2ObjectRef): string {
  return `universes/${ref.universeId}/${ref.kind}/${ref.assetId}/${ref.filename}`;
}
