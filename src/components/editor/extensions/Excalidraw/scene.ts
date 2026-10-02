import { fileExtension } from '@/lib/attachments.ts';

/** `files` is Excalidraw's own embedded-asset map, kept verbatim. */
export interface ExcalidrawScene {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

export function emptyScene(): ExcalidrawScene {
  return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} };
}

/** Collaboration is out of scope and `collaborators` is a runtime Map.
 *  JSON.stringify turns it into `{}`, which crashes Excalidraw when reopened.
 *  Omitting it lets Excalidraw restore its default empty Map. */
function withoutTransientAppState(appState: Record<string, unknown>): Record<string, unknown> {
  const persistable = { ...appState };
  delete persistable.collaborators;
  return persistable;
}

/** Serialize a scene as a JSON File so it flows through the same createAttachment
 *  path (and the same Blob-based attachments table) as every other media kind. */
export function sceneToFile(scene: ExcalidrawScene): File {
  const persistableScene = {
    ...scene,
    appState: withoutTransientAppState(scene.appState),
  };
  const name = `drawing.${fileExtension('excalidraw', 'application/json')}`;
  return new File([JSON.stringify(persistableScene)], name, { type: 'application/json' });
}

/** Tolerant parse: returns null on malformed JSON so the NodeView can show the
 *  "unavailable" state instead of throwing. Also repairs scenes saved before
 *  transient collaboration state was excluded. */
export function parseScene(text: string): ExcalidrawScene | null {
  try {
    const scene = JSON.parse(text) as ExcalidrawScene;
    return {
      ...scene,
      appState: withoutTransientAppState(scene.appState),
    };
  } catch {
    return null;
  }
}

/** The one place that loads the heavy exporter, never on the card path. A dynamic import,
 *  because the package calls canvas.getContext() at module scope, which crashes under jsdom. */
export async function sceneToSvgString(scene: ExcalidrawScene): Promise<string> {
  const { exportToSvg } = await import('@excalidraw/excalidraw');
  const svg = await exportToSvg({
    elements: scene.elements as never,
    appState: scene.appState as never,
    files: scene.files as never,
  });
  return new XMLSerializer().serializeToString(svg);
}
