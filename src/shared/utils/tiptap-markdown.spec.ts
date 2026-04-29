import { markdownToTiptapHtml, tiptapJsonToMarkdown } from './tiptap-markdown';

describe('markdownToTiptapHtml', () => {
  it('returns empty string for empty input', () => {
    expect(markdownToTiptapHtml('')).toBe('');
  });

  it('emits entity-ref spans with data attributes', () => {
    const html = markdownToTiptapHtml('Met ${ch:abc}[Alphinaud].');
    expect(html).toContain('data-entity-ref=""');
    expect(html).toContain('data-kind="character"');
    expect(html).toContain('data-id="abc"');
    expect(html).toContain('>Alphinaud</span>');
  });

  it('renders bold/italic/list markup that TipTap accepts', () => {
    const html = markdownToTiptapHtml('**bold** *italic*\n\n- one\n- two');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<ul>');
    expect(html).toMatch(/<li>\s*one\s*<\/li>/);
  });

  it('escapes html in display text', () => {
    const html = markdownToTiptapHtml('${ch:abc}[<x>]');
    expect(html).toContain('data-id="abc"');
    expect(html).toContain('&lt;x&gt;');
    expect(html).not.toContain('<x>');
  });
});

describe('tiptapJsonToMarkdown', () => {
  it('serializes a paragraph with bold + italic + entity ref', () => {
    const md = tiptapJsonToMarkdown({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: '. Met ' },
            {
              type: 'entityRef',
              attrs: { kind: 'character', id: 'abc', displayText: 'Al' },
            },
            { type: 'text', text: '.' },
          ],
        },
      ],
    });
    expect(md).toBe(
      'Hello **bold** and *italic*\\. Met ${ch:abc}[Al]\\.',
    );
  });

  it('serializes a bullet list', () => {
    const md = tiptapJsonToMarkdown({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] },
          ],
        },
      ],
    });
    expect(md).toBe('- one\n- two');
  });

  it('separates paragraphs with a blank line', () => {
    const md = tiptapJsonToMarkdown({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
      ],
    });
    expect(md).toBe('first\n\nsecond');
  });

  it('returns empty for empty doc', () => {
    expect(tiptapJsonToMarkdown({ type: 'doc', content: [] })).toBe('');
  });
});
