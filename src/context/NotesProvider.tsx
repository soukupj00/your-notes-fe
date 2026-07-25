import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

type NotesContextType = {
  query: string;
  setQuery: (value: string) => void;
};

const NotesContext = createContext<NotesContextType | undefined>(undefined);

/**
 * Holds the app-wide search text. The search box lives in the Navbar, above the
 * router outlet, so the query cannot belong to any one view - but the note list
 * itself does: each route runs its own scoped `useNoteFeed(scope, query)`. That
 * split is why this provider no longer queries notes at all.
 */
export function NotesProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const value = useMemo(() => ({ query, setQuery }), [query]);

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
