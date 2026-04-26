import { signalStore, withState } from '@ngrx/signals';
import { withPlayerComputed } from './player.computed';
import { withPlayerMethods } from './player.methods';
import { initialPlayerState } from './player.state';

export const PlayerStore = signalStore(
  withState(initialPlayerState),
  withPlayerComputed(),
  withPlayerMethods(),
);
