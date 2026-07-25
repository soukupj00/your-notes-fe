import { useTranslation } from 'react-i18next';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

/** Manage-labels shell; the rename/merge/delete/colour controls land with the tags work. */
export default function LabelsPage() {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="mx-auto max-w-2xl">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-6 font-semibold text-2xl focus-visible:outline-none"
      >
        {t('nav.labels')}
      </h1>
    </div>
  );
}
