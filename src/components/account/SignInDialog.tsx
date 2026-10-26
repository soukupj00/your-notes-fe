import { useTranslation } from 'react-i18next';
import { AccountForm } from '@/components/account/AccountForm.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';

export function SignInDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { service, setSession } = useAccount();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('account.section.signIn')}</DialogTitle>
          <DialogDescription>{t('account.section.signInDescription')}</DialogDescription>
        </DialogHeader>
        <AccountForm
          credentials="current"
          via="password"
          submitLabel={t('account.section.signIn')}
          onSubmit={async ({ username, password, deviceName }) => {
            if (!service) return;
            setSession(await service.signIn(username, password, deviceName));
            onOpenChange(false);
          }}
          secondary={
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('account.cancel')}
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
