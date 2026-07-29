import { createRouter, RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx';
import { PwaUpdatePrompt } from '@/components/pwa/PwaUpdatePrompt.tsx';
import { Toaster } from '@/components/ui/sonner.tsx';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { PwaInstallProvider } from '@/context/PwaInstallProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { ViewModeProvider } from '@/context/viewModeProvider.tsx';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });

// Registering the router's types globally is what makes `<Link to="…">`,
// params, and search params type-checked across the app (ADR 0008).
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return (
    // The boundary sits inside ThemeProvider so its fallback is themed, but
    // outside everything else: a crash in any provider or route still lands on
    // a recoverable screen rather than a white page.
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ErrorBoundary>
        <PreferencesProvider>
          <PwaInstallProvider>
            <TooltipProvider>
              <ViewModeProvider>
                <RouterProvider router={router} />
                <PwaUpdatePrompt />
                <Toaster />
              </ViewModeProvider>
            </TooltipProvider>
          </PwaInstallProvider>
        </PreferencesProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
