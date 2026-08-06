import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/themeProvider.tsx';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';

export function ThemeModeToggleButton() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  // Determine current mode (system resolves to OS preference)
  const isDark = theme === 'dark';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={CHROME_ICON_BUTTON}
      onClick={handleToggle}
      aria-label={t('settings.theme.toggle')}
      title={t('settings.theme.toggle')}
    >
      {isDark ? (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      )}
    </Button>
  );
}
