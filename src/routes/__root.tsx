import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';
import Layout from '@/components/layout.tsx';
import { SyncProvider } from '@/context/SyncProvider.tsx';
import { TourProvider } from '@/context/TourProvider.tsx';
import { isSharePath } from '@/data/http/publicShare.ts';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';

/**
 * A Share Link's page renders bare: no sweeps or Tour (they write), no sync loop, no shell.
 * Its viewer is a stranger whose Local Store must stay untouched (CONTEXT.md "Share Link").
 */
function RootLayout() {
  const shared = useLocation({ select: (location) => isSharePath(location.pathname) });
  return shared ? <Outlet /> : <AppLayout />;
}

function AppLayout() {
  const { collectStartupOrphans } = useAttachmentActions();
  const { purgeExpiredTrash } = useNoteActions();

  // Purge first: it cascades its own attachments, so the orphan pass sees a settled table.
  // At the root rather than in a view, so navigating cannot re-run it.
  useEffect(() => {
    purgeExpiredTrash()
      .then(() => collectStartupOrphans())
      .catch(console.error);
  }, [purgeExpiredTrash, collectStartupOrphans]);

  // Why these two providers sit here and in this order: src/context/CLAUDE.md.
  return (
    <TourProvider>
      <SyncProvider>
        <Layout>
          <Outlet />
        </Layout>
      </SyncProvider>
    </TourProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
