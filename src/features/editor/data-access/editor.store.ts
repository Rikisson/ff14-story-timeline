import { signalStore, withState } from '@ngrx/signals';
import { withEditorComputed } from './editor.computed';
import { withEditorMethods } from './editor.methods';
import { initialEditorState } from './editor.state';

export const EditorStore = signalStore(
  withState(initialEditorState),
  withEditorComputed(),
  withEditorMethods(),
);
