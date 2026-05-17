import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { EntityKind } from '@shared/models';
import {
  INLINE_REF_KIND_BY_PREFIX,
  INLINE_REF_PREFIX_BY_KIND,
  InlineRefKindPrefix,
  InlineRefOption,
} from '@shared/utils';
import { EntityRefAttrs } from './entity-ref-node';

export interface RefSuggestionState {
  optionsRef: { current: InlineRefOption[] };
  render: () => SuggestionOptions<InlineRefOption, EntityRefAttrs>['render'] extends infer T
    ? T
    : never;
}

const KIND_PREFIXES: InlineRefKindPrefix[] = Object.values(INLINE_REF_PREFIX_BY_KIND);
const MAX_RESULTS = 8;

function parseQuery(query: string): { kind: EntityKind | null; filter: string } {
  const head = query.slice(0, 2).toLowerCase();
  if (KIND_PREFIXES.includes(head as InlineRefKindPrefix)) {
    return {
      kind: INLINE_REF_KIND_BY_PREFIX[head as InlineRefKindPrefix],
      filter: query.slice(2),
    };
  }
  return { kind: null, filter: query };
}

function filterOptions(query: string, options: InlineRefOption[]): InlineRefOption[] {
  const { kind, filter } = parseQuery(query);
  const lower = filter.toLowerCase();
  return options
    .filter((o) => {
      if (kind !== null && o.kind !== kind) return false;
      if (!lower) return true;
      return (
        o.label.toLowerCase().includes(lower) ||
        (o.slug?.toLowerCase().includes(lower) ?? false)
      );
    })
    .slice(0, MAX_RESULTS);
}

export const REF_SUGGESTION_KEY = new PluginKey('refSuggestion');

export type FetchInlineRefOptions = (
  query: string,
  kind: EntityKind | null,
  filter: string,
) => Promise<InlineRefOption[]>;

export interface RefSuggestionConfig {
  /**
   * Optional async fetcher consulted on every keystroke. Returns up to
   * `MAX_RESULTS` options. When provided, takes priority over
   * `optionsRef`. Per `docs/backend-rules.md` *Inline-ref resolution*,
   * the canonical fetcher routes through `EntityDirectoryService` so the
   * suggestion popup doesn't depend on universe-wide preloads.
   */
  fetchOptions?: FetchInlineRefOptions;
  /**
   * Legacy synchronous source — pre-loaded inline-ref options. Used as a
   * fallback when `fetchOptions` is unset (e.g. tests, the player bridge
   * during Phase 2). New callers should set `fetchOptions` instead.
   */
  optionsRef: { current: InlineRefOption[] };
  renderFactory: () => SuggestionOptions<InlineRefOption, EntityRefAttrs>['render'];
}

export const RefSuggestion = Extension.create<RefSuggestionConfig>({
  name: 'refSuggestion',

  addOptions() {
    return {
      fetchOptions: undefined,
      optionsRef: { current: [] },
      renderFactory: () => () => ({}),
    };
  },

  addProseMirrorPlugins() {
    const optionsRef = this.options.optionsRef;
    const fetchOptions = this.options.fetchOptions;
    return [
      Suggestion<InlineRefOption, EntityRefAttrs>({
        editor: this.editor,
        char: '${',
        pluginKey: REF_SUGGESTION_KEY,
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => {
          if (fetchOptions) {
            const { kind, filter } = parseQuery(query);
            return fetchOptions(query, kind, filter)
              .then((opts) => opts.slice(0, MAX_RESULTS))
              .catch(() => []);
          }
          return filterOptions(query, optionsRef.current);
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: 'entityRef', attrs: props },
              { type: 'text', text: ' ' },
            ])
            .run();
        },
        render: this.options.renderFactory(),
      }),
    ];
  },
});

export function buildEntityRefAttrs(option: InlineRefOption): EntityRefAttrs {
  return { kind: option.kind, id: option.id, displayText: option.label };
}

export { filterOptions };
