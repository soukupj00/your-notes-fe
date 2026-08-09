import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getToolbarItem } from '@/components/editor/toolbar/registry.ts';
import { ShortcutsSection } from './ShortcutsSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * Answer `(pointer: fine)` - the desktop signal - however this test needs it.
 * The shared setup stubs `matchMedia` as never matching, which is the right
 * default but makes the desktop branch unreachable without this.
 */
function stubPointer(fine: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ShortcutsSection', () => {
  it('lists an action with its combination, in readable words for a screen reader', () => {
    stubPointer(true);
    render(<ShortcutsSection />);

    const row = screen.getByText('editor.bold.tooltip').closest('div');
    expect(row).not.toBeNull();
    // Ctrl on this platform, ⌘ on a Mac - the words are the stable half.
    expect(row).toHaveTextContent('Control + B');
  });

  /**
   * The caps show glyphs because that is what is printed on the keyboard; the
   * accessible copy spells them, because a screen reader reads `⇧` as
   * punctuation or not at all.
   */
  it('draws the modifier as a glyph and announces it as a word', () => {
    stubPointer(true);
    const { container } = render(<ShortcutsSection />);

    const caps = [...container.querySelectorAll('kbd')].map((cap) => cap.textContent);
    expect(caps).toContain('⇧');

    const row = screen.getByText('editor.strike.tooltip').closest('div');
    expect(row).toHaveTextContent('Control + Shift + S');
  });

  /**
   * A phone has no modifier keys, so every row would be a promise it cannot
   * keep. Same signal `ActionButton` uses to drop the hint from its tooltip.
   */
  it('renders nothing on a coarse pointer', () => {
    stubPointer(false);
    const { container } = render(<ShortcutsSection />);

    expect(container).toBeEmptyDOMElement();
  });

  /** The names come from the registry, so a row can never invent one. */
  it('names every row from the registry entry it came from', () => {
    stubPointer(true);
    render(<ShortcutsSection />);

    expect(screen.getByText(getToolbarItem('undo')?.labelKey ?? '')).toBeInTheDocument();
    // `text-color` has no shortcut, so it must not take a row.
    expect(screen.queryByText('editor.textColor.tooltip')).not.toBeInTheDocument();
  });
});
