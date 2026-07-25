import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import { type Theme, useTheme } from '@/context/themeProvider.tsx';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

/**
 * One titled group of settings. Sections are the page's only structure - each
 * later slice drops its controls into an existing section (or adds one) rather
 * than inventing its own layout.
 */
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-medium text-muted-foreground text-sm">{title}</h2>
      <div className="divide-y rounded-lg border bg-card">{children}</div>
    </section>
  );
}

/** A labelled row inside a section: what it does on the left, the control on the right. */
function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

const THEMES: Theme[] = ['system', 'light', 'dark'];

function ThemeSetting() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <SettingsRow label={t('settings.theme.label')}>
      <ToggleGroup
        type="single"
        value={theme}
        // Radix clears the value when the active item is pressed again; keeping
        // the current theme makes the group behave like a radio group.
        onValueChange={(next) => setTheme((next as Theme) || theme)}
        variant="outline"
        size="sm"
        aria-label={t('settings.theme.label')}
      >
        {THEMES.map((option) => (
          <ToggleGroupItem key={option} value={option}>
            {t(`settings.theme.${option}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SettingsRow>
  );
}

/**
 * Settings shell. Appearance and Labels are wired; the remaining controls
 * (toolbar, colour-blind/density/reduced-motion, language, backup) land with
 * the tasks that own them and slot into sections here.
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

      <SettingsSection title={t('settings.appearance.title')}>
        <ThemeSetting />
      </SettingsSection>

      <SettingsSection title={t('nav.labels')}>
        <SettingsRow label={t('settings.labels.description')}>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/labels">{t('nav.editLabels')}</Link>
          </Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
