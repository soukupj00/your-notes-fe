import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner.tsx';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
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
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <PreferencesProvider>
        <TooltipProvider>
          <ViewModeProvider>
            <RouterProvider router={router} />
            <Toaster />
          </ViewModeProvider>
        </TooltipProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

export default App;
