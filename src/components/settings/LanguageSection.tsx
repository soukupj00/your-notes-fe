import { useTranslation } from 'react-i18next';
import { LocaleFlag } from '@/components/LocaleFlag.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import i18n from '@/i18n';
import { listLocales } from '@/lib/locales.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/**
 * Not a `PreferencesProvider` field: i18next's detector owns the language and keeps it in
 * `localStorage` itself (CLAUDE.md, i18n). A Select, because the list outgrows a segmented control.
 */
export function LanguageSection() {
  const { t } = useTranslation();
  const locales = listLocales();

  return (
    <SettingsSection title={t('settings.language.title')}>
      <SettingsRow label={t('settings.locale.label')}>
        <Select
          value={i18n.resolvedLanguage}
          onValueChange={(code) => {
            void i18n.changeLanguage(code);
          }}
        >
          <SelectTrigger className="w-44" aria-label={t('settings.locale.label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locales.map((locale) => (
              <SelectItem key={locale.code} value={locale.code}>
                <LocaleFlag locale={locale} />
                {locale.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
    </SettingsSection>
  );
}

export default LanguageSection;
