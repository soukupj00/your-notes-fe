import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';

/**
 * The in-app way up, on surfaces the drawer does not reach.
 *
 * It is not redundant with the platform's own back button: the app is
 * `display: 'standalone'`, so installed on iOS there is no browser chrome and
 * no system back at all. This is the only way out of Settings there.
 *
 * **Hybrid, not one or the other.** Popping history is right when there is
 * history - it returns you where you actually came from, which a fixed parent
 * would get wrong for anything reachable two ways. But a cold entry (a shared
 * link, a refresh, the PWA's `start_url`) has nothing to pop, and popping there
 * leaves the app entirely. So the Feed is the floor, not the behaviour.
 *
 * The floor is `/` and takes no configuring. It used to be a `parent` prop, back
 * when `/settings/labels` was the one page whose parent was not the Feed; it is
 * `/labels` now, a Destination beside Archive and Trash, and a prop with one
 * possible value is a choice nobody makes.
 *
 * A `<button>` rather than a `<Link>` in both branches: the destination is not
 * knowable up front in the common case, and a link whose href is a guess is
 * worse than no href - it would offer an open-in-new-tab that goes somewhere
 * else than the click does.
 */
export function BackButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={CHROME_ICON_BUTTON}
      aria-label={t('nav.back')}
      onClick={() => {
        if (canGoBack) {
          router.history.back();
        } else {
          void navigate({ to: '/' });
        }
      }}
    >
      <ArrowLeft />
    </Button>
  );
}
