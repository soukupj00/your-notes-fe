import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useTheme } from '@/context/themeProvider.tsx';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';

export function ThemeModeToggleButton() {
  const { t } = useTranslation();
  const { resolvedTheme, systemTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  // Landing on the OS's own scheme hands the choice back to System, so an OS schedule keeps working.
  const handleToggle = () => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next === systemTheme ? 'system' : next);
  };

  return (
    <IconTooltip label={t('settings.theme.toggle')}>
      <Button
        variant="ghost"
        size="icon"
        className={CHROME_ICON_BUTTON}
        onClick={handleToggle}
        aria-label={t('settings.theme.toggle')}
      >
        {isDark ? <Moon className="size-[1.2rem]" /> : <Sun className="size-[1.2rem]" />}
      </Button>
    </IconTooltip>
  );
}
