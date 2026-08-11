import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import Layout from '@/components/layout.tsx';
import { TourProvider } from '@/context/TourProvider.tsx';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';

function RootLayout() {
  const { collectStartupOrphans } = useAttachmentActions();
  const { purgeExpiredTrash } = useNoteActions();

  // Startup sweeps, in order: purge trashed notes past their grace period, then
  // reconcile attachment ownership against every saved Body. Purging first
  // matters - it cascades its own attachments, so the orphan pass afterwards
  // sees a settled table. Both actions are stable, so this runs once per load;
  // it lives at the root rather than in a view so navigating cannot re-trigger it.
  useEffect(() => {
    purgeExpiredTrash()
      .then(() => collectStartupOrphans())
      .catch(console.error);
  }, [purgeExpiredTrash, collectStartupOrphans]);

  // `TourProvider` is the one provider that cannot sit in `App.tsx` with the
  // others: it navigates, so it has to be inside the router rather than around
  // it. Inside `Layout` would be wrong the other way - the Tour marks the whole
  // body inert and portals its popover past the app, so it belongs above the
  // shell it dims.
  return (
    <TourProvider>
      <Layout>
        <Outlet />
      </Layout>
    </TourProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
