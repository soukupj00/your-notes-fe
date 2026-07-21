import { Navbar } from '@/components/ui/navbar.tsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      {/* ===== CONTENT ===== */}
      {/* Extra bottom padding on mobile so the fixed quick-capture bar
          (rendered by NotesHome) never covers content. */}
      <main className="flex-1 px-4 pt-6 pb-24 sm:pb-6">{children}</main>
    </div>
  );
}
