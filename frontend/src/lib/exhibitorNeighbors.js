const getId = (value) => value && typeof value === 'object'
  ? String(value._id || value.id || '')
  : String(value || '');

const rectangleOf = (booth) => {
  const position = booth?.position;
  if (!position) return null;
  const x = Number(position.x);
  const y = Number(position.y);
  const width = Number(position.width);
  const height = Number(position.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { left: x, top: y, right: x + width, bottom: y + height };
};

/** Return true when two positioned booth rectangles touch or are within a small floor-plan gap. */
export function areBoothsAdjacent(first, second, tolerance = 2.5) {
  const a = rectangleOf(first);
  const b = rectangleOf(second);
  if (!a || !b) return false;

  const gapX = Math.max(0, b.left - a.right, a.left - b.right);
  const gapY = Math.max(0, b.top - a.bottom, a.top - b.bottom);
  const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

  if (gapX > tolerance || gapY > tolerance) return false;
  // Edge neighbours share horizontal or vertical span. Corner neighbours are
  // included only when both gaps are small, which avoids distant row matches.
  return overlapX > 0 || overlapY > 0 || (gapX > 0 && gapY > 0);
}

export function findNeighborBooths(ownBooth, booths, currentUserId) {
  const ownId = getId(ownBooth);
  const userId = getId(currentUserId);
  return (booths || []).filter((booth) => {
    const boothId = getId(booth);
    const exhibitorId = getId(booth.exhibitor);
    if (!booth.exhibitor || !boothId || boothId === ownId || exhibitorId === userId) return false;
    return areBoothsAdjacent(ownBooth, booth);
  });
}
