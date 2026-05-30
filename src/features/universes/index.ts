export { UniversesService } from './data-access/universes.service';
export { UniverseStore } from './data-access/universe.store';
export { UniverseDeletionService } from './data-access/universe-deletion.service';
export type {
  DeletionProgress,
  DeletionPhase,
} from './data-access/universe-deletion.service';
export { universeGuard, editorGuard } from './data-access/universe.guard';
export { UniverseDetailComponent } from './ui/universe-detail.component';
export { UniverseFormComponent } from './ui/universe-form.component';
export { ContentLangDirective } from './ui/content-lang.directive';
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
