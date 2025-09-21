const tokens = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'success',
  'danger',
  'warning',
  'info',
];

export function ThemeDebugger() {
  return (
    <div className="bg-background grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4">
      {tokens.map((token) => (
        <div
          key={token}
          className={`rounded-lg border p-4 text-sm bg-${token} text-${token}-foreground`}
        >
          {token}
        </div>
      ))}
    </div>
  );
}
