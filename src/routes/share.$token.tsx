import { createFileRoute } from '@tanstack/react-router';
import SharePage from '@/pages/share.tsx';

function ShareRoute() {
  const { token } = Route.useParams();
  // Keyed, so another token starts again from loading.
  return <SharePage key={token} token={token} />;
}

export const Route = createFileRoute('/share/$token')({ component: ShareRoute });
