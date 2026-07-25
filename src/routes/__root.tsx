import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import Layout from '@/components/layout.tsx';
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

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export const Route = createRootRoute({ component: RootLayout });
