import { Editor } from '@/components/editor/editor.tsx';
import Layout from '@/components/layout.tsx';
import { NoteContent } from '@/components/NoteContent.tsx';
import { ThemeDebugger } from '@/components/themeDebugger.tsx';
import { Button } from '@/components/ui/button.tsx';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { NotesProvider } from '@/context/NotesProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { seedBrowserData } from '@/db/browserSeeder.ts';
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  const [content, setContent] = useState(`
        <p>
          I like lists. Let’s add one:
        </p>
        <ul>
          <li>This is a bullet list.</li>
          <li>And it has three list items.</li>
          <li>Here is the third one.</li>
        </ul>
        <p>
          Do you want to see one more? I bet! Here is another one:
        </p>
        <ol>
          <li>That’s a different list, actually it’s an ordered list.</li>
          <li>It also has three list items.</li>
          <li>And all of them are numbered.</li>
        </ol>
        <p>
          Lists would be nothing without list items.
        </p>
      `);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <NotesProvider>
          <Layout>
            <ThemeDebugger />
            <Editor content={content} onUpdate={setContent} editable={true} />
            <Button title="Text For Button" onClick={() => setCount((count) => count + 1)}>
              count is {count}
            </Button>
            <Button title="Seed notes to indexedDB" onClick={seedBrowserData}>
              Seed Notes
            </Button>
            <NoteContent />
          </Layout>
        </NotesProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
