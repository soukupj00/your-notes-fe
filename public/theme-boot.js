// Paints the stored theme before the first frame, so a dark theme never flashes the day canvas;
// ThemeProvider takes over once it mounts. It must read the storage key and the default exactly
// as themeProvider.tsx does, and src/context/themeBoot.test.tsx holds the two together.
{
  let theme = 'dark';
  try {
    const stored = localStorage.getItem('vite-ui-theme');
    if (stored === 'dark' || stored === 'light') theme = stored;
    if (stored === 'system') {
      theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch {
    // Blocked storage reads as the default, as in ThemeProvider.
  }
  document.documentElement.classList.add(theme);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
}
