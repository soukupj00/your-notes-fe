import type React from 'react';
import { useState } from 'react';
import { ColorPicker } from '@/components/ColorPicker.tsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { ScrollArea } from '@/components/ui/scroll-area.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import type { Note, NoteAudio, NoteFile, NoteImage } from '@/models.ts';

interface NoteCardProps {
  note?: Note;
  images?: NoteImage[];
  audios?: NoteAudio[];
  files?: NoteFile[];
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  images = [],
  audios = [],
  files = [],
}) => {
  const [bgColor, setBgColor] = useState<string>('');

  return (
    note && (
      <Card
        className="w-full max-w-lg shadow-md transition-colors duration-300"
        style={{ backgroundColor: bgColor }}
      >
        {/* Header */}
        {note.header && (
          <CardHeader>
            <h2 className="font-semibold text-xl">{note.header}</h2>
          </CardHeader>
        )}

        <CardContent className="space-y-4">
          {/* Description */}
          {note.description && <p>{note.description}</p>}

          {/* Checklist */}
          {note.checklist && note.checklist.length > 0 && (
            <div>
              <Separator className="my-2" />
              <h4 className="mb-2 font-medium text-sm">Checklist</h4>
              <div className="space-y-2">
                {note.checklist.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox id={`item-${index}`} />
                    <label htmlFor={`item-${index}`} className="text-sm">
                      {item}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audio */}
          {audios.length > 0 && (
            <div>
              <Separator className="my-2" />
              <h4 className="mb-2 font-medium text-sm">Audio</h4>
              <div className="flex flex-col gap-3">
                {audios.map((audio) => (
                  <audio key={audio.id} controls src={audio.url} className="w-full">
                    <track kind="captions" />
                  </audio>
                ))}
              </div>
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div>
              <Separator className="my-2" />
              <h4 className="mb-2 font-medium text-sm">Images</h4>
              <ScrollArea className="h-32 w-full rounded-md border p-2">
                <div className="flex gap-2">
                  {images.map((img) => (
                    <img
                      key={img.id}
                      src={img.url}
                      alt={img.name || 'Note image'}
                      className="h-24 w-24 rounded object-cover"
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div>
              <Separator className="my-2" />
              <h4 className="mb-2 font-medium text-sm">Files</h4>
              <ul className="list-inside list-disc space-y-1">
                {files.map((file) => (
                  <li key={file.id}>
                    <a
                      href={file.url}
                      download={file.name}
                      className="text-blue-500 hover:underline"
                    >
                      {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ColorPicker color={bgColor} onChange={setBgColor} />
        </CardContent>
      </Card>
    )
  );
};
