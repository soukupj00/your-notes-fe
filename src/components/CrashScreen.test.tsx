import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteError } from './CrashScreen.tsx';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
  // React and the router log the caught error themselves.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('RouteError', () => {
  it("replaces a route that failed to load with the app's crash screen", async () => {
    const root = createRootRoute();
    const broken = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => {
        throw new Error('Unable to preload CSS for /assets/NoteEditorDialog.css');
      },
    });
    const router = createRouter({
      routeTree: root.addChildren([broken]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      defaultErrorComponent: RouteError,
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'errors.crash.title' })).toHaveFocus();
    expect(screen.getByText(/Unable to preload CSS/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'errors.crash.reload' })).toBeInTheDocument();
  });
});
