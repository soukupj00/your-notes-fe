import Layout from '@/components/layout.tsx';
import { NotesHome } from '@/components/notes/NotesHome.tsx';
import { Toaster } from '@/components/ui/sonner.tsx';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { NotesProvider } from '@/context/NotesProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { ViewModeProvider } from '@/context/viewModeProvider.tsx';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <ViewModeProvider>
          <NotesProvider>
            <Layout>
              <NotesHome />
            </Layout>
            <Toaster />
          </NotesProvider>
        </ViewModeProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
