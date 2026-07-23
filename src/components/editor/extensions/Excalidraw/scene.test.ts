import { describe, expect, it } from 'vitest';
import { emptyScene, parseScene, sceneToFile } from './scene';

describe('excalidraw scene helpers', () => {
  it('emptyScene has empty elements and a background color', () => {
    const s = emptyScene();
    expect(s.elements).toEqual([]);
    expect(s.appState.viewBackgroundColor).toBe('#ffffff');
    expect(s.files).toEqual({});
  });

  it('sceneToFile produces an application/json File', () => {
    const f = sceneToFile(emptyScene());
    expect(f.type).toBe('application/json');
    expect(f.name).toBe('drawing.excalidraw.json');
  });

  it('sceneToFile -> parseScene round-trips', async () => {
    const scene = { elements: [{ id: 'a' }], appState: { zoom: 1 }, files: {} };
    const text = await sceneToFile(scene).text();
    expect(parseScene(text)).toEqual(scene);
  });

  it('parseScene returns null on malformed JSON', () => {
    expect(parseScene('{not json')).toBeNull();
  });
});
