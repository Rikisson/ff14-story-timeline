import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoriesService, Story, StoryContent } from '@features/stories';
import { ReaderStore } from './reader.store';

const sampleStory: Story = {
  id: 's1',
  slug: 'test',
  title: 'Test',
  inGameDate: {},
  authorUid: 'u1',
  draft: false,
  createdAt: 0,
};

const sampleContent: StoryContent = {
  defaultEntrySceneId: 'a',
  scenes: {
    a: { text: 'A', characters: [], position: { x: 0, y: 0 }, next: [{ sceneId: 'b' }, { sceneId: 'c' }] },
    b: { text: 'B', characters: [], position: { x: 100, y: 0 }, next: [{ sceneId: 'c' }], isEntry: true },
    c: { text: 'C', characters: [], position: { x: 200, y: 0 }, next: [] },
  },
};

function setup() {
  localStorage.clear();
  const mockStories = {
    getStoryWithContent: vi.fn(async () => ({
      story: structuredClone(sampleStory),
      content: structuredClone(sampleContent),
    })),
    getStory: vi.fn(),
    getStoryContent: vi.fn(),
    saveStory: vi.fn(),
    createDraftStory: vi.fn(),
    deleteStory: vi.fn(),
    refreshPublished: vi.fn(),
  };
  const mockTransloco = { translate: (key: string) => key };
  TestBed.configureTestingModule({
    providers: [
      ReaderStore,
      { provide: StoriesService, useValue: mockStories },
      { provide: TranslocoService, useValue: mockTransloco },
    ],
  });
  return { store: TestBed.inject(ReaderStore), mockStories };
}

describe('ReaderStore', () => {
  let store: ReturnType<typeof setup>['store'];

  beforeEach(async () => {
    ({ store } = setup());
    await store.loadStory('s1');
  });

  it('starts on the start scene with single-entry history', () => {
    expect(store.currentSceneId()).toBe('a');
    expect(store.history()).toEqual(['a']);
    expect(store.canGoBack()).toBe(false);
    expect(store.currentScene()?.text).toBe('A');
  });

  it('choose advances current scene and pushes onto history', () => {
    store.choose('b');
    expect(store.currentSceneId()).toBe('b');
    expect(store.history()).toEqual(['a', 'b']);
    expect(store.canGoBack()).toBe(true);
  });

  it('back pops the last history entry', () => {
    store.choose('b');
    store.back();
    expect(store.currentSceneId()).toBe('a');
    expect(store.history()).toEqual(['a']);
  });

  it('back is a no-op when history has only one entry', () => {
    store.back();
    expect(store.currentSceneId()).toBe('a');
    expect(store.history()).toEqual(['a']);
  });

  it('restart resets to the start scene', () => {
    store.choose('b');
    store.choose('c');
    store.restart();
    expect(store.currentSceneId()).toBe('a');
    expect(store.history()).toEqual(['a']);
    expect(store.resumedFromSave()).toBe(false);
  });

  it('saves progress to localStorage on choose and retains it at end-scene', () => {
    store.choose('b');
    expect(localStorage.getItem('ff14-story-timeline:reader:s1')).not.toBeNull();

    // Reaching an end-scene no longer auto-clears: the reader can hit
    // browser-back from a continuation and land where they were.
    store.choose('c'); // c has no next → end scene
    expect(localStorage.getItem('ff14-story-timeline:reader:s1')).not.toBeNull();
  });

  it('restart clears saved progress', () => {
    store.choose('b');
    expect(localStorage.getItem('ff14-story-timeline:reader:s1')).not.toBeNull();

    store.restart();
    expect(localStorage.getItem('ff14-story-timeline:reader:s1')).toBeNull();
  });

  it('auto-resumes to the saved scene on reload and flags resumedFromSave', async () => {
    store.choose('b');
    await store.loadStory('s1'); // simulates a fresh page load

    expect(store.currentSceneId()).toBe('b');
    expect(store.history()).toEqual(['a', 'b']);
    expect(store.resumedFromSave()).toBe(true);
  });

  it('clears resumedFromSave the first time the reader navigates after auto-resume', async () => {
    store.choose('b');
    await store.loadStory('s1');
    expect(store.resumedFromSave()).toBe(true);

    store.choose('c');
    expect(store.resumedFromSave()).toBe(false);
  });

  it('restart from the auto-resumed state clears progress and returns to start', async () => {
    store.choose('b');
    await store.loadStory('s1');
    store.restart();

    expect(store.currentSceneId()).toBe('a');
    expect(store.history()).toEqual(['a']);
    expect(store.resumedFromSave()).toBe(false);
    expect(localStorage.getItem('ff14-story-timeline:reader:s1')).toBeNull();
  });

  it('starts fresh at an explicit entry scene and persists the landing as progress', async () => {
    store.choose('c');
    await store.loadStory('s1', 'b');

    expect(store.currentSceneId()).toBe('b');
    expect(store.history()).toEqual(['b']);
    expect(store.resumedFromSave()).toBe(false);
    // landing IS the new reading position — the old save is replaced
    const saved = JSON.parse(localStorage.getItem('ff14-story-timeline:reader:s1') ?? '{}');
    expect(saved).toEqual({ sceneId: 'b', history: ['b'] });
  });

  it('resumes to the landed entry on a reload without the override', async () => {
    await store.loadStory('s1', 'b');
    await store.loadStory('s1'); // the URL param was consumed; plain reload

    expect(store.currentSceneId()).toBe('b');
    expect(store.history()).toEqual(['b']);
  });

  it('restores the saved history when the explicit entry matches the saved position', async () => {
    // The reader walked a → b → c (end scene), continued elsewhere, and
    // now comes back to the ending via the unified Back menu.
    store.choose('b');
    store.choose('c');
    await store.loadStory('s1', 'c');

    expect(store.currentSceneId()).toBe('c');
    expect(store.history()).toEqual(['a', 'b', 'c']);
    expect(store.canGoBack()).toBe(true);

    store.back();
    expect(store.currentSceneId()).toBe('b');
  });

  it('falls back to default-entry behavior for an unknown entry scene', async () => {
    await store.loadStory('s1', 'missing');

    expect(store.currentSceneId()).toBe('a');
    expect(store.history()).toEqual(['a']);
  });
});
