import { describe, expect, it } from 'vitest';
import { READER_ROUTES } from './reader.routes';

describe('READER_ROUTES', () => {
  it('nests the story and event pages under one session parent', () => {
    // A single parent route is what keeps `ReaderSessionPage` mounted
    // across story↔event navigation — flattening this would re-introduce
    // the fullscreen-drop bug.
    expect(READER_ROUTES).toHaveLength(1);

    const [session] = READER_ROUTES;
    expect(session.path).toBe('');
    expect(session.loadComponent).toBeTypeOf('function');

    const children = session.children ?? [];
    expect(children.map((route) => route.path)).toEqual(['story/:id', 'event/:id']);
    // Every reader route is lazy-loaded — guard the children too so a
    // switch to an eager `component:` import is caught.
    expect(children[0].loadComponent).toBeTypeOf('function');
    expect(children[1].loadComponent).toBeTypeOf('function');
  });
});
