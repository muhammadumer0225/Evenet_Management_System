import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, Move, Save } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function initialPosition(booth, index, total) {
  const p = booth.position || {};
  if ([p.x, p.y, p.width, p.height].every((v) => Number.isFinite(Number(v)))) {
    return { x: Number(p.x), y: Number(p.y), width: Number(p.width), height: Number(p.height) };
  }
  const cols = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(total * 1.4))));
  const rows = Math.max(1, Math.ceil(total / cols));
  const gap = 1.2;
  const width = Math.max(6, Math.min(12, (100 - gap * (cols + 1)) / cols));
  const height = Math.max(7, Math.min(14, (74 - gap * Math.max(0, rows - 1)) / rows));
  return {
    x: gap + (index % cols) * (width + gap),
    y: 14 + Math.floor(index / cols) * (height + gap),
    width,
    height,
  };
}

export default function FloorPlanEditor({ booths = [], selectedId, onSelect, onSavePosition, backgroundImage = '' }) {
  const stageRef = useRef(null);
  const interaction = useRef(null);
  const [positions, setPositions] = useState({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [savingId, setSavingId] = useState('');
  const [dirtyIds, setDirtyIds] = useState([]);

  const sortedBooths = useMemo(() => booths.slice().sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true })), [booths]);

  useEffect(() => {
    const next = {};
    sortedBooths.forEach((booth, index) => { next[booth.id] = initialPosition(booth, index, sortedBooths.length); });
    setPositions(next);
    setDirtyIds([]);
  }, [sortedBooths]);

  const startInteraction = (event, booth, action) => {
    event.preventDefault();
    event.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const current = positions[booth.id] || initialPosition(booth, 0, sortedBooths.length);
    interaction.current = {
      action, id: booth.id, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY,
      stageWidth: rect.width, stageHeight: rect.height,
      initial: { ...current },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelect?.(booth);
  };

  const onPointerMove = (event) => {
    const active = interaction.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = ((event.clientX - active.startX) / active.stageWidth) * 100 / zoom;
    const dy = ((event.clientY - active.startY) / active.stageHeight) * 100 / zoom;
    if (active.action === 'pan') {
      setPan((p) => ({ x: p.x + event.movementX, y: p.y + event.movementY }));
      return;
    }
    setPositions((current) => {
      const p = current[active.id] || active.initial;
      const next = active.action === 'resize'
        ? { ...p, width: clamp(active.initial.width + dx, 4, 40), height: clamp(active.initial.height + dy, 5, 40) }
        : { ...p, x: clamp(active.initial.x + dx, 0, 100 - p.width), y: clamp(active.initial.y + dy, 0, 100 - p.height) };
      return { ...current, [active.id]: next };
    });
    setDirtyIds((ids) => ids.includes(active.id) ? ids : [...ids, active.id]);
  };

  const finishInteraction = async (event) => {
    const active = interaction.current;
    if (!active || active.pointerId !== event.pointerId) return;
    interaction.current = null;
    if (active.action === 'pan') return;
    const position = positions[active.id];
    if (!position || !onSavePosition) return;
    setSavingId(active.id);
    try {
      await onSavePosition(active.id, { ...position, rotation: 0 });
      setDirtyIds((ids) => ids.filter((id) => id !== active.id));
    } catch {
      // The parent reports the API error and reloads the persisted booth position.
    } finally {
      setSavingId('');
    }
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <section className="floor-editor" aria-label="Interactive floor plan editor">
      <div className="floor-editor-toolbar">
        <div className="floor-editor-hint"><Move size={15} /> Drag booths to move · Drag corner to resize · Drag empty canvas to pan</div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setZoom((z) => clamp(Number((z - 0.1).toFixed(2)), 0.5, 2))} aria-label="Zoom out"><Minus size={15} /></button>
          <span className="small muted" style={{ minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setZoom((z) => clamp(Number((z + 0.1).toFixed(2)), 0.5, 2))} aria-label="Zoom in"><Plus size={15} /></button>
          <button type="button" className="btn btn-outline btn-sm" onClick={resetView}><RotateCcw size={15} /> Reset</button>
        </div>
      </div>
      <div className="floor-editor-viewport">
        <div
          ref={stageRef}
          className="floor-editor-stage"
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return;
            interaction.current = { action: 'pan', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={finishInteraction}
          onPointerCancel={finishInteraction}
          style={{ backgroundImage: backgroundImage ? `linear-gradient(#ffffff22,#ffffff22), url("${backgroundImage}")` : undefined, cursor: interaction.current?.action === 'pan' ? 'grabbing' : 'grab' }}
        >
          <div className="floor-editor-canvas" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <div className="floor-editor-stage-label">MAIN STAGE</div>
            {sortedBooths.map((booth, index) => {
              const p = positions[booth.id] || initialPosition(booth, index, sortedBooths.length);
              const status = booth.status === 'occupied' ? 'booked' : booth.status;
              const active = selectedId === booth.id;
              return (
                <div
                  key={booth.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Move booth ${booth.label}`}
                  aria-pressed={active}
                  className={`floor-editor-booth booth-${status || 'available'}${active ? ' is-selected' : ''}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.width}%`, height: `${p.height}%` }}
                  onPointerDown={(event) => startInteraction(event, booth, 'move')}
                  onClick={() => onSelect?.(booth)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect?.(booth); }}
                >
                  <strong>{booth.label || `Booth ${index + 1}`}</strong>
                  <small>{booth.zone || booth.size || status}</small>
                  {savingId === booth.id && <span className="floor-editor-saving">Saving…</span>}
                  {dirtyIds.includes(booth.id) && savingId !== booth.id && <span className="floor-editor-dirty">Unsaved</span>}
                  <span className="floor-editor-resize" role="presentation" onPointerDown={(event) => startInteraction(event, booth, 'resize')} />
                </div>
              );
            })}
            <div className="floor-editor-entrance">MAIN ENTRANCE</div>
          </div>
        </div>
      </div>
      <div className="floor-editor-footer"><span className="small muted">Changes save automatically when you release a booth.</span><span className="small muted"><Save size={13} style={{ verticalAlign: 'middle' }} /> {dirtyIds.length ? `${dirtyIds.length} pending` : 'All changes saved'}</span></div>
    </section>
  );
}
