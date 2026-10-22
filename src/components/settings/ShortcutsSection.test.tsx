import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { ShortcutsSection } from './ShortcutsSection.tsx';

// Interpolated values join the key, so a test can tell one row's copy from another's.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? [key, ...Object.values(values)].join('|') : key,
  }),
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

function setup() {
  stubPointer(true);
  const view = render(
    <PreferencesProvider>
      <ShortcutsSection />
    </PreferencesProvider>
  );
  return { ...view, user: userEvent.setup() };
}

const stored = () => JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}').shortcuts;

/** The keys button of the row named `label`, set or cleared. */
const keysButton = (label: string) =>
  screen.getByRole('button', {
    name: (name) =>
      /^settings\.shortcuts\.keysButton(None)?\|/.test(name) && name.split('|')[1] === label,
  });

const row = (label: string) => keysButton(label).closest('li') as HTMLElement;

async function openMenu(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(
    screen.getByRole('button', { name: `settings.shortcuts.menu.trigger|${label}` })
  );
}

/** A keydown as a browser sends it; jsdom leaves `keyCode` at 0 otherwise. */
const press = (label: string, init: KeyboardEventInit & { keyCode: number }) =>
  fireEvent.keyDown(keysButton(label), init);

async function record(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  init: KeyboardEventInit & { keyCode: number }
) {
  await user.click(keysButton(label));
  press(label, init);
}

