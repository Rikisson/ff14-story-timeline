import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

import en from '../../public/i18n/en.json';
import uk from '../../public/i18n/uk.json';

const translations: Record<string, Translation> = { en, uk };

@Injectable({ providedIn: 'root' })
export class BundledTranslocoLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    return Promise.resolve(translations[lang] ?? translations['en']);
  }
}
