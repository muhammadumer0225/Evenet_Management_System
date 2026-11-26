
import { useCallback, useEffect, useState } from 'react';
import { MessageCircleHeart } from 'lucide-react';

import FeedbackForm from '../../components/FeedbackForm';
import { Badge, EmptyState, PageHeader, StatusBadge } from '../../components/ui';
import { getMyFeedback } from '../../lib/api';
import { timeAgo } from '../../lib/utils';

const T = {
  suggestion: 'Suggestion',
  issue: 'Issue',
  question: 'Question',
};

export default function Feedback() {
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFeedback = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const data = await getMyFeedback();
      setMine(data.feedbacks || []);
    } catch (err) {
      setError(err.message || 'Unable to load feedback history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  return (
    <>
      <PageHeader
        title="Help & feedback"
        subtitle="Share a suggestion, report a problem or ask us anything."
      />

      <div className="split">
        <div className="card card-pad">
          <FeedbackForm onSent={loadFeedback} />
        </div>

        <aside className="card card-flush">
          <div className="card-head">
            <h3>Your feedback</h3>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              Loading feedback...
            </div>
          ) : error ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <p>{error}</p>
              <button className="btn btn-outline" onClick={loadFeedback}>
                Retry
              </button>
            </div>
          ) : mine.length ? (
            <ul className="fb-list">
              {mine.map((f) => (
                <li key={f._id}>
                  <div className="row between top">
                    <strong>{f.subject}</strong>
                    <StatusBadge status={f.status} />
                  </div>

                  <div className="row gap-sm xs faint">
                    <Badge>{T[f.type] || f.type}</Badge>
                    {timeAgo(f.createdAt)}
                  </div>

                  {f.expo?.title && <p className="xs muted">Expo: {f.expo.title}</p>}

                  {f.note && (
                    <p className="small muted">
                      Team note: {f.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={MessageCircleHeart}
              title="No feedback yet"
              text="Messages you send will be tracked here."
            />
          )}
        </aside>
      </div>
    </>
  );
}
