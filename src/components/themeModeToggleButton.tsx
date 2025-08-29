import { useTheme } from '@/components/themeProvider.tsx';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

export function ThemeModeToggleButton() {
  const { theme, setTheme } = useTheme();

  // Determine current mode (system resolves to OS preference)
  const isDark = theme === 'dark';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleToggle} title="Toggle theme">
      {isDark ? (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
