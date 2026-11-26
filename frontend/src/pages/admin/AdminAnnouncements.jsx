
import { useEffect, useState } from 'react';
import { CalendarDays, Megaphone, Pencil, Plus, Send, Trash2, Users } from 'lucide-react';
import { useConfirm, useToast } from '../../context/UIContext';
import { EmptyState, Field, Modal, PageHeader } from '../../components/ui';
import {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getExpos,
} from '../../lib/api';
import { timeAgo } from '../../lib/utils';
import { useExpoRealtimeVersion } from '../../hooks/useExpoRealtimeVersion';

const blank = () => ({
  title: '',
  message: '',
  targetAudience: 'all',
  expo: '',
});

export default function AdminAnnouncements() {
  const toast = useToast();
  const confirm = useConfirm();

  const [announcements, setAnnouncements] = useState([]);
  const [expos, setExpos] = useState([]);
  const [edit, setEdit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const realtimeVersion = useExpoRealtimeVersion();

  const loadData = async () => {
    try {
      const [announcementData, expoData] = await Promise.all([
        getAllAnnouncements(),
        getExpos(),
      ]);

      setAnnouncements(announcementData.announcements || []);
      setExpos(expoData || []);
    } catch (err) {
      toast.error('Could not load announcements', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [realtimeVersion]);

  const set = (key) => (event) => {
    setEdit((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const save = async () => {
    if (!edit.title.trim() || !edit.message.trim()) {
      setError('Title and message are required.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      title: edit.title.trim(),
      message: edit.message.trim(),
      targetAudience: edit.targetAudience,
      expo: edit.expo || null,
    };

    try {
      if (edit._id) {
        await updateAnnouncement(edit._id, payload);
        toast.success('Announcement updated');
      } else {
        await createAnnouncement(payload);
        toast.success('Announcement published');
      }

      setEdit(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (announcement) => {
    const confirmed = await confirm({
      title: `Delete "${announcement.title}"?`,
      message: 'This announcement will be permanently deleted.',
      danger: true,
      confirmText: 'Delete',
    });

    if (!confirmed) return;

    try {
      await deleteAnnouncement(announcement._id);
      toast.success('Announcement deleted');
      await loadData();
    } catch (err) {
      toast.error('Could not delete announcement', err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Publish important updates for exhibitors and attendees."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => {
              setEdit(blank());
              setError('');
            }}
          >
            <Plus size={17} /> New announcement
          </button>
        }
      />

      {loading ? (
        <p className="muted">Loading announcements...</p>
      ) : announcements.length ? (
        <div className="announcement-admin-grid">
          {announcements.map((item) => (
            <article className="announcement-admin-card" key={item._id}>
              <div className="announcement-admin-top">
                <span className="announcement-published"><Send size={13} /> Published</span>
                <span className="announcement-audience"><Users size={14} /> {item.targetAudience === 'all' ? 'Everyone' : item.targetAudience === 'attendees' ? 'Attendees' : 'Exhibitors'}</span>
              </div>
              <h3>{item.title}</h3>
              <p className="announcement-admin-message">{item.message}</p>
              <div className="announcement-admin-meta">
                <span><CalendarDays size={14} /> {new Date(item.createdAt).toLocaleDateString()}</span>
                <span>{timeAgo(item.createdAt)}</span>
                <span>Expo: {item.expo?.title || 'All expos'}</span>
              </div>
              <div className="announcement-admin-actions">
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setEdit({
                      _id: item._id,
                      title: item.title,
                      message: item.message,
                      targetAudience: item.targetAudience,
                      expo: item.expo?._id || '',
                    });
                    setError('');
                  }}
                >
                  <Pencil size={15} /> Edit
                </button>

                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => remove(item)}
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          text="Create your first announcement to notify users."
        />
      )}

      <Modal
        open={!!edit}
        onClose={() => !saving && setEdit(null)}
        title={edit?._id ? 'Edit announcement' : 'New announcement'}
        subtitle="Write a clear update and choose which audience should receive it."
        footer={
          <>
            <button
              className="btn btn-ghost"
              disabled={saving}
              onClick={() => setEdit(null)}
            >
              Cancel
            </button>

            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={save}
            >
              {saving ? 'Saving...' : edit?._id ? 'Save changes' : 'Publish'}
            </button>
          </>
        }
      >
        {edit && (
          <div className="form-grid">
            {error && (
              <div className="alert alert-error full" role="alert">
                {error}
              </div>
            )}

            <Field label="Title" required className="full">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  maxLength={150}
                  value={edit.title}
                  onChange={set('title')}
                  placeholder="Announcement title"
                />
              )}
            </Field>

            <Field label="Message" required className="full">
              {(id) => (
                <textarea
                  id={id}
                  className="textarea"
                  maxLength={2000}
                  rows={5}
                  value={edit.message}
                  onChange={set('message')}
                  placeholder="Write your announcement..."
                />
              )}
            </Field>

            <Field label="Target audience">
              {(id) => (
                <select
                  id={id}
                  className="select"
                  value={edit.targetAudience}
                  onChange={set('targetAudience')}
                >
                  <option value="all">Everyone</option>
                  <option value="attendees">Attendees</option>
                  <option value="exhibitors">Exhibitors</option>
                </select>
              )}
            </Field>

            <Field label="Expo (optional)">
              {(id) => (
                <select
                  id={id}
                  className="select"
                  value={edit.expo}
                  onChange={set('expo')}
                >
                  <option value="">All expos</option>
                  {expos.map((expo) => (
                    <option key={expo._id} value={expo._id}>
                      {expo.title}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
