import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { db } from '@/db/db';
import { useSearchNotes } from '@/hooks/data/useSearchNotes.ts';
import type { Note } from '@/models';

type NotesContextType = {
  query: string;
  setQuery: (value: string) => void;
  notes: Note[];
  loading: boolean;
};

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');

  const searchResults = useSearchNotes(query);

  const allNotes = useLiveQuery(async () => {
    return db.notes.toArray();
  }, []);

  const notes = (query.trim() ? searchResults : (allNotes ?? [])).filter(
    (n): n is Note => n !== undefined
  );

  // The all-notes live query is `undefined` until it first resolves; surface
  // that so the list can show skeletons instead of a false empty state.
  const loading = !query.trim() && allNotes === undefined;

  return (
    <NotesContext.Provider value={{ query, setQuery, notes, loading }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
