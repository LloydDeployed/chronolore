export interface PreviewRevealPoint {
  revealPointId: string;
  entryId: string;
}

/**
 * Progress within one book/entry is a contiguous prefix. Advancing to a
 * checkpoint includes earlier relevant checkpoints; moving back removes later
 * ones. Selections from other books remain independent.
 */
export function updateEntryProgress(
  revealPoints: PreviewRevealPoint[],
  selectedIds: Set<string>,
  targetId: string,
): Set<string> {
  const targetIndex = revealPoints.findIndex((point) => point.revealPointId === targetId);
  if (targetIndex === -1) return new Set(selectedIds);

  const target = revealPoints[targetIndex];
  const isMovingBack = selectedIds.has(targetId);
  const next = new Set(selectedIds);

  revealPoints.forEach((point, index) => {
    if (point.entryId !== target.entryId) return;
    if (isMovingBack && index >= targetIndex) next.delete(point.revealPointId);
    if (!isMovingBack && index <= targetIndex) next.add(point.revealPointId);
  });

  return next;
}
