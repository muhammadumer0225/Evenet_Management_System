import { cx, initials, money } from '../lib/utils';

export function PlanLegend({ items = ['available', 'reserved', 'booked', 'blocked', 'mine'] }) {
  const L = {
    available: 'Available',
    reserved: 'Reserved (awaiting confirmation)',
    booked: 'Confirmed',
    blocked: 'Unavailable',
    mine: 'Your booth',
    selected: 'Selected',
  };
  return (
    <ul className="plan-legend" aria-label="Floor plan legend">
      {items.map((k) => (
        <li key={k}>
          <i className={`lg lg-${k}`} />
          {L[k]}
        </li>
      ))}
    </ul>
  );
}

/**
 * Interactive floor plan.
 * mode: 'view' (booked booths clickable) | 'select' (available booths clickable) | 'manage' (everything clickable)
 */
export default function FloorPlan({ booths, layout, mode = 'view', selectedId, onSelect, userId, users = [], highlightIds = [] }) {
  const rows = layout?.rows || 5;
  const cols = layout?.cols || 8;
  const midCol = Math.ceil(cols / 2) - 1;
  const grid = booths.slice().sort((a, b) => a.row - b.row || a.col - b.col);
  const positioned = grid.some((b) => b.position && Number.isFinite(Number(b.position.x)) && Number.isFinite(Number(b.position.y)));
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));

  const clickable = (b) => {
    if (!onSelect) return false;
    if (mode === 'manage') return true;
    if (mode === 'select') return b.status === 'available' || b.exhibitorId === userId;
    return !!b.exhibitorId;
  };

  return (
    <div className="plan" role="group" aria-label="Expo floor plan">
      <div className="plan-stage">MAIN STAGE</div>
      <div className="plan-body">
        <div className="plan-rows" aria-hidden="true">
          {Array.from({ length: rows }, (_, r) => (
            <span key={r} className={cx(r === 1 && rows > 2 && 'aisle-b')}>
              {String.fromCharCode(65 + r)}
            </span>
          ))}
        </div>
        <div className={cx("plan-grid", positioned && "plan-grid-positioned")} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {grid.map((b) => {
            const owner = byId[b.exhibitorId];
            const mine = userId && b.exhibitorId === userId;
            const can = clickable(b);
            const hl = highlightIds.includes(b.id);
            const name = owner?.company || owner?.name;
            const label = `Booth ${b.label}, ${b.zone}, size ${b.size}, ${money(b.price)}, ${b.status}${name ? ', ' + name : ''}`;
            const p = b.position || {};
            const boothStyle = positioned ? {
              left: `${Number.isFinite(Number(p.x)) ? Number(p.x) : (Number(b.col || 0) / cols) * 100 + 1}%`,
              top: `${Number.isFinite(Number(p.y)) ? Number(p.y) : (Number(b.row || 0) / rows) * 100 + 1}%`,
              width: `${Number(p.width) > 0 ? Number(p.width) : Math.max(6, 100 / cols - 3)}%`,
              height: `${Number(p.height) > 0 ? Number(p.height) : Math.max(8, 100 / rows - 3)}%`,
            } : undefined;
            return (
              <button
                key={b.id}
                type="button"
                disabled={!can}
                onClick={() => onSelect?.(b)}
                aria-label={`${label}, ${b.zone || 'Main Hall'}`}
                aria-pressed={selectedId === b.id}
                style={boothStyle}
                title={`${b.label} · ${b.zone || 'Main Hall'} · ${b.size} · ${money(b.price)}${name ? ' · ' + name : ''}`}
                className={cx(
                  'booth',
                  `booth-${b.status}`,
                  `booth-${b.size}`,
                  mine && 'booth-mine',
                  selectedId === b.id && 'booth-selected',
                  hl && 'booth-hl',
                  b.col === midCol && cols > 3 && 'aisle-r',
                  b.row === 1 && rows > 2 && 'aisle-b',
                  can && 'booth-click',
                )}
              >
                <span className="booth-label">{b.label}</span>
                <span className="booth-sub">{owner ? initials(name) : b.status === 'blocked' ? '—' : b.size}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="plan-entrance">▲ MAIN ENTRANCE</div>
    </div>
  );
}
