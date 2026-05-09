export { UniversesService } from './data-access/universes.service';
export { UniverseStore } from './data-access/universe.store';
export { universeGuard, editorGuard } from './data-access/universe.guard';
export { UNIVERSE_CREATOR_UIDS } from './data-access/universe-creators';
export { UniverseSelectorComponent } from './ui/universe-selector.component';
export { UNIVERSE_ROUTES } from './universes.routes';
export type {
  Universe,
  UniverseDraft,
  UniverseUpdate,
  StoredUniverse,
  UniverseLocale,
} from './data-access/universe.types';
export {
  SUPPORTED_UNIVERSE_LOCALES,
  DEFAULT_UNIVERSE_LOCALE,
} from './data-access/universe.types';
