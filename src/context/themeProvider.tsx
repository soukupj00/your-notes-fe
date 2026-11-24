import { createContext, useContext, useEffect, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

export type Theme = 'dark' | 'light' | 'system';
/** In the order Settings offers them. */
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
export type ResolvedTheme = Exclude<Theme, 'system'>;

// public/theme-boot.js restates both for the first frames; themeBoot.test.tsx keeps them in step.
const STORAGE_KEY = 'vite-ui-theme';
const DEFAULT_THEME: Theme = 'dark';

type ThemeProviderProps = {
  children: React.ReactNode;
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

// This provider sits outside the error boundary, so a blocked storage throw here would blank the page.
function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.find((theme) => theme === stored) ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

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
