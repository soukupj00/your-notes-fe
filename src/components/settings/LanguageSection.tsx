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
 * The app's language.
 *
 * Not a `PreferencesProvider` field, and that is deliberate. i18next's detector
 * already persists the choice to `localStorage`, which is read *synchronously*
 * before first paint; the preferences blob lives in Dexie and hydrates a frame
 * later, so moving language there would show every non-English user a flash of
 * English on every cold load. It is the same reason `ThemeProvider` is still on
 * `localStorage`. The cost is real and worth stating: language does not travel
 * in the backup `.zip` and will not sync in M5.
 *
 * A Select rather than the segmented control the other settings use: this list
 * grows with every translation the project accepts, and a segmented control
 * stops working at about four options.
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
