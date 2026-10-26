import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';

/**
 * Needed because an installed standalone PWA on iOS has no system back at all. Pops history when
 * there is some, else goes to `fallback`, since a cold entry has nothing to pop. A button,
 * not a Link: the href would be a guess, and open-in-new-tab would go somewhere else.
 */
export function BackButton({ fallback = '/' }: { fallback?: string }) {
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
          void navigate({ to: fallback });
        }
      }}
    >
      <ArrowLeft />
    </Button>
  );
}
