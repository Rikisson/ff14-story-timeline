import { EntityKind, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@shared/models';
import { ARCHIVE_ENTITY_KINDS, FORMAT_VERSION } from './archive-format';
import { IssueSeverity, ValidationIssue } from './dry-run-report.types';

const BACKGROUND_EFFECTS = ['darken', 'desaturate', 'sepia', 'cool', 'warm'];
const TEXT_SPEEDS = ['slow', 'normal', 'fast', 'instant'];
const BGM_TRANSITIONS = ['crossfade', 'cut'];
const SCENE_LAYOUTS = ['dialog', 'showcase'];
const SCENE_TRANSITIONS = ['crossfade', 'fade-through-black'];
const FACINGS = ['left', 'right'];
const PLOTLINE_STATUSES = ['planned', 'active', 'resolved'];
const ASSET_KINDS = ['cover', 'sprite', 'background', 'ambient', 'sfx'];
const LOCALES = ['en', 'uk'];
const CONNECTION_VISIBILITIES = ['editor', 'reader'];
const SERVER_FIELDS = [
  'id',
  'authorUid',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'version',
  'sourceFingerprint',
];

// Firestore caps a document at 1 MiB; a story's scenes become one `_content/main`
// doc. Block well before the cap so the slug-to-id token rewrite has headroom.
const STORY_CONTENT_MAX_BYTES = 900_000;

export function validateStructure(raw: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(raw)) {
    issues.push(err('root', 'root-not-object', 'The archive must be a JSON object.'));
    return issues;
  }

  validateFormatVersion(raw['formatVersion'], issues);

  if (raw['universe'] !== undefined) validateUniverse(raw['universe'], issues);
  if (raw['calendar'] !== undefined) validateCalendar(raw['calendar'], issues);
  if (raw['codexCategories'] !== undefined) validateCategories(raw['codexCategories'], issues);
  if (raw['assets'] !== undefined) validateAssets(raw['assets'], issues);

  validateSection(raw['characters'], 'characters', issues, validateCharacter);
  validateSection(raw['places'], 'places', issues, validatePlace);
  validateSection(raw['plotlines'], 'plotlines', issues, validatePlotline);
  validateSection(raw['events'], 'events', issues, validateEvent);
  validateSection(raw['codexEntries'], 'codexEntries', issues, validateCodexEntry);
  validateSection(raw['stories'], 'stories', issues, validateStory);
  validateConnections(raw['connections'], issues);

  return issues;
}

function validateConnections(value: unknown, issues: ValidationIssue[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push(err('connections', 'connections-not-array', '"connections" must be an array.'));
    return;
  }
  value.forEach((entry, index) => validateConnection(entry, `connections[${index}]`, issues));
}

function validateConnection(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(err(path, 'connection-not-object', `${path} must be an object.`));
    return;
  }
  if (value['type'] !== 'continues') {
    issues.push(
      err(`${path}.type`, 'connection-type-unsupported', `${path}.type must be "continues".`),
    );
  }
  checkEnum(value['visibility'], CONNECTION_VISIBILITIES, `${path}.visibility`, issues);
  optString(value, 'note', path, issues);
  optString(value, 'snapshotTitle', path, issues);
  validateConnectionEndpoint(value['from'], `${path}.from`, issues, true);
  if (value['to'] === undefined) {
    issues.push(
      err(`${path}.to`, 'connection-to-missing', `${path}.to is required (an endpoint or null).`),
    );
  } else if (value['to'] !== null) {
    validateConnectionEndpoint(value['to'], `${path}.to`, issues, false);
  }
}

function validateConnectionEndpoint(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  requireScene: boolean,
): void {
  if (!isRecord(value)) {
    issues.push(err(path, 'connection-endpoint-not-object', `${path} must be an object.`));
    return;
  }
  const kind = value['kind'];
  if (kind === 'story') {
    reqString(value, 'story', path, issues);
    if (requireScene) reqString(value, 'scene', path, issues);
    else optString(value, 'scene', path, issues);
  } else if (kind === 'event') {
    reqString(value, 'event', path, issues);
  } else {
    issues.push(
      err(
        `${path}.kind`,
        'connection-endpoint-kind',
        `${path}.kind must be "story" or "event".`,
      ),
    );
  }
}

