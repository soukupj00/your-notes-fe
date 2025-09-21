'use client';

// --- shadcn/ui ---
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';

// --------------------
// Minimal Attachment Node (open-source friendly)
// Renders an inline chip linking to a file URL.
// --------------------
import { mergeAttributes, Node } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
// --------------------
// Toolbar Component
// --------------------
import type { Editor } from '@tiptap/react';
import { BubbleMenu, EditorContent, FloatingMenu, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

// --- lucide icons ---
import {
  Bold,
  Code2,
  FilePlus2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List as ListIcon,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

export interface AttachmentAttrs {
  url: string;
  name?: string;
  type?: string;
  size?: number;
}

export const Attachment = Node.create({
  name: 'attachment',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: '' },
      name: { default: null },
      type: { default: null },
      size: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-attachment]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { url, name, type, size } = HTMLAttributes as AttachmentAttrs;
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-attachment': 'true',
        class:
          'inline-flex items-center gap-2 rounded-2xl border px-2 py-1 text-sm no-underline hover:bg-accent',
      }),
      ['span', { class: 'i-lucide:file-plus-2 inline-block w-4 h-4' }],
      ['span', {}, name || 'Attachment'],
      type
        ? ['span', { class: 'opacity-60 ml-1' }, `(${type}${size ? ', ' + prettyBytes(size) : ''})`]
        : '',
    ];
  },

  addCommands() {
    return {
      setAttachment:
        (attrs: AttachmentAttrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs });
        },
    };
  },
});

function prettyBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

// --------------------
// Types & Props
// --------------------
export type TiptapEditorProps = {
  value?: string; // JSON or HTML; see contentFormat
  contentFormat?: 'html' | 'json'; // default html
  autofocus?: boolean;
  placeholder?: string;
  onUpdate?: (html: string, json: object) => void;
  className?: string;
  // Upload handlers (return a URL to be stored in the doc)
  onUploadImage?: (file: File) => Promise<string>;
  onUploadFile?: (file: File) => Promise<AttachmentAttrs>;
  editable?: boolean;
};

// --------------------
// Main Component
// --------------------
const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value,
  contentFormat = 'html',
  autofocus,
  placeholder = 'Write something…',
  onUpdate,
  className,
  onUploadImage,
  onUploadFile,
  editable = true,
}) => {
  const editor = useEditor(
    {
      extensions: [
        Color.configure({ types: ['textStyle'] }),
        TextStyle,
        Underline,
        Link.configure({ openOnClick: true, autolink: true, linkOnPaste: true }),
        Image.configure({ allowBase64: true }),
        Attachment,
        StarterKit.configure({
          bulletList: { keepMarks: true },
          orderedList: { keepMarks: true },
          codeBlock: false,
        }),
        Placeholder.configure({ placeholder }),
      ],
      autofocus: autofocus ? 'end' : undefined,
      editable,
      content: useMemo(() => {
        if (!value) return '';
        if (contentFormat === 'json') {
          try {
            return JSON.parse(value);
          } catch {
            return value; // fallback to HTML if bad JSON
          }
        }
        return value;
      }, [value, contentFormat]),
      onUpdate: ({ editor }) => {
        onUpdate?.(editor.getHTML(), editor.getJSON());
      },
    },
    [value, contentFormat, placeholder, editable]
  );

  // File inputs (hidden)
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickImage = useCallback(() => imageInputRef.current?.click(), []);
  const pickFile = useCallback(() => fileInputRef.current?.click(), []);

  const handleImageSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;
      try {
        let url: string;
        if (onUploadImage) {
          url = await onUploadImage(file);
        } else {
          // Fallback: base64 embed (not ideal for large images)
          url = await fileToDataURL(file);
        }
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (err) {
        console.error('Image upload failed', err);
      } finally {
        e.currentTarget.value = '';
      }
    },
    [editor, onUploadImage]
  );

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;
      try {
        let attrs: AttachmentAttrs;
        if (onUploadFile) {
          attrs = await onUploadFile(file);
        } else {
          // Basic fallback: store as object URL (ephemeral; consumer should supply an uploader)
          const url = URL.createObjectURL(file);
          attrs = { url, name: file.name, size: file.size, type: file.type };
        }
        editor.chain().focus().setAttachment(attrs).run();
      } catch (err) {
        console.error('File upload failed', err);
      } finally {
        e.currentTarget.value = '';
      }
    },
    [editor, onUploadFile]
  );

  if (!editor) return null;

  return (
    <div className={'w-full max-w-none ' + (className ?? '')}>
      <Toolbar editor={editor} onPickImage={pickImage} onPickFile={pickFile} />

      <div className="bg-background/50 rounded-2xl border p-3">
        <EditorContent
          editor={editor}
          className="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none focus:outline-none"
        />
      </div>

      {/* Hidden pickers */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

      {/* Contextual menus */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}>
        <InlineBubble editor={editor} />
      </BubbleMenu>
      <FloatingMenu editor={editor} tippyOptions={{ duration: 150 }}>
        <BlockStarter editor={editor} />
      </FloatingMenu>
    </div>
  );
};

