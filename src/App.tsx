import Layout from '@/components/layout.tsx';
import { NoteContent } from '@/components/NoteContent.tsx';
import { ThemeProvider } from '@/components/themeProvider.tsx';
import { Button } from '@/components/ui/button.tsx';
import { NotesProvider } from '@/context/NotesProvider.tsx';
import { seedBrowserData } from '@/db/browserSeeder.ts';
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <NotesProvider>
        <Layout>
          <Button title="Text For Button" onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </Button>
          <Button title="Seed notes to indexedDB" onClick={seedBrowserData}>
            Seed Notes
          </Button>
          <NoteContent />
        </Layout>
      </NotesProvider>
    </ThemeProvider>
  );
}

export default App;
