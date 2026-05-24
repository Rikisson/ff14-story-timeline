import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth';
import { Universe } from './universe.types';
import { UNIVERSE_CREATOR_UIDS } from './universe-creators';
import { UniversesService } from './universes.service';
import { UniverseStore } from './universe.store';

const CREATOR_UID = UNIVERSE_CREATOR_UIDS[0];

function makeUniverse(override: Partial<Universe> = {}): Universe {
  return {
    id: 'u1',
    slug: 'test',
    name: 'Test Universe',
    locale: 'en',
    authorUid: 'owner1',
    editorUids: [],
    deletedAt: null,
    storageBytes: 0,
    assetCount: 0,
    createdAt: 0,
    ...override,
  };
}

function setup(options: {
  uid?: string | null;
  universes?: Universe[];
  pending?: Universe[];
  storedActiveId?: string;
} = {}) {
  localStorage.clear();
  if (options.storedActiveId) {
    localStorage.setItem('ff14-story-timeline.activeUniverseId', options.storedActiveId);
  }

  // Start loading=true so the auth effect guard bails early; tests control refresh manually.
  const userSignal = signal<{ uid: string } | null>(
    options.uid ? { uid: options.uid } : null,
  );
  const loadingSignal = signal(true);
  const mockAuth = { user: userSignal, loading: loadingSignal };
  const mockService = {
    listAll: vi.fn(async () => options.universes ?? []),
    listPendingForAuthor: vi.fn(async () => options.pending ?? []),
  };

  TestBed.configureTestingModule({
    providers: [
      UniverseStore,
      { provide: AuthStore, useValue: mockAuth },
      { provide: UniversesService, useValue: mockService },
      { provide: PLATFORM_ID, useValue: 'browser' },
    ],
  });

  return {
    store: TestBed.inject(UniverseStore),
    mockService,
    userSignal,
  };
}