function validateFormatVersion(value: unknown, issues: ValidationIssue[]): void {
  if (value === undefined) {
    issues.push(
      err('formatVersion', 'format-version-missing', 'The archive is missing "formatVersion".'),
    );
    return;
  }
  if (typeof value !== 'number' || value !== FORMAT_VERSION) {
    issues.push(
      err(
        'formatVersion',
        'format-version-unsupported',
        `Unsupported formatVersion. This app reads version ${FORMAT_VERSION}.`,
      ),
    );
  }
}

function validateUniverse(value: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(err('universe', 'universe-not-object', '"universe" must be an object.'));
    return;
  }
  reqString(value, 'name', 'universe', issues);
  optString(value, 'description', 'universe', issues);
  optString(value, 'coverAsset', 'universe', issues);
  if (value['slug'] !== undefined) checkSlug(value['slug'], 'universe.slug', issues);
  if (value['locale'] !== undefined) {
    checkEnum(value['locale'], LOCALES, 'universe.locale', issues);
  }
}

function validateCalendar(value: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(err('calendar', 'calendar-not-object', '"calendar" must be an object.'));
    return;
  }
  const eras = value['eras'];
  if (!Array.isArray(eras)) {
    issues.push(
      err('calendar.eras', 'calendar-eras-not-array', '"calendar.eras" must be an array.'),
    );
  } else {
    eras.forEach((era, index) => {
      const path = `calendar.eras[${index}]`;
      if (!isRecord(era)) {
        issues.push(err(path, 'era-not-object', `${path} must be an object.`));
        return;
      }
      reqString(era, 'name', path, issues);
      checkSlug(era['slug'], `${path}.slug`, issues);
      optNumber(era, 'maxYears', path, issues);
      optNumber(era, 'hoursPerDay', path, issues);
      optNumber(era, 'minutesPerHour', path, issues);
      optNumber(era, 'secondsPerMinute', path, issues);
      optBoolean(era, 'resetsWeek', path, issues);
    });
  }
  const months = value['months'];
  if (!Array.isArray(months)) {
    issues.push(
      err('calendar.months', 'calendar-months-not-array', '"calendar.months" must be an array.'),
    );
  } else {
    months.forEach((month, index) => {
      const path = `calendar.months[${index}]`;
      if (!isRecord(month)) {
        issues.push(err(path, 'month-not-object', `${path} must be an object.`));
        return;
      }
      reqString(month, 'name', path, issues);
      if (typeof month['days'] !== 'number' || month['days'] <= 0) {
        issues.push(
          err(`${path}.days`, 'month-bad-days', `${path}.days must be a positive number.`),
        );
      }
    });
  }
  if (value['weekdays'] !== undefined) {
    if (!Array.isArray(value['weekdays'])) {
      issues.push(
        err(
          'calendar.weekdays',
          'calendar-weekdays-not-array',
          '"calendar.weekdays" must be an array.',
        ),
      );
    } else {
      value['weekdays'].forEach((weekday, index) => {
        const path = `calendar.weekdays[${index}]`;
        if (!isRecord(weekday)) {
          issues.push(err(path, 'weekday-not-object', `${path} must be an object.`));
          return;
        }
        reqString(weekday, 'name', path, issues);
        optString(weekday, 'short', path, issues);
      });
    }
  }
}