export default TiptapEditor;

const Toolbar: React.FC<{
  editor: Editor;
  onPickImage: () => void;
  onPickFile: () => void;
}> = ({ editor, onPickImage, onPickFile }) => {
  const setLink = useCallback(() => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter URL', previous || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const [color, setColor] = useState<string>('#000000');

  const applyColor = useCallback(
    (value: string) => {
      setColor(value);
      editor.chain().focus().setColor(value).run();
    },
    [editor]
  );

  return (
    <div className="bg-card mb-3 flex flex-wrap items-center gap-2 rounded-2xl border p-2 shadow-sm">
      <div className="flex items-center gap-1">
        <Toggle
          size="sm"
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('underline')}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('strike')}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('code')}
          onPressedChange={() => editor.chain().focus().toggleCode().run()}
        >
          <Code2 className="h-4 w-4" />
        </Toggle>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 1 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 2 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('heading', { level: 3 })}
          onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          aria-label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Toggle>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-1">
        <Toggle
          size="sm"
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" onClick={onPickImage}>
          <ImageIcon className="mr-2 h-4 w-4" /> Image
        </Button>
        <Button variant="secondary" size="sm" onClick={onPickFile}>
          <FilePlus2 className="mr-2 h-4 w-4" /> File
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="mr-1 h-4 w-4" /> Undo
        </Button>
        <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="mr-1 h-4 w-4" /> Redo
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setLink()}>
          <Link2 className="mr-2 h-4 w-4" /> Link
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Unlink className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Palette className="mr-2 h-4 w-4" /> Color
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Text color</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-2">
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="h-9 w-14 p-1"
                  value={color}
                  onChange={(e) => applyColor(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => editor.chain().focus().unsetColor().run()}
                >
                  Reset
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// --------------------
// Inline Bubble Actions
// --------------------
const InlineBubble: React.FC<{ editor: Editor }> = ({ editor }) => {
  return (
    <div className="bg-popover flex items-center gap-1 rounded-xl border p-1 shadow">
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('underline')}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('strike')}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>
    </div>
  );
};

// --------------------
// Floating Block Starter (at start of empty paragraph)
// --------------------
const BlockStarter: React.FC<{ editor: Editor }> = ({ editor }) => {
  return (
    <div className="bg-popover flex items-center gap-2 rounded-xl border p-1 shadow">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="mr-2 h-4 w-4" /> H2
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon className="mr-2 h-4 w-4" /> Bullet List
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="mr-2 h-4 w-4" /> Numbered List
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="mr-2 h-4 w-4" /> Quote
      </Button>
    </div>
  );
};

// --------------------
// Utils
// --------------------
async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

// --------------------
// Suggested CSS (Tailwind prose tweaks)
// Add to your globals.css if needed:
// .ProseMirror:focus { outline: none; }
// .ProseMirror img { max-width: 100%; height: auto; }
// .ProseMirror a[data-attachment] .i-lucide\\:file-plus-2::before { content: ""; }
// --------------------
