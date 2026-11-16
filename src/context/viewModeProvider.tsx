import { createContext, useContext, useState } from 'react';

/** The complete set of note-feed layouts from DESIGN.md. */
export type ViewMode = 'masonry' | 'stack';

const STORAGE_KEY = 'notes-view-mode';

function parseViewMode(value: string | null): ViewMode {
  return value === 'stack' ? 'stack' : 'masonry';
}

type ViewModeProviderState = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
};

const ViewModeContext = createContext<ViewModeProviderState | undefined>(undefined);

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() =>
    parseViewMode(localStorage.getItem(STORAGE_KEY))
  );

  const setViewMode = (mode: ViewMode) => {
    localStorage.setItem(STORAGE_KEY, mode);
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
