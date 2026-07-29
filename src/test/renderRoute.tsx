import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { ViewModeProvider } from '@/context/viewModeProvider.tsx';
import { routeTree } from '@/routeTree.gen';

/**
 * Renders the whole app at `path` on a memory history, and returns the router
 * so a test can assert on the resulting location.
 *
 * Note this helper deliberately carries no `vi.mock` calls: Vitest hoists those
 * per file, so a caller that needs `react-i18next`, `@/i18n` or
 * `NoteEditorDialog` mocked has to declare them itself.
 */
export function renderRoute(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    // Same provider stack as `App.tsx`, so a component that reads preferences
    // (e.g. reduced motion) behaves here the way it does in the real app.
    <ThemeProvider>
      <PreferencesProvider>
        <ViewModeProvider>
          {/* biome-ignore lint/suspicious/noExplicitAny: the test router is not the app's registered one */}
          <RouterProvider router={router as any} />
        </ViewModeProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
  return router;
}