function validateCategories(value: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(
      err('codexCategories', 'categories-not-array', '"codexCategories" must be an array.'),
    );
    return;
  }
  const keys = new Set<string>();
  value.forEach((category, index) => {
    const path = `codexCategories[${index}]`;
    if (!isRecord(category)) {
      issues.push(err(path, 'category-not-object', `${path} must be an object.`));
      return;
    }
    reqString(category, 'label', path, issues);
    optString(category, 'color', path, issues);
    optString(category, 'description', path, issues);
    if (checkSlug(category['key'], `${path}.key`, issues)) {
      const key = category['key'] as string;
      if (keys.has(key)) {
        issues.push(
          err(`${path}.key`, 'category-key-duplicate', `Duplicate category key "${key}".`),
        );
      }
      keys.add(key);
    }
  });
}

function validateAssets(value: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(err('assets', 'assets-not-array', '"assets" must be an array.'));
    return;
  }
  const slugs = new Set<string>();
  value.forEach((asset, index) => {
    const path = `assets[${index}]`;
    if (!isRecord(asset)) {
      issues.push(err(path, 'asset-not-object', `${path} must be an object.`));
      return;
    }
    reqString(asset, 'label', path, issues);
    optString(asset, 'file', path, issues);
    optString(asset, 'thumbFile', path, issues);
    optString(asset, 'blurDataUrl', path, issues);
    checkEnum(asset['kind'], ASSET_KINDS, `${path}.kind`, issues);
    optStringArray(asset, 'tags', path, issues);
    if (checkSlug(asset['slug'], `${path}.slug`, issues)) {
      const slug = asset['slug'] as string;
      if (slugs.has(slug)) {
        issues.push(err(`${path}.slug`, 'asset-slug-duplicate', `Duplicate asset slug "${slug}".`));
      }
      slugs.add(slug);
    }
  });
}

function validateSection(
  value: unknown,
  section: string,
  issues: ValidationIssue[],
  validateEntity: (
    entity: Record<string, unknown>,
    path: string,
    issues: ValidationIssue[],
  ) => void,
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push(err(section, 'section-not-array', `"${section}" must be an array.`));
    return;
  }
  const slugs = new Set<string>();
  value.forEach((entity, index) => {
    const path = `${section}[${index}]`;
    if (!isRecord(entity)) {
      issues.push(err(path, 'entity-not-object', `${path} must be an object.`));
      return;
    }
    if (checkSlug(entity['slug'], `${path}.slug`, issues)) {
      const slug = entity['slug'] as string;
      if (slugs.has(slug)) {
        issues.push(
          err(
            `${path}.slug`,
            'slug-duplicate',
            `Duplicate ${section} slug "${slug}" within the file.`,
          ),
        );
      }
      slugs.add(slug);
    }
    flagServerFields(entity, path, issues);
    validateEntity(entity, path, issues);
  });
}

function validateCharacter(
  entity: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): void {
  reqString(entity, 'name', path, issues);
  optString(entity, 'description', path, issues);
  optString(entity, 'coverAsset', path, issues);
  optStringArray(entity, 'sprites', path, issues);
  checkRefArray(entity['relatedRefs'], `${path}.relatedRefs`, issues);
}

function validatePlace(
  entity: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): void {
  reqString(entity, 'name', path, issues);
  optString(entity, 'description', path, issues);
  optString(entity, 'coverAsset', path, issues);
  optStringArray(entity, 'backgrounds', path, issues);
  optStringArray(entity, 'ambientAudio', path, issues);
  checkRefArray(entity['relatedRefs'], `${path}.relatedRefs`, issues);
}

function validatePlotline(
  entity: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): void {
  reqString(entity, 'title', path, issues);
  optString(entity, 'description', path, issues);
  optString(entity, 'coverAsset', path, issues);
  optString(entity, 'color', path, issues);
  if (entity['status'] !== undefined) {
    checkEnum(entity['status'], PLOTLINE_STATUSES, `${path}.status`, issues);
  }
  checkRefArray(entity['members'], `${path}.members`, issues, ['story', 'event']);
}

