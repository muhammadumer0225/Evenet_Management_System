
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ExpoCard } from '../components/Cards';
import { EmptyState, SearchBox } from '../components/ui';
import { CATEGORIES } from '../lib/seed';
import { getPublishedExpos } from '../lib/api';
import { normalizeExpo } from '../lib/normalizers';
import { useExpoRealtimeVersion } from '../hooks/useExpoRealtimeVersion';

export default function Expos() {
  const { db } = useAuth();
  const realtimeVersion = useExpoRealtimeVersion();
  const [sp, setSp] = useSearchParams();

  const [expos, setExpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = sp.get('q') || '';
  const cat = sp.get('category') || '';
  const status = sp.get('status') || '';
  const sort = sp.get('sort') || 'date';

  useEffect(() => {
    let active = true;

    async function loadExpos() {
      try {
        setLoading(true);
        setError('');

        const data = await getPublishedExpos();

        if (active) {
          setExpos(data.map(normalizeExpo));
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load expos.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadExpos();

    return () => {
      active = false;
    };
  }, [realtimeVersion]);

  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };

  const list = useMemo(() => {
    let result = expos.filter((expo) => {
      const hay = `${expo.title} ${expo.theme || ''} ${expo.location} ${expo.category} ${(expo.tags || []).join(' ')}`.toLowerCase();

      return (
        (!q || hay.includes(q.toLowerCase())) &&
        (!cat || expo.category === cat) &&
        (!status || expo.status === status)
      );
    });

    result = result.slice().sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : a.startDate.localeCompare(b.startDate)
    );

    if (sort === 'date') {
      const order = { live: 0, upcoming: 1, completed: 2 };
      result.sort(
        (a, b) =>
          (order[a.status] ?? 3) - (order[b.status] ?? 3) ||
          a.startDate.localeCompare(b.startDate)
      );
    }

    return result;
  }, [expos, q, cat, status, sort]);

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Expo directory</span>
          <h1>Find your next expo</h1>
          <p className="muted">
            Trade shows, summits and fairs across industries — register, exhibit or just explore.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <SearchBox
          value={q}
          onChange={(v) => set('q', v)}
          placeholder="Search expos, themes, cities…"
        />

        <select
          className="select"
          value={status}
          onChange={(e) => set('status', e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="live">Live now</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>

        <select
          className="select"
          value={sort}
          onChange={(e) => set('sort', e.target.value)}
          aria-label="Sort"
        >
          <option value="date">Sort: Date</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      <div className="chip-row" style={{ marginBottom: 24 }}>
        <button
          className={`chip ${!cat ? 'active' : ''}`}
          onClick={() => set('category', '')}
        >
          All industries
        </button>

        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip ${cat === c ? 'active' : ''}`}
            onClick={() => set('category', cat === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card card-pad">
          <p className="muted">Loading expos from server...</p>
        </div>
      ) : error ? (
        <div className="card card-pad">
          <h3>Unable to load expos</h3>
          <p className="muted">{error}</p>
          <button
            className="btn btn-outline"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      ) : list.length ? (
        <div className="grid grid-3">
          {list.map((expo) => (
            <ExpoCard key={expo.id} expo={expo} db={db} />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={CalendarX}
            title="No expos match your filters"
            text="Try clearing a filter or searching for something broader."
            action={
              <button
                className="btn btn-outline"
                onClick={() => setSp({})}
              >
                Clear filters
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
