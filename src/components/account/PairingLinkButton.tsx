import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { encode } from 'uqr';
import { Button } from '@/components/ui/button.tsx';
import { LinkDialog } from '@/components/ui/LinkDialog.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { pairingLink } from '@/contract/index.ts';
import { useAction } from '@/hooks/useAction.ts';

/**
 * Black on white in both themes: not every scanner reads an inverted code. The
 * four-module border is the quiet zone the QR specification asks for.
 */
export function PairingQr({ value, label }: { value: string; label: string }) {
  const { data } = useMemo(() => encode(value, { border: 4 }), [value]);
  const path = data
    .flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])))
    .join('');
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${data.length} ${data.length}`}
      shapeRendering="crispEdges"
      className="mx-auto size-56 rounded-md bg-white"
    >
      <path d={path} fill="#000" />
    </svg>
  );
}

/** Mints a fresh code each time it opens, because each one works once and for ten minutes. */
export function PairingLinkButton({ kind, label }: { kind: 'device' | 'invite'; label: string }) {
  const { t } = useTranslation();
  const { service } = useAccount();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const { run } = useAction();

  const show = async () => {
    if (!service) return;
    setLink(null);
    setOpen(true);
    const made = await run(
      async () => {
        const { code } = await (kind === 'device'
          ? service.createDeviceCode()
          : service.createInvite());
        setLink(pairingLink(window.location.origin, code));
      },
      { failure: 'account.qr.failed' }
    );
    if (!made) setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void show()}>
        {label}
      </Button>
      <LinkDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description={t(
          kind === 'device' ? 'account.qr.deviceDescription' : 'account.qr.inviteDescription'
        )}
        link={link}
      >
        {link && (
          <>
            <PairingQr value={link} label={label} />
            <p className="text-muted-foreground text-sm">{t('account.qr.expires')}</p>
            <p className="text-sm">{t('account.qr.orOpen')}</p>
          </>
        )}
      </LinkDialog>
    </>
  );
}
