import Layout from '@/components/layout.tsx';
import { Button } from '@/components/ui/button.tsx';
import { NoteCard } from '@/components/ui/NoteCard.tsx';
import { seedBrowserData } from '@/db/browserSeeder.ts';
import { useSearchNotes } from '@/hooks/useSearchNotes.ts';
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  //const notes = useNotes();
  const results = useSearchNotes(searchTerm);

  return (
    <Layout>
      <input
        type="text"
        placeholder="Search notes..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4 w-full rounded border border-gray-300 p-2"
      />
      <Button title="Text For Button" onClick={() => setCount((count) => count + 1)}>
        count is {count}
      </Button>
      <Button title="Seed notes to indexedDB" onClick={seedBrowserData}>
        Seed Notes
      </Button>
      {results && (
        <div className="flex flex-col items-center justify-center gap-4">
          {results.map((note) => (
            <NoteCard note={note} />
          ))}
        </div>
      )}
    </Layout>
  );
}

export default App;
