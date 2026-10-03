import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';

/**
 * A link to hand on: the Share Link and both Pairing Links. `link` is null while the server is
 * still minting it. `children` sit above the link (a QR and its captions), `actions` before Copy.
 */
export function LinkDialog({
  open,
  onOpenChange,
  title,
  description,
  link,
  children,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  link: string | null;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success(t('account.qr.copied'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="flex flex-col gap-3">
            {children}
            <code className="select-all break-all rounded-md border bg-muted px-2 py-1 text-xs">
              {link}
            </code>
          </div>
        ) : (
          <p className="flex h-56 items-center justify-center gap-2 text-muted-foreground text-sm">
            <Spinner />
            {t('account.qr.making')}
          </p>
        )}
        <DialogFooter>
          {actions}
          <Button variant="outline" disabled={!link} onClick={() => void copy()}>
            {t('account.qr.copy')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t('account.qr.done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
