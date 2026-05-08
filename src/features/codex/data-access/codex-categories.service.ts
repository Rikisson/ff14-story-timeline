import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  Signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import {
  CodexCategoriesConfig,
  CodexCategory,
  EMPTY_CODEX_CATEGORIES_CONFIG,
} from './codex-category.types';

const CONFIG_DOC = 'codex_categories';

function errorMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

@Injectable({ providedIn: 'root' })
export class CodexCategoriesService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _config = signal<CodexCategoriesConfig>(EMPTY_CODEX_CATEGORIES_CONFIG);
  readonly config: Signal<CodexCategoriesConfig> = this._config.asReadonly();
  readonly categories = computed<CodexCategory[]>(() => this._config().categories);

  /** Lookup by label (case-insensitive). Used by codex card chip color. */
  readonly categoryByLabel = computed<Map<string, CodexCategory>>(() => {
    const map = new Map<string, CodexCategory>();
    for (const c of this._config().categories) map.set(c.label.toLowerCase(), c);
    return map;
  });

  private readonly _refreshError = signal<string | null>(null);
  readonly refreshError: Signal<string | null> = this._refreshError.asReadonly();

  private refreshSeq = 0;

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const id = this.universes.activeUniverseId();
        if (!id) {
          this._config.set(EMPTY_CODEX_CATEGORIES_CONFIG);
          this._refreshError.set(null);
          return;
        }
        this._refreshError.set(null);
        this.refresh(id).catch((err) => {
          console.error('codex categories refresh failed', err);
          this._refreshError.set(errorMessage(err));
        });
      });
    }
  }

  async refresh(universeId?: string): Promise<void> {
    const id = universeId ?? this.universes.activeUniverseId();
    const seq = ++this.refreshSeq;
    if (!id) {
      this._config.set(EMPTY_CODEX_CATEGORIES_CONFIG);
      return;
    }
    const ref = doc(this.firebase.firestore, 'universes', id, '_meta', CONFIG_DOC);
    const snap = await getDoc(ref);
    if (seq !== this.refreshSeq) return;
    this._config.set(
      snap.exists() ? (snap.data() as CodexCategoriesConfig) : EMPTY_CODEX_CATEGORIES_CONFIG,
    );
  }

  async save(next: CodexCategoriesConfig): Promise<void> {
    const id = this.requireUniverseId();
    const ref = doc(this.firebase.firestore, 'universes', id, '_meta', CONFIG_DOC);
    const data: CodexCategoriesConfig = { ...next, updatedAt: Date.now() };
    await setDoc(ref, data);
    await this.refresh(id);
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}
