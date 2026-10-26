import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { DEFAULT_PRESET, defaultToolbarLayout, toolbarPreset } from './presets';
import { TOOLBAR_FAMILIES } from './registry';
import { ToolbarLayoutEditor } from './ToolbarLayoutEditor';
import type { ToolbarLayout, WidthClass } from './types';

// Interpolated, so a row can be found by the family it is for: every label in
// this editor is "<something> the {{name}} group".
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${Object.values(opts).join(',')}` : key,
  }),
}));

vi.mock('sonner', () => ({ toast: vi.fn() }));

/** The Width Class of the screen the editor is shown on, which is the one it edits. */
let screenWidthClass: WidthClass = 'wide';
vi.mock('./useWidthClass', () => ({ useWidthClass: () => screenWidthClass }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

/** The stored Layouts, once a write has landed. Throws until one has. */
async function storedToolbar(): Promise<{ compact: ToolbarLayout; wide: ToolbarLayout }> {
  const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) throw new Error('nothing written yet');
  return (JSON.parse(raw) as { toolbar: { compact: ToolbarLayout; wide: ToolbarLayout } }).toolbar;
}

const familyLabel = (id: string) => `editor.toolbar.family.${id}`;
const switchFor = (id: string) =>
  screen.getByRole('switch', { name: `settings.toolbar.family.show:${familyLabel(id)}` });

function setWidth(px: number) {
  window.innerWidth = px;
  window.matchMedia = vi.fn().mockReturnValue({
    matches: px < 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

function renderEditor(widthClass: WidthClass = 'wide', showPreview = false) {
  screenWidthClass = widthClass;
  return render(<ToolbarLayoutEditor showPreview={showPreview} />, { wrapper });
}

/**
 * jsdom reports 0x0 rects and dnd-kit's keyboard sensor compares rects, so rows are
 * stacked in DOM order at their real 44px height; everything else stays 0x0.
 */
const ROW_HEIGHT = 44;
function stubRowGeometry() {
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const rows = Array.from(document.querySelectorAll('li > div'));
    const index = rows.indexOf(this);
    if (index === -1) return original.call(this);
    const top = index * ROW_HEIGHT;
    return {
      x: 0,
      y: top,
      top,
      bottom: top + ROW_HEIGHT,
      left: 0,
      right: 320,
      width: 320,
      height: ROW_HEIGHT,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

beforeEach(() => setWidth(1280));
afterEach(async () => {
  vi.mocked(toast).mockClear();
  // The geometry stub is a prototype spy, and this suite has no `restoreMocks`:
  // left in place it would hand fabricated rects to every test that follows,
  // and a second `stubRowGeometry` would capture the spy as its own original.
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the family list', () => {
  it('lists every registry family, on or off, so an off one can be turned on', async () => {
    renderEditor('compact');

    const rows = await screen.findAllByRole('switch');
    expect(rows).toHaveLength(TOOLBAR_FAMILIES.length);
    // `block` is off in the tuned Compact default - it would put the phone bar
    // past the fold on day one - and a family you cannot see is one you cannot
    // turn back on.
    expect(switchFor('block')).not.toBeChecked();
    expect(switchFor('history')).toBeChecked();
  });

  it('persists a family toggle into that Width Class only', async () => {
    const user = userEvent.setup();
    renderEditor('wide');

    await user.click(switchFor('media'));

    await waitFor(async () => {
      const toolbar = await storedToolbar();
      expect(toolbar.wide.find((family) => family.id === 'media')?.on).toBe(false);
      // The phone's Layout is a separate arrangement and must not move when the
      // desktop one is edited.
      expect(toolbar.compact).toEqual([]);
    });
  });

  it('persists a collapse without touching the family the user did not press', async () => {
    const user = userEvent.setup();
    renderEditor('wide');

    await user.click(
      screen.getByRole('button', {
        name: `settings.toolbar.family.collapse:${familyLabel('list')}`,
      })
    );

    await waitFor(async () => {
      const { wide } = await storedToolbar();
      expect(wide.find((family) => family.id === 'list')?.collapsed).toBe(true);
      expect(wide.find((family) => family.id === 'format')?.collapsed).toBe(false);
    });
  });

  it('offers no collapse control for a family that cannot be a menu', async () => {
    renderEditor();
    await screen.findAllByRole('switch');

    // `meta` is the single gear; a menu wrapped around one button is not a menu.
    expect(
      screen.queryByRole('button', {
        name: `settings.toolbar.family.collapse:${familyLabel('meta')}`,
      })
    ).not.toBeInTheDocument();
  });
});

describe('a family row', () => {
  // A row without a collapse control would shift its switch left of the column above it.
  it('lines up its controls with every other row, collapsible or not', async () => {
    renderEditor('wide');

    const handles = await screen.findAllByRole('button', { name: /^dnd\.handle/ });
    const widths = new Set(handles.map((handle) => handle.parentElement?.childElementCount));
    expect(widths).toEqual(new Set([4]));
  });

  // The visible count is short so a long name fits a phone; a screen reader hears the sentence.
  it('shows a short count and says the whole sentence, counted by its total', async () => {
    renderEditor('wide');

    const history = await screen.findByRole('button', {
      name: /^editor\.toolbar\.family\.history/,
    });
    expect(history).toHaveTextContent('settings.toolbar.family.count:2,2');
    // jsdom lays nothing out, so it joins the name's parts without the space a browser adds.
    expect(history).toHaveAccessibleName(
      /^editor\.toolbar\.family\.history\s*settings\.toolbar\.family\.summary:2,2$/
    );
  });
});

describe('the fold marker', () => {
  it('marks where a phone stops showing buttons, on the compact Layout only', async () => {
    // Everything on Compact is 32 buttons on a bar that fits six.
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        toolbar: { compact: toolbarPreset('everything', 'compact'), wide: [] },
      })
    );
    renderEditor('compact');

    expect(await screen.findByText(/settings\.toolbar\.fold/)).toBeInTheDocument();
  });

  it('does not mark a fold the wide Layout does not have', async () => {
    renderEditor('wide');
    await screen.findAllByRole('switch');

    expect(screen.queryByText(/settings\.toolbar\.fold/)).not.toBeInTheDocument();
  });

  it('does not mark a fold on a compact Layout that fits', async () => {
    renderEditor('compact');
    await screen.findAllByRole('switch');

    // The tuned Compact default is exactly the six slots a phone shows.
    expect(screen.queryByText(/settings\.toolbar\.fold/)).not.toBeInTheDocument();
  });
});

describe('drilling into a family', () => {
  it('lists the family buttons and keeps the Width Class in view', async () => {
    const user = userEvent.setup();
    renderEditor('compact');

    await user.click(await screen.findByRole('button', { name: /^editor\.toolbar\.family\.list/ }));

    expect(screen.getByText('editor.toolbar.family.list ·').parentElement).toHaveTextContent(
      'editor.toolbar.family.list · settings.toolbar.width.compact'
    );
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    expect(
      screen.getByRole('switch', { name: 'settings.toolbar.item.show:editor.bulletList.tooltip' })
    ).toBeChecked();
  });

  it('persists a leaf toggle and leaves its siblings on', async () => {
    const user = userEvent.setup();
    renderEditor('wide');

    await user.click(
      await screen.findByRole('button', { name: /^editor\.toolbar\.family\.style/ })
    );
    await user.click(
      screen.getByRole('switch', { name: 'settings.toolbar.item.show:editor.heading.h3' })
    );

    await waitFor(async () => {
      const { wide } = await storedToolbar();
      expect(wide.find((family) => family.id === 'style')?.members).toEqual([
        { id: 'h1', on: true },
        { id: 'h2', on: true },
        { id: 'h3', on: false },
      ]);
    });
  });

  it('goes back to the family list', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      await screen.findByRole('button', { name: /^editor\.toolbar\.family\.style/ })
    );
    await user.click(screen.getByRole('button', { name: 'settings.toolbar.back' }));

    expect(screen.getAllByRole('switch')).toHaveLength(TOOLBAR_FAMILIES.length);
  });
});

describe('a family opened from outside', () => {
  const renderControlled = (openFamilyId: string | null) => {
    const onOpenFamilyChange = vi.fn();
    screenWidthClass = 'wide';
    render(
      <ToolbarLayoutEditor openFamilyId={openFamilyId} onOpenFamilyChange={onOpenFamilyChange} />,
      { wrapper }
    );
    return onOpenFamilyChange;
  };

  it('shows the leaf list of the family it is given', async () => {
    renderControlled('style');

    expect(
      await screen.findByRole('switch', { name: 'settings.toolbar.item.show:editor.heading.h3' })
    ).toBeInTheDocument();
  });

  it.each([
    ['an unknown family', 'nope'],
    ['no family', null],
  ])('shows the family list for %s', async (_, id) => {
    renderControlled(id);

    expect(await screen.findAllByRole('switch')).toHaveLength(TOOLBAR_FAMILIES.length);
  });

  it('asks to open a row and leaves the opening to its owner', async () => {
    const user = userEvent.setup();
    const onOpenFamilyChange = renderControlled(null);

    await user.click(
      await screen.findByRole('button', { name: /^editor\.toolbar\.family\.style/ })
    );
    expect(onOpenFamilyChange).toHaveBeenLastCalledWith('style');
    expect(screen.getAllByRole('switch')).toHaveLength(TOOLBAR_FAMILIES.length);
  });

  it('asks to close from its Back', async () => {
    const user = userEvent.setup();
    const onOpenFamilyChange = renderControlled('style');

    await user.click(await screen.findByRole('button', { name: 'settings.toolbar.back' }));
    expect(onOpenFamilyChange).toHaveBeenLastCalledWith(null);
  });
});

describe('presets', () => {
  it('stamps a whole Layout, over whatever was there', async () => {
    const user = userEvent.setup();
    renderEditor('wide');

    await user.click(
      await screen.findByRole('button', { name: /settings\.toolbar\.preset\.minimal/ })
    );

    await waitFor(async () => {
      const { wide } = await storedToolbar();
      // A stamp is complete: every family, on or off, so the editor can show
      // what was turned off as readily as what was turned on.
      expect(wide).toEqual(toolbarPreset('minimal', 'wide'));
    });
  });

  it.each([
    ['wide', 'minimal'],
    ['compact', 'balanced'],
  ] as const)(
    'restores the %s default by re-stamping %s, the preset marked default',
    async (width, preset) => {
      const user = userEvent.setup();
      renderEditor(width);

      await user.click(
        await screen.findByRole('button', { name: /settings\.toolbar\.preset\.everything/ })
      );
      await waitFor(async () => expect((await storedToolbar())[width]).not.toEqual([]));
      const restore = screen.getByRole('button', {
        name: (name) => name.includes(`settings.toolbar.preset.${preset}`),
      });
      expect(restore).toHaveTextContent('settings.toolbar.preset.isDefault');
      await user.click(restore);

      await waitFor(async () => {
        expect((await storedToolbar())[width]).toEqual(defaultToolbarLayout(width));
      });
    }
  );

  it('stamps only the Width Class this screen is in', async () => {
    const user = userEvent.setup();
    renderEditor('compact');

    await user.click(
      await screen.findByRole('button', { name: /settings\.toolbar\.preset\.everything/ })
    );

    await waitFor(async () => {
      const toolbar = await storedToolbar();
      expect(toolbar.compact).toEqual(toolbarPreset('everything', 'compact'));
      expect(toolbar.wide).toEqual([]);
    });
  });
});

describe('the Width Class', () => {
  it.each(['compact', 'wide'] as const)(
    'on a %s screen, edits it without a line naming it or a way to pick the other',
    (width) => {
      renderEditor(width, true);

      expect(screen.queryByText(/settings\.toolbar\.width\.current/)).toBeNull();
      expect(screen.queryByRole('radio')).toBeNull();
    }
  );

  it('follows the screen when its Width Class changes', async () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        toolbar: { compact: [], wide: toolbarPreset('minimal', 'wide') },
      })
    );
    const { rerender } = renderEditor('compact');
    // `meta` is off in the Compact default and on in Wide/Minimal.
    await waitFor(() => expect(switchFor('meta')).not.toBeChecked());

    screenWidthClass = 'wide';
    rerender(<ToolbarLayoutEditor />);

    await waitFor(() => expect(switchFor('meta')).toBeChecked());
  });
});

describe('the order on the page', () => {
  it('puts Reset to before the preview, and the preview before the groups', () => {
    renderEditor('wide', true);

    const reset = screen.getByRole('group', { name: 'settings.toolbar.preset.legend' });
    const preview = screen.getByTestId('toolbar-preview');
    const groups = screen.getByText('settings.toolbar.groups');
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(reset, preview)).toBe(true);
    expect(follows(preview, groups)).toBe(true);
  });
});

describe('a reset', () => {
  const preset = (name: string) =>
    screen.getByRole('button', {
      name: (label) => label.includes(`settings.toolbar.preset.${name}`),
    });
  const undoOf = (call: number) =>
    vi.mocked(toast).mock.calls[call][1]?.action as unknown as { onClick: () => void };

  it.each(['compact', 'wide'] as const)(
    'on %s stamps the preset, toasts with Undo, and marks that Width Class default',
    async (width) => {
      const user = userEvent.setup();
      renderEditor(width);

      await user.click(preset('minimal'));

      await waitFor(async () =>
        expect((await storedToolbar())[width]).toEqual(toolbarPreset('minimal', width))
      );
      expect(toast).toHaveBeenCalledWith(
        'settings.toolbar.reset.done:settings.toolbar.preset.minimal',
        expect.objectContaining({ action: expect.objectContaining({ label: 'notes.undo' }) })
      );
      expect(preset(DEFAULT_PRESET[width])).toHaveTextContent('settings.toolbar.preset.isDefault');
    }
  );

  it('Undo writes back the layout from before the reset and never the other Width Class', async () => {
    const before = toolbarPreset('everything', 'compact');
    const wideBefore = toolbarPreset('balanced', 'wide');
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ version: 2, toolbar: { compact: before, wide: wideBefore } })
    );
    const user = userEvent.setup();
    renderEditor('compact');

    await user.click(preset('minimal'));
    await waitFor(async () =>
      expect((await storedToolbar()).compact).toEqual(toolbarPreset('minimal', 'compact'))
    );
    // A second change, to the other Width Class, before the Undo.
    const wideAfter = toolbarPreset('everything', 'wide');
    const raw = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}');
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ ...raw, toolbar: { ...raw.toolbar, wide: wideAfter } })
    );

    undoOf(0).onClick();

    await waitFor(async () => expect((await storedToolbar()).compact).toEqual(before));
    expect((await storedToolbar()).wide).toEqual(wideAfter);
  });
});

describe('reordering', () => {
  it('gives every row a 44px drag handle and a 44px row box', async () => {
    renderEditor();

    const handles = await screen.findAllByRole('button', { name: /^dnd\.handle/ });
    expect(handles).toHaveLength(TOOLBAR_FAMILIES.length);
    // jsdom has no layout, so the 44px floor is asserted as the classes that
    // produce it; the measured gate is the manual pass.
    for (const handle of handles) expect(handle).toHaveClass('size-11');
    for (const handle of handles) {
      expect(handle.parentElement).toHaveClass('min-h-11');
    }
  });

  it('moves a row with the keyboard sensor and persists the new order', async () => {
    const user = userEvent.setup();
    renderEditor('wide');
    stubRowGeometry();

    const handles = await screen.findAllByRole('button', { name: /^dnd\.handle/ });
    const [first] = handles;
    first.focus();
    // Space lifts the row, an arrow moves it, Space drops it - the keyboard
    // path is not a nicety here, it is how the feature is operable at all
    // without a pointer.
    await user.keyboard('{ }{ArrowDown}{ }');

    await waitFor(async () => {
      const { wide } = await storedToolbar();
      const defaults = defaultToolbarLayout('wide').map((family) => family.id);
      expect(wide.map((family) => family.id)).toEqual([
        defaults[1],
        defaults[0],
        ...defaults.slice(2),
      ]);
    });
  });
});

describe('a stored family this build cannot render', () => {
  it('keeps its row and its order rather than dropping it', async () => {
    const stored: ToolbarLayout = [
      {
        id: 'from-the-future',
        on: true,
        collapsed: false,
        members: [{ id: 'teleport', on: true }],
      },
      ...defaultToolbarLayout('wide'),
    ];
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ version: 1, toolbar: { compact: [], wide: stored } })
    );
    renderEditor('wide');

    await waitFor(() =>
      expect(screen.getAllByRole('switch')).toHaveLength(TOOLBAR_FAMILIES.length + 1)
    );
    // Nothing honest can be said about its contents, so it does not pretend to
    // drill in.
    const unknown = screen.getByRole('button', { name: 'dnd.handle:from-the-future' })
      .parentElement as HTMLElement;
    expect(within(unknown).getByRole('button', { name: /^from-the-future/ })).toBeDisabled();
  });
});
