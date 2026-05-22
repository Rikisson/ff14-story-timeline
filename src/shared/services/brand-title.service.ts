import { effect, inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { LOCALE_META } from './locale-meta';
import { LocaleService } from './locale.service';

@Injectable({ providedIn: 'root' })
export class BrandTitleService {
  private readonly title = inject(Title);
  private readonly locale = inject(LocaleService);

  constructor() {
    effect(() => {
      this.title.setTitle(LOCALE_META[this.locale.active()].brand);
    });
  }
}
