import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ExhibitorCard } from '../components/Cards';
import { EmptyState, PageHeader, SearchBox } from '../components/ui';
import { expoById } from '../lib/selectors';
import { CATEGORIES } from '../lib/seed';

const ORDER = { live: 0, upcoming: 1, completed: 2 };

export function useExhibitorEntries(db, expoFilter) {
  return useMemo(() => {
    return db.users
      .filter((u) => u.role === 'exhibitor' && u.status === 'active' && u.consent?.directory !== false)
      .map((u) => {
        const bs = db.booths
          .filter((b) => b.exhibitorId === u.id && b.status === 'booked')
          .filter((b) => db.expos.find((e) => e.id === b.expoId)?.status !== 'draft')
          .sort((a, b) => ORDER[expoById(db, a.expoId).status] - ORDER[expoById(db, b.expoId).status]);
        const booth = expoFilter ? bs.find((b) => b.expoId === expoFilter) : bs[0];
        return { user: u, booth, expo: booth && expoById(db, booth.expoId) };
      })
      .filter((x) => x.booth);
  }, [db, expoFilter]);
}

export default function Exhibitors({ embedded }) {
  const { db } = useAuth();
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') || '';
  const cat = sp.get('category') || '';
  const expoId = sp.get('expo') || '';
  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };

  const entries = useExhibitorEntries(db, expoId);
  const list = entries.filter(({ user: u }) => {
    const hay = `${u.company} ${u.tagline} ${u.description} ${(u.products || []).join(' ')} ${u.category}`.toLowerCase();
    return (!q || q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) && (!cat || u.category === cat);
  });

  const body = (
    <>
      <div className="toolbar">
        <SearchBox value={q} onChange={(v) => set('q', v)} placeholder="Search by company, product or keyword…" className="search-wide" />
        <select className="select" value={expoId} onChange={(e) => set('expo', e.target.value)} aria-label="Filter by expo">
          <option value="">All expos</option>
          {db.expos.filter((e) => e.status !== 'draft').map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>
      <div className="chip-row" style={{ marginBottom: 22 }}>
        <button className={`chip ${!cat ? 'active' : ''}`} onClick={() => set('category', '')}>All categories</button>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => set('category', cat === c ? '' : c)}>{c}</button>
        ))}
      </div>
      <p className="small muted" style={{ marginBottom: 14 }}>{list.length} exhibitor{list.length === 1 ? '' : 's'} found</p>
      {list.length ? (
        <div className="grid grid-auto">
          {list.map(({ user, booth, expo }) => <ExhibitorCard key={user.id} user={user} booth={booth} expo={expo} />)}
        </div>
      ) : (
        <div className="card">
          <EmptyState icon={SearchX} title="No exhibitors found" text="Try a different keyword, like “solar”, “diagnostics” or “payments”." action={<button className="btn btn-outline" onClick={() => setSp({})}>Reset search</button>} />
        </div>
      )}
    </>
  );

  if (embedded)
    return (
      <>
        <PageHeader title="Find exhibitors" subtitle="Search by what they sell. Open a profile to message them or book an appointment." />
        {body}
      </>
    );
  return (
    <div className="container page">
      <PageHeader eyebrow="Exhibitor directory" title="Meet the companies on the floor" subtitle="Search and filter exhibitors by category, product or keyword, then see exactly where to find them." />
      {body}
    </div>
  );
}
