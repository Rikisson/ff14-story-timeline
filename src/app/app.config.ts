import { registerLocaleData } from '@angular/common';
import localeUk from '@angular/common/locales/uk';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import { BrandTitleService, LocaleService } from '@shared/services';

import { routes } from './app.routes';
import { BundledTranslocoLoader } from './transloco-loader';

registerLocaleData(localeUk);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withEventReplay()),
    provideTransloco({
      config: {
        availableLangs: ['en', 'uk'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: BundledTranslocoLoader,
    }),
    provideTranslocoMessageformat(),
    provideAppInitializer(() => {
      inject(BrandTitleService);
    }),
    { provide: LOCALE_ID, useFactory: () => inject(LocaleService).active() },
  ],
};
