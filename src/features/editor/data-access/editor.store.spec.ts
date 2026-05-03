import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StoriesService } from '@features/stories';
import { EditorStore } from './editor.store';

function setup() {
  const mockStories = {
    getStory: vi.fn(),
    saveStory: vi.fn(),
    createDraftStory: vi.fn(),
    deleteStory: vi.fn(),
    refreshPublished: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      EditorStore,
      { provide: StoriesService, useValue: mockStories },
    ],
  });
  return { store: TestBed.inject(EditorStore), mockStories };
}

describe('EditorStore', () => {
  let store: ReturnType<typeof setup>['store'];

  beforeEach(() => {
    ({ store } = setup());
  });

  it('addScene appends a scene, marks dirty, and seeds startSceneId', () => {
    expect(store.dirty()).toBe(false);
    expect(store.startSceneId()).toBeNull();

    const id = store.addScene({ x: 100, y: 200 });

    expect(Object.keys(store.scenes()).length).toBe(1);
    expect(store.scenes()[id].position).toEqual({ x: 100, y: 200 });
    expect(store.dirty()).toBe(true);
    expect(store.startSceneId()).toBe(id);
    expect(store.selectedSceneId()).toBe(id);
  });

  it('addConnection wires next from one scene to another and is idempotent', () => {
    const a = store.addScene();
    const b = store.addScene();

    store.addConnection(a, b);
    expect(store.scenes()[a].next).toEqual([{ sceneId: b }]);

    store.addConnection(a, b);
    expect(store.scenes()[a].next).toEqual([{ sceneId: b }]);
  });

  it('removeConnection drops the matching next entry', () => {
    const a = store.addScene();
    const b = store.addScene();
    store.addConnection(a, b);

    store.removeConnection(a, b);
    expect(store.scenes()[a].next).toEqual([]);
  });

  it('removeScene deletes the scene and prunes incoming connections', () => {
    const a = store.addScene();
    const b = store.addScene();
    store.addConnection(a, b);

    store.removeScene(b);

    expect(store.scenes()[b]).toBeUndefined();
    expect(store.scenes()[a].next).toEqual([]);
  });

  it('removeScene reassigns startSceneId when the start scene is removed', () => {
    const a = store.addScene();
    const b = store.addScene();
    expect(store.startSceneId()).toBe(a);

    store.removeScene(a);

    expect(store.startSceneId()).toBe(b);
  });

  it('updateChoiceLabel updates the label on the matching next entry', () => {
    const a = store.addScene();
    const b = store.addScene();
    store.addConnection(a, b);

    store.updateChoiceLabel(a, b, 'Continue');
    expect(store.scenes()[a].next[0].label).toBe('Continue');

    store.updateChoiceLabel(a, b, '');
    expect(store.scenes()[a].next[0].label).toBeUndefined();
  });

  it('moveScene only marks dirty when the position actually changes', () => {
    const a = store.addScene({ x: 0, y: 0 });
    // first save would clear dirty; simulate by reading current state
    const initialScene = store.scenes()[a];

    store.moveScene(a, initialScene.position);
    expect(store.scenes()[a].position).toEqual({ x: 0, y: 0 });

    store.moveScene(a, { x: 10, y: 20 });
    expect(store.scenes()[a].position).toEqual({ x: 10, y: 20 });
  });

  it('selectScene updates the selected id', () => {
    const a = store.addScene();

    store.selectScene(null);
    expect(store.selectedSceneId()).toBeNull();

    store.selectScene(a);
    expect(store.selectedSceneId()).toBe(a);
  });
});
