import { signalStore, withState } from '@ngrx/signals';
import { withReaderComputed } from './reader.computed';
import { withReaderMethods } from './reader.methods';
import { initialReaderState } from './reader.state';

export const ReaderStore = signalStore(
  withState(initialReaderState),
  withReaderComputed(),
  withReaderMethods(),
);