describe('UniverseStore', () => {
  beforeEach(() => TestBed.resetTestingModule());

  // ── setActive ────────────────────────────────────────────────────────────────

  describe('setActive', () => {
    it('updates activeUniverseId', () => {
      const { store } = setup();
      expect(store.activeUniverseId()).toBeNull();
      store.setActive('u1');
      expect(store.activeUniverseId()).toBe('u1');
    });

    it('clears activeUniverseId when set to null', () => {
      const { store } = setup();
      store.setActive('u1');
      store.setActive(null);
      expect(store.activeUniverseId()).toBeNull();
    });
  });

  // ── refresh ──────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('sets loading during fetch and clears it after', async () => {
      const { store } = setup({ universes: [makeUniverse()] });
      const p = store.refresh();
      expect(store.loading()).toBe(true);
      await p;
      expect(store.loading()).toBe(false);
    });

    it('populates universes from the service', async () => {
      const u = makeUniverse();
      const { store } = setup({ universes: [u] });
      await store.refresh();
      expect(store.universes()).toEqual([u]);
    });

    it('clears activeUniverseId when the active universe is no longer in the list', async () => {
      const { store } = setup({ universes: [] });
      store.setActive('gone');
      await store.refresh();
      expect(store.activeUniverseId()).toBeNull();
    });

    it('keeps activeUniverseId when the universe is still in the list', async () => {
      const u = makeUniverse({ id: 'u1' });
      const { store } = setup({ universes: [u] });
      store.setActive('u1');
      await store.refresh();
      expect(store.activeUniverseId()).toBe('u1');
    });

    it('sets an error message on failure', async () => {
      const { store, mockService } = setup();
      mockService.listAll.mockRejectedValueOnce(new Error('fetch failed'));
      await store.refresh();
      expect(store.error()).toContain('fetch failed');
      expect(store.loading()).toBe(false);
    });
  });

  // ── activeUniverse ───────────────────────────────────────────────────────────

  describe('activeUniverse', () => {
    it('returns null when no universe is active', async () => {
      const { store } = setup({ universes: [makeUniverse()] });
      await store.refresh();
      expect(store.activeUniverse()).toBeNull();
    });

    it('returns the matching universe when one is active', async () => {
      const u = makeUniverse({ id: 'u1' });
      const { store } = setup({ universes: [u] });
      await store.refresh();
      store.setActive('u1');
      expect(store.activeUniverse()).toEqual(u);
    });

    it('returns null when activeUniverseId does not match any loaded universe', async () => {
      const { store } = setup({ universes: [makeUniverse({ id: 'u1' })] });
      await store.refresh();
      store.setActive('other');
      expect(store.activeUniverse()).toBeNull();
    });
  });

  // ── myUniverses ──────────────────────────────────────────────────────────────

  describe('myUniverses', () => {
    it('returns empty when no user is signed in', async () => {
      const { store } = setup({ uid: null, universes: [makeUniverse()] });
      await store.refresh();
      expect(store.myUniverses()).toEqual([]);
    });

    it('returns universes the user owns', async () => {
      const u = makeUniverse({ authorUid: 'me' });
      const { store } = setup({ uid: 'me', universes: [u] });
      await store.refresh();
      expect(store.myUniverses()).toEqual([u]);
    });

    it('returns universes the user is an editor on', async () => {
      const u = makeUniverse({ authorUid: 'other', editorUids: ['me'] });
      const { store } = setup({ uid: 'me', universes: [u] });
      await store.refresh();
      expect(store.myUniverses()).toEqual([u]);
    });

    it('excludes universes the user has no role in', async () => {
      const u = makeUniverse({ authorUid: 'other', editorUids: [] });
      const { store } = setup({ uid: 'me', universes: [u] });
      await store.refresh();
      expect(store.myUniverses()).toEqual([]);
    });
  });

  // ── isMemberOfActive ─────────────────────────────────────────────────────────

  describe('isMemberOfActive', () => {
    it('returns false when no user is signed in', async () => {
      const u = makeUniverse({ id: 'u1' });
      const { store } = setup({ uid: null, universes: [u] });
      await store.refresh();
      store.setActive('u1');
      expect(store.isMemberOfActive()).toBe(false);
    });

    it('returns false when no universe is active', async () => {
      const { store } = setup({ uid: 'me', universes: [] });
      await store.refresh();
      expect(store.isMemberOfActive()).toBe(false);
    });

    it('returns true when the user is the owner', async () => {
      const u = makeUniverse({ id: 'u1', authorUid: 'me' });
      const { store } = setup({ uid: 'me', universes: [u] });
      await store.refresh();
      store.setActive('u1');
      expect(store.isMemberOfActive()).toBe(true);
    });

    it('returns true when the user is an editor', async () => {
      const u = makeUniverse({ id: 'u1', authorUid: 'other', editorUids: ['me'] });
      const { store } = setup({ uid: 'me', universes: [u] });
      await store.refresh();
      store.setActive('u1');
      expect(store.isMemberOfActive()).toBe(true);
    });

    it('returns false when the user has no role in the active universe', async () => {
      const u = makeUniverse({ id: 'u1', authorUid: 'other', editorUids: [] });
      const { store } = setup({ uid: 'me', universes: [u] });
      await store.refresh();
      store.setActive('u1');
      expect(store.isMemberOfActive()).toBe(false);
    });
  });

  // ── isOwnerOfActive ──────────────────────────────────────────────────────────

  describe('isOwnerOfActive', () => {
    it('returns false when no universe is active', async () => {
      const { store } = setup({ uid: 'me' });
      await store.refresh();
      expect(store.isOwnerOfActive()).toBe(false);
    });

    it('returns true when the user is the owner', async () => {
      const u = makeUniverse({ id: 'u1', authorUid: 'me' });
      const { store } = setup({ uid: 'me', universes: [u] });
      await store.refresh();
      store.setActive('u1');
      expect(store.isOwnerOfActive()).toBe(true);
    });

    it('returns false when the user is only an editor', async () => {
      const u = makeUniverse({ id: 'u1', authorUid: 'other', editorUids: ['me'] });
      const { store } = setup({ uid: 'me', universes: [u] });
      await store.refresh();
      store.setActive('u1');
      expect(store.isOwnerOfActive()).toBe(false);
    });
  });

  // ── canCreateUniverse ────────────────────────────────────────────────────────

  describe('canCreateUniverse', () => {
    it('returns false when no user is signed in', () => {
      const { store } = setup({ uid: null });
      expect(store.canCreateUniverse()).toBe(false);
    });

    it('returns false for a user not in the creator allowlist', () => {
      const { store } = setup({ uid: 'random-uid' });
      expect(store.canCreateUniverse()).toBe(false);
    });

    it('returns true for a user in the creator allowlist', () => {
      const { store } = setup({ uid: CREATOR_UID });
      expect(store.canCreateUniverse()).toBe(true);
    });
  });

  // ── refreshPending ───────────────────────────────────────────────────────────

  describe('refreshPending', () => {
    it('populates pendingForAuthor from the service', async () => {
      const u = makeUniverse({ id: 'p1', authorUid: 'me', deletedAt: 100 });
      const { store } = setup({ uid: 'me', pending: [u] });
      await store.refreshPending();
      expect(store.pendingForAuthor()).toEqual([u]);
    });

    it('clears pendingForAuthor when no user is signed in', async () => {
      const u = makeUniverse({ id: 'p1', authorUid: 'me', deletedAt: 100 });
      const { store } = setup({ uid: null, pending: [u] });
      await store.refreshPending();
      expect(store.pendingForAuthor()).toEqual([]);
    });

    it('falls back to empty on service failure', async () => {
      const { store, mockService } = setup({ uid: 'me' });
      mockService.listPendingForAuthor.mockRejectedValueOnce(new Error('boom'));
      await store.refreshPending();
      expect(store.pendingForAuthor()).toEqual([]);
    });
  });

  // ── localStorage persistence ─────────────────────────────────────────────────

  describe('localStorage', () => {
    it('restores activeUniverseId from localStorage on init', () => {
      const { store } = setup({ storedActiveId: 'restored' });
      expect(store.activeUniverseId()).toBe('restored');
    });

    it('persists activeUniverseId changes to localStorage', () => {
      const { store } = setup();
      store.setActive('u1');
      TestBed.flushEffects();
      expect(localStorage.getItem('ff14-story-timeline.activeUniverseId')).toBe('u1');
    });

    it('removes the localStorage entry when activeUniverseId is cleared', () => {
      const { store } = setup();
      store.setActive('u1');
      TestBed.flushEffects();
      store.setActive(null);
      TestBed.flushEffects();
      expect(localStorage.getItem('ff14-story-timeline.activeUniverseId')).toBeNull();
    });
  });
});
