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
import { Calendar, CalendarEra, CalendarMonth, EMPTY_CALENDAR } from './calendar.types';

const CALENDAR_DOC = 'calendar';

function errorMessage(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _calendar = signal<Calendar>(EMPTY_CALENDAR);
  readonly calendar: Signal<Calendar> = this._calendar.asReadonly();

  readonly eras = computed<CalendarEra[]>(() => this._calendar().eras);
  readonly months = computed<CalendarMonth[]>(() => this._calendar().months);

  readonly eraOrdinalById = computed(() => {
    const map = new Map<string, number>();
    this._calendar().eras.forEach((e, i) => map.set(e.id, i));
    return map;
  });

  readonly eraNameById = computed(() => {
    const map = new Map<string, string>();
    for (const e of this._calendar().eras) map.set(e.id, e.name);
    return map;
  });

  readonly monthNameByIndex = computed(() => {
    const map = new Map<number, string>();
    this._calendar().months.forEach((m, i) => map.set(i + 1, m.name));
    return map;
  });

  readonly eraOrdinalLookup = (id: string): number | undefined => this.eraOrdinalById().get(id);
  readonly eraNameLookup = (id: string): string | undefined => this.eraNameById().get(id);
  readonly monthNameLookup = (month: number): string | undefined =>
    this.monthNameByIndex().get(month);

  private readonly _refreshError = signal<string | null>(null);
  readonly refreshError: Signal<string | null> = this._refreshError.asReadonly();

  private refreshSeq = 0;

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const id = this.universes.activeUniverseId();
        if (!id) {
          this._calendar.set(EMPTY_CALENDAR);
          this._refreshError.set(null);
          return;
        }
        this._refreshError.set(null);
        this.refresh(id).catch((err) => {
          console.error('calendar refresh failed', err);
          this._refreshError.set(errorMessage(err));
        });
      });
    }
  }

  async refresh(universeId?: string): Promise<void> {
    const id = universeId ?? this.universes.activeUniverseId();
    const seq = ++this.refreshSeq;
    if (!id) {
      this._calendar.set(EMPTY_CALENDAR);
      return;
    }
    const ref = doc(this.firebase.firestore, 'universes', id, '_meta', CALENDAR_DOC);
    const snap = await getDoc(ref);
    if (seq !== this.refreshSeq) return;
    this._calendar.set(snap.exists() ? (snap.data() as Calendar) : EMPTY_CALENDAR);
  }

  async save(next: Calendar): Promise<void> {
    const id = this.requireUniverseId();
    const ref = doc(this.firebase.firestore, 'universes', id, '_meta', CALENDAR_DOC);
    const data: Calendar = { ...next, updatedAt: Date.now() };
    await setDoc(ref, data);
    await this.refresh(id);
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}
