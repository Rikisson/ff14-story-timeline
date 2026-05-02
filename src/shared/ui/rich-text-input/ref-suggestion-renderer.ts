import { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { InlineRefOption } from '@shared/utils';
import { EntityRefAttrs } from './entity-ref-node';
import { buildEntityRefAttrs } from './ref-suggestion.extension';

const POPUP_CLASS =
  'fixed z-[9999] max-h-60 w-72 overflow-auto rounded-md border border-slate-300 bg-white p-1 text-sm shadow-lg';
const ITEM_BASE_CLASS =
  'flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left';
const ITEM_ACTIVE_CLASS = 'bg-indigo-100';

export function createSuggestionRender(): SuggestionOptions<
  InlineRefOption,
  EntityRefAttrs
>['render'] {
  return () => {
    let popup: HTMLDivElement | null = null;
    let items: InlineRefOption[] = [];
    let activeIndex = 0;
    let invoke: ((opt: InlineRefOption) => void) | null = null;

    function render() {
      if (!popup) return;
      popup.innerHTML = '';
      if (items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'm-0 px-2 py-1 italic text-slate-500';
        empty.textContent = 'No matches';
        popup.appendChild(empty);
        return;
      }
      items.forEach((it, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className =
          ITEM_BASE_CLASS + (i === activeIndex ? ' ' + ITEM_ACTIVE_CLASS : '');
        const label = document.createElement('span');
        label.className = 'flex-1 truncate text-slate-900';
        label.textContent = it.label;
        const tag = document.createElement('span');
        tag.className = 'shrink-0 font-mono text-xs text-slate-500';
        tag.textContent = it.slug ? `${kindBadge(it.kind)} · ${it.slug}` : kindBadge(it.kind);
        button.appendChild(label);
        button.appendChild(tag);
        button.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          invoke?.(it);
        });
        button.addEventListener('mouseenter', () => {
          activeIndex = i;
          render();
        });
        popup!.appendChild(button);
      });
    }

    function position(rect: DOMRect) {
      if (!popup) return;
      const top = rect.bottom + 4;
      const left = rect.left;
      popup.style.top = `${top}px`;
      popup.style.left = `${left}px`;
    }

    function ensurePopup() {
      if (popup) return;
      popup = document.createElement('div');
      popup.className = POPUP_CLASS;
      popup.setAttribute('role', 'listbox');
      document.body.appendChild(popup);
    }

    function destroyPopup() {
      if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
      popup = null;
    }

    return {
      onStart: (props: SuggestionProps<InlineRefOption, EntityRefAttrs>) => {
        ensurePopup();
        items = props.items;
        activeIndex = 0;
        invoke = (opt) => props.command(buildEntityRefAttrs(opt));
        const r = props.clientRect?.();
        if (r) position(r);
        render();
      },
      onUpdate: (props: SuggestionProps<InlineRefOption, EntityRefAttrs>) => {
        ensurePopup();
        items = props.items;
        if (activeIndex >= items.length) activeIndex = 0;
        invoke = (opt) => props.command(buildEntityRefAttrs(opt));
        const r = props.clientRect?.();
        if (r) position(r);
        render();
      },
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowDown') {
          if (items.length === 0) return true;
          activeIndex = (activeIndex + 1) % items.length;
          render();
          return true;
        }
        if (event.key === 'ArrowUp') {
          if (items.length === 0) return true;
          activeIndex = (activeIndex - 1 + items.length) % items.length;
          render();
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          if (items.length === 0) return true;
          const opt = items[activeIndex];
          if (opt && invoke) invoke(opt);
          return true;
        }
        if (event.key === 'Escape') {
          destroyPopup();
          return true;
        }
        return false;
      },
      onExit: () => {
        destroyPopup();
      },
    };
  };
}

function kindBadge(kind: InlineRefOption['kind']): string {
  switch (kind) {
    case 'character':
      return 'ch';
    case 'place':
      return 'pl';
    case 'event':
      return 'ev';
    case 'story':
      return 'st';
    case 'plotline':
      return 'pt';
    case 'item':
      return 'it';
    case 'faction':
      return 'fa';
    case 'codexEntry':
      return 'cx';
  }
}
