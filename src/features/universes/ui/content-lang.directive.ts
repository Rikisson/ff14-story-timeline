import { Directive, computed, inject } from '@angular/core';
import { UniverseStore } from '../data-access/universe.store';
import { DEFAULT_UNIVERSE_LOCALE } from '../data-access/universe.types';

/**
 * Tags the host element with `lang` set to the active universe's
 * content locale. Apply on any element whose visible text is
 * authored prose (entity descriptions, scene text, story summaries,
 * codex bodies, Tiptap edit surfaces). Children inherit the language
 * via DOM inheritance, so chrome inside the same card should sit
 * outside the tagged element.
 */
@Directive({
  selector: '[appContentLang]',
  host: { '[attr.lang]': 'contentLang()' },
})
export class ContentLangDirective {
  private readonly store = inject(UniverseStore);

  protected readonly contentLang = computed(
    () => this.store.activeUniverse()?.locale ?? DEFAULT_UNIVERSE_LOCALE,
  );
}
