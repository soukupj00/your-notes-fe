import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Palette } from 'lucide-react';
import * as React from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="icon" title="Pick a color">
          <Palette className="" />
        </Button>
      </DialogTrigger>

      <DialogContent className="flex w-fit items-center justify-center border-none p-11 shadow-none">
        <HexColorPicker color={color} onChange={onChange} />
      </DialogContent>
    </Dialog>
  );
}
