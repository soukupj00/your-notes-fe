import { useTranslation } from 'react-i18next';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

/**
 * Settings shell. The section scaffold lands here; the individual controls are
 * filled in by the tasks that own them (preferences, backup, appearance).
 */
export default function SettingsPage() {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="mx-auto max-w-2xl">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-6 font-semibold text-2xl focus-visible:outline-none"
      >
        {t('nav.settings')}
      </h1>
    </div>
  );
}
