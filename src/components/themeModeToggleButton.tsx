import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useTheme } from '@/context/themeProvider.tsx';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';

export function ThemeModeToggleButton() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const isDark = theme === 'dark';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
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
