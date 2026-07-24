import type * as React from 'react';
import { icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

export type EntityActionButtonProps = Omit<React.ComponentProps<typeof Button>, 'children'> & {
  label?: React.ReactNode;
};

type EntityActionButtonBaseProps = EntityActionButtonProps & {
  defaultLabel: string;
  icon: 'Save' | 'Trash2' | 'Pencil';
};

function EntityActionButton({
  defaultLabel,
  icon,
  label,
  type = 'button',
  ...props
}: EntityActionButtonBaseProps) {
  const Icon = icons[icon];

  return (
    <Button type={type} {...props}>
      <Icon aria-hidden />
      {label ?? defaultLabel}
    </Button>
  );
}

export function SaveButton({ label = 'Save', ...props }: EntityActionButtonProps) {
  return <EntityActionButton defaultLabel="Save" icon="Save" label={label} {...props} />;
}

export function DeleteButton({
  label = 'Delete',
  variant = 'destructive',
  ...props
}: EntityActionButtonProps) {
  return (
    <EntityActionButton
      defaultLabel="Delete"
      icon="Trash2"
      label={label}
      variant={variant}
      {...props}
    />
  );
}

export function EditButton({
  label = 'Edit',
  variant = 'outline',
  ...props
}: EntityActionButtonProps) {
  return (
    <EntityActionButton
      defaultLabel="Edit"
      icon="Pencil"
      label={label}
      variant={variant}
      {...props}
    />
  );
}
