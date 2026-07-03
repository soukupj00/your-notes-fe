import { Palette } from 'lucide-react';
import * as React from 'react';
import { ColorPickerPanel } from '@/components/color-picker/ColorPickerPanel';
import { CARD_COLORS } from '@/components/color-picker/palettes';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          size="icon"
          title="Pick a color"
          className="rounded-full p-0 shadow-none"
        >
          <Palette />
        </Button>
      </DialogTrigger>

      <DialogContent className="w-fit pt-10" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Pick a color</DialogTitle>
        <ColorPickerPanel palette={CARD_COLORS} value={color} onChange={onChange} />
      </DialogContent>
    </Dialog>
  );
}