describe('ShortcutsSection', () => {
  it('lists both groups and every Shortcut, New note first', () => {
    setup();

    const app = screen.getByRole('group', { name: 'settings.shortcuts.group.app' });
    const editor = screen.getByRole('group', { name: 'settings.shortcuts.group.editor' });
    expect(within(app).getAllByRole('listitem')).toHaveLength(2);
    expect(within(editor).getAllByRole('listitem')).toHaveLength(22);
    expect(within(app).getAllByRole('listitem')[0]).toHaveTextContent(
      'settings.shortcuts.newNote.label'
    );
  });

  /** A screen reader reads `⇧` as punctuation or not at all, so the keys are spelled out too. */
  it('draws the keys as printed and announces them as words', () => {
    setup();

    expect(keysButton('editor.strike.tooltip')).toHaveAccessibleName(
      'settings.shortcuts.keysButton|editor.strike.tooltip|Control + Shift + S'
    );
    const caps = [...row('editor.strike.tooltip').querySelectorAll('kbd')].map(
      (cap) => cap.textContent
    );
    expect(caps).toEqual(['Ctrl', 'Shift', 'S']);
  });

  it('records a new combination, marks the row, and offers the default back', async () => {
    const { user } = setup();

    await record(user, 'editor.bold.tooltip', {
      key: 'b',
      keyCode: 66,
      ctrlKey: true,
      altKey: true,
    });

    expect(stored()).toEqual({ bold: 'Mod-Alt-b' });
    expect(row('editor.bold.tooltip')).toHaveTextContent('settings.shortcuts.changed');
    expect(keysButton('editor.bold.tooltip')).toHaveFocus();
    await openMenu(user, 'editor.bold.tooltip');
    expect(
      screen.getByRole('menuitem', { name: 'settings.shortcuts.menu.reset|Ctrl + B' })
    ).toBeInTheDocument();
  });

  it('cancels on Esc without the key reaching anything around it', async () => {
    const { user } = setup();
    const outside = vi.fn();
    document.addEventListener('keydown', outside);

    await record(user, 'editor.bold.tooltip', { key: 'Escape', keyCode: 27 });
    document.removeEventListener('keydown', outside);
    press('editor.bold.tooltip', { key: 'i', keyCode: 73, ctrlKey: true });

    expect(outside).not.toHaveBeenCalled();
    expect(stored()).toBeUndefined();
    expect(keysButton('editor.bold.tooltip')).toHaveAttribute('aria-pressed', 'false');
  });

  describe('a combination another action has', () => {
    async function conflict() {
      const { user } = setup();
      await record(user, 'editor.bold.tooltip', {
        key: 'B',
        keyCode: 66,
        ctrlKey: true,
        shiftKey: true,
      });
      return user;
    }

    it('names the owner and saves nothing yet', async () => {
      await conflict();

      expect(row('editor.bold.tooltip')).toHaveTextContent(
        'settings.shortcuts.conflict|Ctrl + Shift + B|editor.blockquote.tooltip'
      );
      expect(stored()).toBeUndefined();
    });

    it('moves it on Replace, leaving the owner with none', async () => {
      const user = await conflict();

      await user.click(screen.getByRole('button', { name: 'settings.shortcuts.replace' }));

      expect(stored()).toEqual({ bold: 'Mod-Shift-b', blockquote: null });
      expect(keysButton('editor.blockquote.tooltip')).toHaveTextContent('settings.shortcuts.none');
      expect(keysButton('editor.bold.tooltip')).toHaveFocus();
    });

    it('keeps both on Cancel', async () => {
      const user = await conflict();

      await user.click(screen.getByRole('button', { name: 'settings.shortcuts.cancel' }));

      expect(stored()).toBeUndefined();
      expect(row('editor.bold.tooltip')).not.toHaveTextContent('settings.shortcuts.conflict');
    });
  });

  it('offers Replace when the default it resets to was given to another action', async () => {
    const { user } = setup();
    await record(user, 'editor.bold.tooltip', { key: 'i', keyCode: 73, ctrlKey: true });
    await user.click(screen.getByRole('button', { name: 'settings.shortcuts.replace' }));

    await openMenu(user, 'editor.italic.tooltip');
    await user.click(
      screen.getByRole('menuitem', { name: 'settings.shortcuts.menu.reset|Ctrl + I' })
    );
    expect(row('editor.italic.tooltip')).toHaveTextContent(
      'settings.shortcuts.conflict|Ctrl + I|editor.bold.tooltip'
    );
    expect(stored()).toEqual({ bold: 'Mod-i', italic: null });

    await user.click(screen.getByRole('button', { name: 'settings.shortcuts.replace' }));
    expect(stored()).toEqual({ bold: null });
  });

  it.each([
    ['b alone for Bold', 'editor.bold.tooltip', { key: 'b', keyCode: 66 }, 'needsModifier'],
    [
      'Ctrl+W for Search',
      'settings.shortcuts.search.label',
      { key: 'w', keyCode: 87, ctrlKey: true },
      'browser|Ctrl + W',
    ],
    [
      'Ctrl+A for Bold',
      'editor.bold.tooltip',
      { key: 'a', keyCode: 65, ctrlKey: true },
      'editor|Ctrl + A',
    ],
    [
      'Space for New note',
      'settings.shortcuts.newNote.label',
      { key: ' ', keyCode: 32 },
      'bareKey',
    ],
  ])('refuses %s and keeps listening', async (_label, label, init, reason) => {
    const { user } = setup();

    await record(user, label, init);

    expect(row(label)).toHaveTextContent(`settings.shortcuts.refused.${reason}`);
    expect(stored()).toBeUndefined();
    expect(keysButton(label)).toHaveAttribute('aria-pressed', 'true');
  });

  it('lets Tab leave a recording, which cancels it', async () => {
    const { user } = setup();

    await user.click(keysButton('editor.bold.tooltip'));
    await user.tab();

    expect(keysButton('editor.bold.tooltip')).not.toHaveFocus();
    expect(keysButton('editor.bold.tooltip')).toHaveAttribute('aria-pressed', 'false');
  });

  it('clears a Shortcut from its menu and hands focus back to its keys', async () => {
    const { user } = setup();

    await openMenu(user, 'editor.italic.tooltip');
    await user.click(screen.getByRole('menuitem', { name: 'settings.shortcuts.menu.clear' }));

    expect(stored()).toEqual({ italic: null });
    expect(keysButton('editor.italic.tooltip')).toHaveTextContent('settings.shortcuts.none');
    expect(keysButton('editor.italic.tooltip')).toHaveFocus();
  });

  it('records from Edit in the menu', async () => {
    const { user } = setup();

    await openMenu(user, 'editor.italic.tooltip');
    await user.click(screen.getByRole('menuitem', { name: 'settings.shortcuts.menu.edit' }));
    press('editor.italic.tooltip', { key: 'j', keyCode: 74, ctrlKey: true, altKey: true });

    expect(stored()).toEqual({ italic: 'Mod-Alt-j' });
  });

  it('asks before resetting everything, and Cancel keeps the changes', async () => {
    const { user } = setup();
    await openMenu(user, 'editor.italic.tooltip');
    await user.click(screen.getByRole('menuitem', { name: 'settings.shortcuts.menu.clear' }));

    await user.click(screen.getByRole('button', { name: 'settings.shortcuts.resetAll' }));
    await user.click(screen.getByRole('button', { name: 'settings.shortcuts.cancel' }));
    expect(stored()).toEqual({ italic: null });

    await user.click(screen.getByRole('button', { name: 'settings.shortcuts.resetAll' }));
    await user.click(screen.getByRole('button', { name: 'settings.shortcuts.resetAllConfirm' }));
    expect(stored()).toEqual({});
  });

  /** A phone has no modifier keys, so every row would be a promise it cannot keep. */
  it('renders nothing on a coarse pointer', () => {
    stubPointer(false);
    const { container } = render(
      <PreferencesProvider>
        <ShortcutsSection />
      </PreferencesProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
