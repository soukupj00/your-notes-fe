import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/context/themeProvider.tsx';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      // Sonner's unlayered stylesheet sets a system font stack that beats any Tailwind utility.
      style={{ fontFamily: 'var(--font-sans)' }}
      // No hotkey: its Alt+T is Option+T, a typed character, on a Mac. Sonner has no off switch and
      // `[]` matches every key, so this names a code no key has, which its label then strips to "".
      hotkey={['Key']}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