function validateEvent(
  entity: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): void {
  reqString(entity, 'name', path, issues);
  reqString(entity, 'description', path, issues);
  optString(entity, 'coverAsset', path, issues);
  optString(entity, 'bgmAsset', path, issues);
  if (entity['backgroundEffect'] !== undefined) {
    checkEnum(entity['backgroundEffect'], BACKGROUND_EFFECTS, `${path}.backgroundEffect`, issues);
  }
  validateInGameDate(entity['inGameDate'], `${path}.inGameDate`, issues, true);
  checkRefArray(entity['relatedRefs'], `${path}.relatedRefs`, issues);
}

function validateCodexEntry(
  entity: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): void {
  reqString(entity, 'title', path, issues);
  reqString(entity, 'description', path, issues);
  optString(entity, 'category', path, issues);
  optString(entity, 'coverAsset', path, issues);
  checkRefArray(entity['relatedRefs'], `${path}.relatedRefs`, issues);
}

function validateStory(
  entity: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): void {
  reqString(entity, 'title', path, issues);
  optString(entity, 'description', path, issues);
  optString(entity, 'coverAsset', path, issues);
  optString(entity, 'bgmAsset', path, issues);
  optBoolean(entity, 'draft', path, issues);
  validateInGameDate(entity['inGameDate'], `${path}.inGameDate`, issues, true);
  checkRefArray(entity['relatedRefs'], `${path}.relatedRefs`, issues);

  const scenes = entity['scenes'];
  const sceneKeys = new Set<string>();
  if (!isRecord(scenes) || Object.keys(scenes).length === 0) {
    issues.push(
      err(`${path}.scenes`, 'story-no-scenes', `${path}.scenes must be a non-empty object.`),
    );
  } else {
    for (const key of Object.keys(scenes)) {
      if (key.trim().length === 0) {
        issues.push(err(`${path}.scenes`, 'scene-key-empty', `${path} has an empty scene key.`));
        continue;
      }
      sceneKeys.add(key);
      validateScene(scenes[key], `${path}.scenes.${key}`, issues);
    }
  }

  const defaultEntryScene = entity['defaultEntryScene'];
  if (typeof defaultEntryScene !== 'string' || defaultEntryScene.length === 0) {
    issues.push(
      err(
        `${path}.defaultEntryScene`,
        'default-entry-scene-missing',
        `${path}.defaultEntryScene is required.`,
      ),
    );
  } else if (sceneKeys.size > 0 && !sceneKeys.has(defaultEntryScene)) {
    issues.push(
      err(
        `${path}.defaultEntryScene`,
        'default-entry-scene-unknown',
        `${path}.defaultEntryScene "${defaultEntryScene}" is not a defined scene.`,
      ),
    );
  }

  if (isRecord(scenes)) {
    const sceneBytes = new TextEncoder().encode(JSON.stringify(scenes)).length;
    if (sceneBytes > STORY_CONTENT_MAX_BYTES) {
      issues.push(
        err(
          `${path}.scenes`,
          'story-too-large',
          `${path} has ${Math.round(sceneBytes / 1024)} KB of scene content, above the ` +
            `~${Math.round(STORY_CONTENT_MAX_BYTES / 1024)} KB limit. Split it into shorter stories.`,
        ),
      );
    }
    for (const key of sceneKeys) {
      const scene = scenes[key];
      if (!isRecord(scene) || !Array.isArray(scene['next'])) continue;
      scene['next'].forEach((branch, index) => {
        if (!isRecord(branch)) return;
        const target = branch['scene'];
        if (typeof target === 'string' && !sceneKeys.has(target)) {
          issues.push(
            err(
              `${path}.scenes.${key}.next[${index}].scene`,
              'next-scene-unknown',
              `Scene "${key}" links to unknown scene "${target}".`,
            ),
          );
        }
      });
    }
  }
}

