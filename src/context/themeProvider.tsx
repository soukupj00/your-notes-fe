import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

/**
 * Hand the resolved theme's background to the platform, as `theme-color`.
 *
 * This is the colour the system chrome takes: Android's status bar (and, below
 * Android 15, the button bar), and a browser tab's toolbar. Without it the only
 * value the platform ever sees is the manifest's, which is stamped at build time
 * and so cannot follow a theme the user switches at runtime.
 *
 * It is written here, from the class this effect just applied, rather than as
 * two `media="(prefers-color-scheme: …)"` tags in `index.html`: those follow the
 * OS, and this app's theme is an explicit choice that is allowed to disagree
 * with it.
 *
 * Read from the token rather than restated as a literal - `globals.css` is the
 * single live source for both themes (the `src/themes.ts` duplicate was deleted
 * for this reason), and a custom property's computed value is already
 * `var()`-substituted, so this is the real colour and not the word `var`.
 *
 * Deliberately the note's *frame* and never a note's own tint: a note colour set
 * here would have to be unset on every path out of the editor, and the one that
 * forgot would leave the whole app wearing it.
 */
function paintSystemChrome(root: HTMLElement) {
  const color = getComputedStyle(root).getPropertyValue('--background').trim();
  if (!color) return;

  const meta =
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ??
    document.head.appendChild(
      Object.assign(document.createElement('meta'), { name: 'theme-color' })
    );
  meta.content = color;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
      const applySystemTheme = () => {
        root.classList.remove('light', 'dark');
        root.classList.add(colorScheme.matches ? 'dark' : 'light');
        paintSystemChrome(root);
      };

      applySystemTheme();
      colorScheme.addEventListener('change', applySystemTheme);

      return () => colorScheme.removeEventListener('change', applySystemTheme);
    }

    root.classList.add(theme);
    paintSystemChrome(root);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
