import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * For a component that needs a router around it but no route of the app's: `ui` is the only
 * route. The memory history runs blockers on push and replace only, never on back.
 */
export async function renderInRouter(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory(),
  });
  await router.load();
  // biome-ignore lint/suspicious/noExplicitAny: the test router is not the app's registered one
  return { router, ...render(<RouterProvider router={router as any} />) };
}
