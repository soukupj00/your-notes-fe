import { createRouter, RouterProvider } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner.tsx';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { NotesProvider } from '@/context/NotesProvider.tsx';
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
      <TooltipProvider>
        <ViewModeProvider>
          <NotesProvider>
            <RouterProvider router={router} />
            <Toaster />
          </NotesProvider>
        </ViewModeProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
