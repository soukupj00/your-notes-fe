export type NoteFeedLayoutMode = 'masonry' | 'stack';

export type NoteFeedPlacement = {
  x: number;
  y: number;
  width: number;
};

export type NoteFeedLayout = {
  placements: Record<string, NoteFeedPlacement>;
  height: number;
  itemWidth: number;
  columns: number;
};

type NoteFeedLayoutInput = {
  mode: NoteFeedLayoutMode;
  containerWidth: number;
  gap: number;
  minColumnWidth: number;
  items: ReadonlyArray<{ id: string; height: number }>;
};

const TIE_TOLERANCE = 0.5;
const STACK_MAX_WIDTH = 704;

/**
 * Items keep input order and masonry only picks the shortest column for each, so DOM order stays
 * the reading order while the wall still packs tightly.
 */
export function calculateNoteFeedLayout({
  mode,
  containerWidth,
  gap,
  minColumnWidth,
  items,
}: NoteFeedLayoutInput): NoteFeedLayout {
  const safeWidth = Math.max(0, containerWidth);
  const safeGap = Math.max(0, gap);
  const columns =
    mode === 'stack'
      ? 1
      : Math.max(1, Math.floor((safeWidth + safeGap) / (minColumnWidth + safeGap)));
  const itemWidth =
    mode === 'stack'
      ? Math.min(safeWidth, STACK_MAX_WIDTH)
      : Math.max(0, (safeWidth - safeGap * (columns - 1)) / columns);
  const stackInset = mode === 'stack' ? (safeWidth - itemWidth) / 2 : 0;
  const columnHeights = new Array<number>(columns).fill(0);
  const placements: Record<string, NoteFeedPlacement> = {};

  for (const item of items) {
    let targetColumn = 0;
    for (let column = 1; column < columns; column += 1) {
      if (columnHeights[column] < columnHeights[targetColumn] - TIE_TOLERANCE) {
        targetColumn = column;
      }
    }

    placements[item.id] = {
      x: stackInset + targetColumn * (itemWidth + safeGap),
      y: columnHeights[targetColumn],
      width: itemWidth,
    };
    columnHeights[targetColumn] += Math.max(0, item.height) + safeGap;
  }

  return {
    placements,
    height: Math.max(0, Math.max(...columnHeights, 0) - (items.length > 0 ? safeGap : 0)),
    itemWidth,
    columns,
  };
}
