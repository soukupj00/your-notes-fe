import { useTranslation } from 'react-i18next';
import { LocaleFlag } from '@/components/LocaleFlag.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import { type Theme, useTheme } from '@/context/themeProvider.tsx';
import i18n from '@/i18n';
import { listLocales } from '@/lib/locales.ts';
import { SegmentedSetting, SettingsRow, SettingsSection } from './SettingsSection.tsx';

const THEMES: Theme[] = ['system', 'light', 'dark'];

/**
 * Not a `PreferencesProvider` field: i18next's detector owns the language and keeps it in
 * `localStorage` itself (CLAUDE.md, i18n). A Select, because the list outgrows a segmented control.
 */
export function LanguageAndThemeSection() {
  const { t } = useTranslation();
  const locales = listLocales();

  return (
    <SettingsSection title={t('settings.general.languageAndTheme')}>
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
      <ThemeSetting />
    </SettingsSection>
  );
}

/** Not a Preference: `ThemeProvider` keeps the theme under its own storage key (CLAUDE.md, Theming). */
function ThemeSetting() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <SegmentedSetting
      label={t('settings.theme.label')}
      value={theme}
      options={THEMES.map((option) => ({ value: option, label: t(`settings.theme.${option}`) }))}
      onChange={setTheme}
    />
  );
}
