import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getToolbarItem } from '@/components/editor/toolbar/registry.ts';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
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
  localStorage.clear();
});

const renderSection = () =>
  render(
    <PreferencesProvider>
      <ShortcutsSection />
    </PreferencesProvider>
  );

const storedKey = () =>
  JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}').newNoteKey;

describe('ShortcutsSection', () => {
  it('lists an action with its combination, in readable words for a screen reader', () => {
    stubPointer(true);
    renderSection();

    const row = screen.getByText('editor.bold.tooltip').closest('div');
    expect(row).not.toBeNull();
    // Ctrl on this platform, ⌘ on a Mac - the words are the stable half.
    expect(row).toHaveTextContent('Control + B');
  });

  /**
   * The caps show what is printed on the keyboard (a word off Mac, `⌘ ⌥ ⇧` on one); the
   * accessible copy spells them, because a screen reader reads `⇧` as punctuation or not at all.
   */
  it('draws the modifier as printed and announces it as a word', () => {
    stubPointer(true);
    const { container } = renderSection();

    const caps = [...container.querySelectorAll('kbd')].map((cap) => cap.textContent);
    expect(caps).toContain('Shift');

    const row = screen.getByText('editor.strike.tooltip').closest('div');
    expect(row).toHaveTextContent('Control + Shift + S');
  });

  /**
   * A phone has no modifier keys, so every row would be a promise it cannot
   * keep. Same signal `ActionButton` uses to drop the hint from its tooltip.
   */
  it('renders nothing on a coarse pointer', () => {
    stubPointer(false);
    const { container } = renderSection();

    expect(container).toBeEmptyDOMElement();
  });

  /** The names come from the registry, so a row can never invent one. */
  it('names every row from the registry entry it came from', () => {
    stubPointer(true);
    renderSection();

    expect(screen.getByText(getToolbarItem('undo')?.labelKey ?? '')).toBeInTheDocument();
    // `text-color` has no shortcut, so it must not take a row.
    expect(screen.queryByText('editor.textColor.tooltip')).not.toBeInTheDocument();
  });
});

describe('the new-note key row', () => {
  const row = () =>
    screen.getByText('settings.shortcuts.newNote.label').closest('div') as HTMLElement;
  const button = (name: string) => screen.getByRole('button', { name });

  async function setup() {
    stubPointer(true);
    renderSection();
    return userEvent.setup();
  }

  it('shows the current key', async () => {
    await setup();

    expect(row().querySelector('kbd')).toHaveTextContent('N');
    expect(screen.queryByRole('button', { name: 'settings.shortcuts.newNote.reset' })).toBeNull();
  });

  it('stores the next key pressed after Change, keeping focus on Change', async () => {
    const user = await setup();

    await user.click(button('settings.shortcuts.newNote.change'));
    expect(screen.getByRole('status')).toHaveTextContent('settings.shortcuts.newNote.recording');
    await user.keyboard('K');

    expect(storedKey()).toBe('k');
    expect(row().querySelector('kbd')).toHaveTextContent('K');
    expect(button('settings.shortcuts.newNote.change')).toHaveFocus();
  });

  it('keeps the old key when Esc cancels', async () => {
    const user = await setup();

    await user.click(button('settings.shortcuts.newNote.change'));
    await user.keyboard('{Escape}');
    await user.keyboard('k');

    expect(storedKey()).toBeUndefined();
    expect(row().querySelector('kbd')).toHaveTextContent('N');
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
    ['Tab', '{Tab}'],
    ['an arrow', '{ArrowDown}'],
    ['a combination', '{Control>}k{/Control}'],
  ])('refuses %s with a message and keeps listening', async (_label, keys) => {
    const user = await setup();

    await user.click(button('settings.shortcuts.newNote.change'));
    await user.keyboard(keys);

    expect(screen.getByRole('status')).toHaveTextContent('settings.shortcuts.newNote.refused');
    expect(storedKey()).toBeUndefined();
    expect(button('settings.shortcuts.newNote.change')).toHaveFocus();
    await user.keyboard('j');
    expect(storedKey()).toBe('j');
  });

  it('turns the key off, shows Off, and Reset brings N back', async () => {
    const user = await setup();

    await user.click(button('settings.shortcuts.newNote.turnOff'));

    expect(storedKey()).toBeNull();
    expect(row()).toHaveTextContent('settings.shortcuts.newNote.off');
    expect(row().querySelector('kbd')).toBeNull();
    expect(button('settings.shortcuts.newNote.change')).toHaveFocus();

    await user.click(button('settings.shortcuts.newNote.reset'));

    expect(storedKey()).toBe('n');
    expect(row().querySelector('kbd')).toHaveTextContent('N');
    expect(button('settings.shortcuts.newNote.change')).toHaveFocus();
  });
});