function validateScene(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(err(path, 'scene-not-object', `${path} must be an object.`));
    return;
  }
  if (typeof value['text'] !== 'string') {
    issues.push(err(`${path}.text`, 'scene-text-missing', `${path}.text must be a string.`));
  }
  optString(value, 'label', path, issues);
  optString(value, 'backgroundAsset', path, issues);
  optString(value, 'sfxAsset', path, issues);
  optString(value, 'bgmAsset', path, issues);
  optBoolean(value, 'bgmSilence', path, issues);
  optBoolean(value, 'isEntry', path, issues);
  optNumber(value, 'transitionMs', path, issues);

  if (value['backgroundEffect'] !== undefined) {
    checkEnum(value['backgroundEffect'], BACKGROUND_EFFECTS, `${path}.backgroundEffect`, issues);
  }
  if (value['bgmTransition'] !== undefined) {
    checkEnum(value['bgmTransition'], BGM_TRANSITIONS, `${path}.bgmTransition`, issues);
  }
  if (value['textSpeed'] !== undefined) {
    checkEnum(value['textSpeed'], TEXT_SPEEDS, `${path}.textSpeed`, issues);
  }
  if (value['layout'] !== undefined) {
    checkEnum(value['layout'], SCENE_LAYOUTS, `${path}.layout`, issues);
  }
  if (value['transition'] !== undefined) {
    checkEnum(value['transition'], SCENE_TRANSITIONS, `${path}.transition`, issues);
  }

  const speaker = value['speaker'];
  if (speaker !== undefined && typeof speaker !== 'string') {
    checkRef(speaker, `${path}.speaker`, issues, ['character']);
  }
  if (value['place'] !== undefined) {
    checkRef(value['place'], `${path}.place`, issues, ['place']);
  }

  const characters = value['characters'];
  if (characters !== undefined) {
    if (!Array.isArray(characters)) {
      issues.push(
        err(
          `${path}.characters`,
          'scene-characters-not-array',
          `${path}.characters must be an array.`,
        ),
      );
    } else {
      characters.forEach((staged, index) =>
        validateStagedCharacter(staged, `${path}.characters[${index}]`, issues),
      );
    }
  }

  const next = value['next'];
  if (!Array.isArray(next)) {
    issues.push(err(`${path}.next`, 'scene-next-not-array', `${path}.next must be an array.`));
  } else {
    next.forEach((branch, index) => {
      const branchPath = `${path}.next[${index}]`;
      if (!isRecord(branch)) {
        issues.push(err(branchPath, 'next-not-object', `${branchPath} must be an object.`));
        return;
      }
      if (typeof branch['scene'] !== 'string' || branch['scene'].length === 0) {
        issues.push(
          err(`${branchPath}.scene`, 'next-scene-missing', `${branchPath}.scene is required.`),
        );
      }
      optString(branch, 'label', branchPath, issues);
    });
  }

  const position = value['position'];
  if (position !== undefined) {
    if (
      !isRecord(position) ||
      typeof position['x'] !== 'number' ||
      typeof position['y'] !== 'number'
    ) {
      issues.push(
        err(`${path}.position`, 'scene-bad-position', `${path}.position must be { x, y } numbers.`),
      );
    }
  }
}

function validateStagedCharacter(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(err(path, 'staged-not-object', `${path} must be an object.`));
    return;
  }
  checkRef(value['entity'], `${path}.entity`, issues, ['character']);
  if (typeof value['position'] !== 'string' || value['position'].length === 0) {
    issues.push(
      err(`${path}.position`, 'staged-position-missing', `${path}.position is required.`),
    );
  }
  optNumber(value, 'order', path, issues);
  optString(value, 'sprite', path, issues);
  if (value['facing'] !== undefined) {
    checkEnum(value['facing'], FACINGS, `${path}.facing`, issues);
  }
}

function validateInGameDate(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  required: boolean,
): void {
  if (value === undefined) {
    if (required) issues.push(err(path, 'date-missing', `${path} is required.`));
    return;
  }
  if (!isRecord(value)) {
    issues.push(err(path, 'date-not-object', `${path} must be an object.`));
    return;
  }
  optString(value, 'era', path, issues);
  optString(value, 'display', path, issues);
  for (const field of ['year', 'month', 'day', 'hour', 'minute', 'second']) {
    optNumber(value, field, path, issues);
  }
}

