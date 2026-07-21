import { createContext, useContext, useState } from 'react';

/** How the note feed is laid out. `masonry` = CSS columns; `list` = single column. */
export type ViewMode = 'masonry' | 'list';

type ViewModeProviderState = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
};

const ViewModeContext = createContext<ViewModeProviderState | undefined>(undefined);

/**
 * Persists the feed layout choice to localStorage (same pattern as
 * `themeProvider`). Kept out of `NotesProvider` so it carries no Dexie
 * dependency and stays trivially testable.
 */
export function ViewModeProvider({
  children,
  storageKey = 'notes-view-mode',
}: {
  children: React.ReactNode;
  storageKey?: string;
}) {
  const [viewMode, setViewModeState] = useState<ViewMode>(
    () => (localStorage.getItem(storageKey) as ViewMode) || 'masonry'
  );

  const setViewMode = (mode: ViewMode) => {
    localStorage.setItem(storageKey, mode);
    setViewModeState(mode);
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}
