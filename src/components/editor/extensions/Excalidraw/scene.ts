/** The subset of an Excalidraw scene we persist. `files` holds Excalidraw's own
 *  embedded-asset map (kept verbatim; no UI for it this slice). */
export interface ExcalidrawScene {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

/** A fresh, empty scene for a newly inserted drawing. */
export function emptyScene(): ExcalidrawScene {
  return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} };
}

/** Serialize a scene as a JSON File so it flows through the same createAttachment
 *  path (and the same Blob-based attachments table) as every other media kind. */
export function sceneToFile(scene: ExcalidrawScene): File {
  return new File([JSON.stringify(scene)], 'drawing.excalidraw.json', {
    type: 'application/json',
  });
}

/** Tolerant parse: returns null on malformed JSON so the NodeView can show the
 *  "unavailable" state instead of throwing. */
export function parseScene(text: string): ExcalidrawScene | null {
  try {
    return JSON.parse(text) as ExcalidrawScene;
  } catch {
    return null;
  }
}

/** Render a scene to a standalone SVG string for the lightweight card snapshot.
 *  The one place that pulls the heavy exporter; never called on the card path.
 *  Dynamic import: merely importing @excalidraw/excalidraw at module scope
 *  eagerly evaluates its bundled entry, which calls canvas.getContext() and
 *  crashes under jsdom without the native canvas package. */
export async function sceneToSvgString(scene: ExcalidrawScene): Promise<string> {
  const { exportToSvg } = await import('@excalidraw/excalidraw');
  const svg = await exportToSvg({
    elements: scene.elements as never,
    appState: scene.appState as never,
    files: scene.files as never,
  });
  return new XMLSerializer().serializeToString(svg);
}
