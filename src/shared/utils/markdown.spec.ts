import { renderMarkdown, renderMarkdownInline } from './markdown';

const lookup = [
  { kind: 'character' as const, id: 'abc', label: 'Alphinaud' },
  { kind: 'place' as const, id: 'gri', label: 'Gridania' },
];

describe('renderMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('renders bold and italic', () => {
    const html = renderMarkdown('a **bold** and *italic* word.');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders bullet lists', () => {
    const html = renderMarkdown('- one\n- two\n- three');
    expect(html).toContain('<ul>');
    expect(html).toMatch(/<li>\s*one\s*<\/li>/);
    expect(html).toMatch(/<li>\s*three\s*<\/li>/);
  });

  it('preserves single newlines as <br> via breaks: true', () => {
    const html = renderMarkdown('first line\nsecond line');
    expect(html).toContain('<br>');
  });

  it('renders resolved inline refs as anchors with title', () => {
    const html = renderMarkdown('Met ${ch:abc}[the lad].', lookup);
    expect(html).toContain('title="Alphinaud"');
    expect(html).toContain('>the lad</a>');
  });

  it('renders unresolved inline refs as plain bracket text', () => {
    const html = renderMarkdown('Lost ${ch:zzz}[unknown] forever.', lookup);
    expect(html).not.toContain('<a');
    expect(html).toContain('[unknown]');
  });

  it('uses the entity name when display text is empty and ref resolves', () => {
    const html = renderMarkdown('At ${pl:gri}[].', lookup);
    expect(html).toContain('>Gridania</a>');
  });

  it('escapes HTML in display text', () => {
    const html = renderMarkdown('${ch:abc}[<script>alert(1)</script>]', lookup);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('handles refs inside list items and bold', () => {
    const html = renderMarkdown('- **${ch:abc}[Al]** lives in ${pl:gri}[Gri].', lookup);
    expect(html).toMatch(/<li>\s*<strong><a[^>]*>Al<\/a><\/strong>/);
    expect(html).toContain('>Gri</a>');
  });
});

describe('renderMarkdownInline', () => {
  it('strips the wrapping <p> for single-paragraph input', () => {
    const html = renderMarkdownInline('A short **bold** line.');
    expect(html).not.toContain('<p>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('keeps multi-block content wrapped', () => {
    const html = renderMarkdownInline('para one\n\npara two');
    expect(html).toContain('<p>');
  });
});
