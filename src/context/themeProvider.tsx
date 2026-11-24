import { createContext, useContext, useEffect, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = Exclude<Theme, 'system'>;

const STORAGE_KEY = 'vite-ui-theme';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
};

type ThemeProviderState = {
  theme: Theme;
  /** What is on screen: `system` resolved against the OS. */
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'light',
  systemTheme: 'light',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

/**
 * Paints the system chrome (`theme-color`) with the theme's `--background`, from JS because the
 * app's theme may disagree with the OS. Never a note's tint: every path out of the editor would
 * have to unset it. Details in src/context/CLAUDE.md.
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

const THEMES: readonly string[] = ['dark', 'light', 'system'] satisfies Theme[];

// This provider sits outside the error boundary, so a blocked storage throw here would blank the page.
function readStoredTheme(fallback: Theme): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null && THEMES.includes(stored) ? (stored as Theme) : fallback;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme(defaultTheme));

  const systemTheme: ResolvedTheme = useMediaQuery('(prefers-color-scheme: dark)')
    ? 'dark'
    : 'light';
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    paintSystemChrome(root);
  }, [resolvedTheme]);

  const value = {
    theme,
    resolvedTheme,
    systemTheme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(STORAGE_KEY, theme);
      setTheme(theme);
    },
  };

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => useContext(ThemeProviderContext);
