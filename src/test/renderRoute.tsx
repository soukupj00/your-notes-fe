import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { RouteError } from '@/components/CrashScreen.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { ViewModeProvider } from '@/context/viewModeProvider.tsx';
import { LocalStoreProvider } from '@/data/LocalStoreProvider.tsx';
import { routeTree } from '@/routeTree.gen';
import { testStore } from '@/test/store.tsx';

/**
 * A single `path` is the cold case (`useCanGoBack()` is false, as after a refresh); pass an array
 * to land on the last of several entries. No `vi.mock` here: Vitest hoists them per file, so each
 * caller declares its own.
 */
export function renderRoute(path: string | string[]) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: Array.isArray(path) ? path : [path] }),
    defaultErrorComponent: RouteError,
  });
  render(
    // Same provider stack as `App.tsx`, so a component that reads preferences
    // (e.g. reduced motion) behaves here the way it does in the real app.
    <LocalStoreProvider store={testStore}>
      <ThemeProvider>
        <PreferencesProvider>
          <ViewModeProvider>
            {/* biome-ignore lint/suspicious/noExplicitAny: the test router is not the app's registered one */}
            <RouterProvider router={router as any} />
          </ViewModeProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </LocalStoreProvider>
  );
  return router;
}
