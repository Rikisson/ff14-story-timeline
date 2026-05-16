import { describe, expect, it } from 'vitest';
import { foldLabel } from './fold-label';

describe('foldLabel', () => {
  it('returns empty string for null / undefined / empty', () => {
    expect(foldLabel(null)).toBe('');
    expect(foldLabel(undefined)).toBe('');
    expect(foldLabel('')).toBe('');
  });

  it('lowercases ASCII letters', () => {
    expect(foldLabel('Hello World')).toBe('hello world');
  });

  it('strips combining diacritics from precomposed characters', () => {
    expect(foldLabel('Café')).toBe('cafe');
    expect(foldLabel('Naïve')).toBe('naive');
    expect(foldLabel('Mañana')).toBe('manana');
  });

  it('strips combining diacritics from decomposed input', () => {
    // `e` + COMBINING ACUTE ACCENT (U+0301)
    expect(foldLabel('Café')).toBe('cafe');
  });

  it('produces the same output for NFC- and NFD-normalised inputs', () => {
    const nfc = 'Crème'.normalize('NFC');
    const nfd = 'Crème'.normalize('NFD');
    expect(foldLabel(nfc)).toBe(foldLabel(nfd));
  });

  it('flattens NFKD-equivalent width variants', () => {
    // Fullwidth Latin "Ｈｅｌｌｏ" folds the same as ASCII "Hello"
    expect(foldLabel('Ｈｅｌｌｏ')).toBe('hello');
  });

  it('expands ligatures via NFKD then lowercases', () => {
    // U+FB01 ﬁ (Latin small ligature fi) decomposes to "fi" under NFKD
    expect(foldLabel('Ofﬁce')).toBe('office');
  });

  it('lowercases Cyrillic letters', () => {
    expect(foldLabel('Россия')).toBe('россия');
  });

  it('strips combining diacritics from Cyrillic letters (e.g. Ukrainian ї → і)', () => {
    // ї decomposes under NFKD into і + COMBINING DIAERESIS; the diaeresis
    // is stripped so a search without the dots still matches.
    expect(foldLabel('Київ')).toBe('киів');
  });

  it('preserves whitespace as written', () => {
    expect(foldLabel('  spaced  ')).toBe('  spaced  ');
  });

  it('preserves punctuation and digits', () => {
    expect(foldLabel('Items — Equipment 2')).toBe('items — equipment 2');
  });

  it('strips diacritics introduced by NFKD on precomposed letters', () => {
    // U+1E9E LATIN CAPITAL LETTER SHARP S — NFKD leaves it, then lowercase
    expect(foldLabel('Maße')).toBe('maße');
  });

  it('handles tonos / accent in Greek', () => {
    expect(foldLabel('Αθήνα')).toBe('αθηνα');
  });
});
