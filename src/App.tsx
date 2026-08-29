import { createRouter, RouterProvider } from '@tanstack/react-router';
import { DocumentPreferences } from '@/components/DocumentPreferences.tsx';
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx';
import { PwaUpdatePrompt } from '@/components/pwa/PwaUpdatePrompt.tsx';
import { Toaster } from '@/components/ui/sonner.tsx';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { AppMotionProvider } from '@/context/motionProvider.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { PwaInstallProvider } from '@/context/PwaInstallProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { ViewModeProvider } from '@/context/viewModeProvider.tsx';
import type { LocalStore } from '@/data/LocalStore.ts';
import { LocalStoreProvider } from '@/data/LocalStoreProvider.tsx';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });

// Registering the router's types globally is what makes `<Link to="…">`,
// params, and search params type-checked across the app (ADR 0008).
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App({ store }: { store: LocalStore }) {
  return (
    <LocalStoreProvider store={store}>
      {/* The boundary sits inside ThemeProvider so its fallback is themed, but
      outside everything else: a crash in any provider or route still lands on
      a recoverable screen rather than a white page. */}
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <ErrorBoundary>
          <PreferencesProvider>
            <DocumentPreferences />
            <AppMotionProvider>
              <PwaInstallProvider>
                <TooltipProvider>
                  <ViewModeProvider>
                    <RouterProvider router={router} />
                    <PwaUpdatePrompt />
                    <Toaster />
                  </ViewModeProvider>
                </TooltipProvider>
              </PwaInstallProvider>
            </AppMotionProvider>
          </PreferencesProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </LocalStoreProvider>
  );
}

export default App;
