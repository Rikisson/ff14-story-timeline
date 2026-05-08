import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoriesService, Story, StoryContent } from '@features/stories';
import { PlayerStore } from './player.store';

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
  startSceneId: 'a',
  scenes: {
    a: { text: 'A', characters: [], position: { x: 0, y: 0 }, next: [{ sceneId: 'b' }, { sceneId: 'c' }] },
    b: { text: 'B', characters: [], position: { x: 100, y: 0 }, next: [{ sceneId: 'c' }] },
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
  TestBed.configureTestingModule({
    providers: [
      PlayerStore,
      { provide: StoriesService, useValue: mockStories },
    ],
  });
  return { store: TestBed.inject(PlayerStore), mockStories };
}

describe('PlayerStore', () => {
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
    expect(store.pendingResume()).toBeNull();
  });

  it('saves progress to localStorage on choose and clears it on end-scene', () => {
    store.choose('b');
    expect(localStorage.getItem('ff14-story-timeline:player:s1')).not.toBeNull();

    store.choose('c'); // c has no next → end scene
    expect(localStorage.getItem('ff14-story-timeline:player:s1')).toBeNull();
  });

  it('offers pendingResume when reloading mid-story', async () => {
    store.choose('b');
    await store.loadStory('s1'); // simulates a fresh page load

    expect(store.pendingResume()).toEqual({
      sceneId: 'b',
      history: ['a', 'b'],
    });
    expect(store.currentSceneId()).toBe('a'); // still on start until resume()
  });

  it('resume jumps to the saved scene and clears the pending banner', async () => {
    store.choose('b');
    await store.loadStory('s1');
    store.resume();

    expect(store.currentSceneId()).toBe('b');
    expect(store.history()).toEqual(['a', 'b']);
    expect(store.pendingResume()).toBeNull();
  });

  it('dismissResume clears pending and saved progress', async () => {
    store.choose('b');
    await store.loadStory('s1');
    store.dismissResume();

    expect(store.pendingResume()).toBeNull();
    expect(localStorage.getItem('ff14-story-timeline:player:s1')).toBeNull();
  });
});
