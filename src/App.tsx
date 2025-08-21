import Layout from '@/components/layout.tsx';
import { Button } from '@/components/ui/button.tsx';
import { NoteCard } from '@/components/ui/NoteCard.tsx';
import { dummyNotes } from '@/db/dummyNotes.ts';
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  const notes = dummyNotes;

  return (
    <Layout>
      <Button title="Text For Button" onClick={() => setCount((count) => count + 1)}>
        count is {count}
      </Button>
      {notes && (
        <div className="flex flex-col items-center justify-center gap-4">
          {notes.map((note) => (
            <NoteCard note={note} />
          ))}
        </div>
      )}
    </Layout>
  );
}

export default App;
