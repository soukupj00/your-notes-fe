import { NoteCard } from '@/components/cards/NoteCard.tsx';
import { useNotes } from '@/context/NotesProvider.tsx';

export function NoteContent() {
  const { notes } = useNotes();

  return notes ? (
    <div className="flex flex-col items-center justify-center gap-4">
      {notes.map((note) => (
        <NoteCard note={note} key={note.id} />
      ))}
    </div>
  ) : (
    <div />
  );
}