function checkRefArray(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  allowedKinds?: readonly EntityKind[],
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push(err(path, 'refs-not-array', `${path} must be an array.`));
    return;
  }
  value.forEach((ref, index) => checkRef(ref, `${path}[${index}]`, issues, allowedKinds));
}

function checkRef(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  allowedKinds?: readonly EntityKind[],
): void {
  if (!isRecord(value)) {
    issues.push(err(path, 'ref-not-object', `${path} must be a { kind, ref } object.`));
    return;
  }
  const kind = value['kind'];
  if (!isEntityKind(kind)) {
    issues.push(
      err(
        `${path}.kind`,
        'ref-bad-kind',
        `${path}.kind must be one of: ${ARCHIVE_ENTITY_KINDS.join(', ')}.`,
      ),
    );
  } else if (allowedKinds && !allowedKinds.includes(kind)) {
    issues.push(
      err(`${path}.kind`, 'ref-wrong-kind', `${path}.kind must be ${allowedKinds.join(' or ')}.`),
    );
  }
  if (typeof value['ref'] !== 'string' || value['ref'].length === 0) {
    issues.push(err(`${path}.ref`, 'ref-bad-slug', `${path}.ref must be a non-empty slug.`));
  }
}

function checkSlug(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(err(path, 'slug-missing', `${path} is required and must be a slug.`));
    return false;
  }
  if (value.length > SLUG_MAX_LENGTH) {
    issues.push(
      err(path, 'slug-too-long', `${path} must be at most ${SLUG_MAX_LENGTH} characters.`),
    );
    return false;
  }
  if (!SLUG_PATTERN.test(value)) {
    issues.push(
      err(
        path,
        'slug-invalid',
        `${path} "${value}" must be lowercase letters, digits, and hyphens.`,
      ),
    );
    return false;
  }
  return true;
}

function checkEnum(
  value: unknown,
  allowed: readonly string[],
  path: string,
  issues: ValidationIssue[],
): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    issues.push(err(path, 'bad-enum', `${path} must be one of: ${allowed.join(', ')}.`));
  }
}

function reqString(
  rec: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const value = rec[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(err(`${path}.${key}`, 'field-required', `${path} is missing a "${key}" value.`));
  }
}

function optString(
  rec: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const value = rec[key];
  if (value !== undefined && typeof value !== 'string') {
    issues.push(err(`${path}.${key}`, 'field-type', `${path}.${key} must be a string.`));
  }
}

function optNumber(
  rec: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const value = rec[key];
  if (value !== undefined && typeof value !== 'number') {
    issues.push(err(`${path}.${key}`, 'field-type', `${path}.${key} must be a number.`));
  }
}

function optBoolean(
  rec: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const value = rec[key];
  if (value !== undefined && typeof value !== 'boolean') {
    issues.push(err(`${path}.${key}`, 'field-type', `${path}.${key} must be true or false.`));
  }
}

function optStringArray(
  rec: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const value = rec[key];
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    issues.push(err(`${path}.${key}`, 'field-type', `${path}.${key} must be an array of strings.`));
  }
}

function flagServerFields(
  entity: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): void {
  const present = SERVER_FIELDS.filter((field) => entity[field] !== undefined);
  if (present.length > 0) {
    issues.push(
      issue(
        'info',
        path,
        'server-fields-ignored',
        `${path}: ignoring server-managed fields (${present.join(', ')}).`,
      ),
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEntityKind(value: unknown): value is EntityKind {
  return typeof value === 'string' && (ARCHIVE_ENTITY_KINDS as readonly string[]).includes(value);
}

function issue(
  severity: IssueSeverity,
  path: string,
  code: string,
  message: string,
  hint?: string,
): ValidationIssue {
  return hint ? { severity, code, path, message, hint } : { severity, code, path, message };
}

function err(path: string, code: string, message: string, hint?: string): ValidationIssue {
  return issue('error', path, code, message, hint);
}
