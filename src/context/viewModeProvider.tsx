import { createContext, useContext, useState } from 'react';

/** The complete set of note-feed layouts from DESIGN.md. */
export type ViewMode = 'masonry' | 'stack';

function parseViewMode(value: string | null): ViewMode {
  // `list` was the pre-Nightshift name for Stack. Preserve the user's choice
  // while ensuring unknown or corrupt values never create a third layout.
  if (value === 'stack' || value === 'list') return 'stack';
  return 'masonry';
}

type ViewModeProviderState = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
};

const ViewModeContext = createContext<ViewModeProviderState | undefined>(undefined);

export function ViewModeProvider({
  children,
  storageKey = 'notes-view-mode',
}: {
  children: React.ReactNode;
  storageKey?: string;
}) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() =>
    parseViewMode(localStorage.getItem(storageKey))
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
