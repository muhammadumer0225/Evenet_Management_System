import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, ImagePlus, Lock, RotateCcw, ShieldCheck, Trash2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../context/UIContext';
import { Avatar, Badge, Field, PageHeader, Switch, Tabs } from '../../components/ui';
import { changePassword, deleteAccount, exportMyData, updateProfile, uploadProfileImage } from '../../lib/api';
import { resetDemoData } from '../../lib/store';
import { CATEGORIES } from '../../lib/seed';
import { cx, downloadFile, passwordStrength } from '../../lib/utils';

export default function Account() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'profile';
  return (
    <>
      <PageHeader title="Account settings" subtitle="Manage your profile, password and privacy." />
      <div className="card card-flush">
        <div style={{ padding: '0 14px' }}>
          <Tabs value={tab} onChange={(k) => setSp({ tab: k })} tabs={[{ key: 'profile', label: 'Profile', icon: User }, { key: 'security', label: 'Security', icon: Lock }, { key: 'privacy', label: 'Privacy & data', icon: ShieldCheck }]} />
        </div>
        <div className="card-body">
          {tab === 'profile' && <ProfileTab user={user} />}
          {tab === 'security' && <SecurityTab user={user} />}
          {tab === 'privacy' && <PrivacyTab user={user} />}
        </div>
      </div>
    </>
  );
}

function ProfileTab({ user }) {
  const toast = useToast();
  const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone || '', bio: user.bio || '', interests: user.interests || [] });
  const fileRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
const save = async (e) => {
  e.preventDefault();
  if (!f.name.trim()) return toast.error('Name is required');

  try {
    await updateProfile(user.id, f);
    toast.success('Profile updated');
  } catch (err) {
    toast.error('Could not save', err.message);
  }
};
  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Choose a JPG, PNG or WebP image'); event.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be 5 MB or smaller'); event.target.value = ''; return; }
    setUploadingImage(true);
    try { await uploadProfileImage(file); toast.success('Profile picture updated'); }
    catch (error) { toast.error('Could not upload picture', error.message); }
    finally { setUploadingImage(false); event.target.value = ''; }
  };
  return (
    <form className="stack" onSubmit={save} style={{ maxWidth: 720 }}>
      <div className="row gap-lg"><Avatar user={user} size={80} /><div className="stack-sm"><h3>{user.name}</h3><Badge tone="accent">{{ admin: 'Organizer', exhibitor: 'Exhibitor', attendee: 'Attendee' }[user.role]}</Badge><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadImage} /><button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={uploadingImage}><ImagePlus size={16} /> {uploadingImage ? 'Uploading…' : user.profileImage ? 'Change picture' : 'Upload picture'}</button><span className="muted xs">JPG, PNG or WebP · Maximum 5 MB</span></div></div>
      <div className="form-grid">
        <Field label="Full name" required>{(i) => <input id={i} className="input" value={f.name} onChange={set('name')} />}</Field>
        <Field label="Email" required>{(i) => <input id={i} className="input" type="email" value={f.email} onChange={set('email')} />}</Field>
        <Field label="Phone">{(i) => <input id={i} className="input" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label="Bio" className="full">{(i) => <textarea id={i} className="textarea" value={f.bio} onChange={set('bio')} placeholder="A short introduction…" />}</Field>
        {user.role === 'attendee' && (
          <div className="field full">
            <span className="label">Interests</span>
            <div className="chip-row">
              {CATEGORIES.map((c) => (
                <button type="button" key={c} className={cx('chip', f.interests.includes(c) && 'active')} onClick={() => setF({ ...f, interests: f.interests.includes(c) ? f.interests.filter((x) => x !== c) : [...f.interests, c] })}>{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div><button className="btn btn-primary">Save changes</button></div>
    </form>
  );
}

function SecurityTab({ user }) {
  const toast = useToast();
  const { logout } = useAuth();
const nav = useNavigate();
  const [f, setF] = useState({ cur: '', next: '', again: '' });
  const { score, label } = passwordStrength(f.next);
const submit = async (e) => {
  e.preventDefault();
  if (f.next !== f.again) return toast.error('Passwords do not match');

  try {
await changePassword(user.id, f.cur, f.next);
toast.success('Password updated. Please log in again.');
await logout();
nav('/login');
  } catch (err) {
    toast.error('Could not change password', err.message);
  }
};
  return (
    <form className="stack" onSubmit={submit} style={{ maxWidth: 440 }}>
      <Field label="Current password" required>{(i) => <input id={i} className="input" type="password" autoComplete="current-password" value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })} />}</Field>
      <Field label="New password" required>{(i) => (<><input id={i} className="input" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        <div className="strength">{[1, 2, 3, 4].map((n) => <i key={n} className={score >= n ? `on-${score}` : ''} />)}<span>{label}</span></div></>)}</Field>
      <Field label="Confirm new password" required>{(i) => <input id={i} className="input" type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />}</Field>
      <div className="alert alert-info"><ShieldCheck size={18} /> Passwords are stored as salted hashes — never in plain text.</div>
      <div><button className="btn btn-primary" disabled={!f.cur || !f.next}>Update password</button></div>
    </form>
  );
}

function PrivacyTab({ user }) {
  const toast = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();
  const c = user.consent || {};
const setC = async (k, v) => {
  try {
    await updateProfile(user.id, { consent: { ...c, [k]: v } });
    toast.success('Preference saved');
  } catch (err) {
    toast.error('Could not save preference', err.message);
  }
};

const handleExport = async () => {
  try {
    const data = await exportMyData(user.id);
    downloadFile(
      'my-eventsphere-data.json',
      JSON.stringify(data, null, 2),
      'application/json'
    );
    toast.success('Your data has been exported');
  } catch (err) {
    toast.error('Could not export data', err.message);
  }
};


const handleDeleteAccount = async () => {
  try {
    if (await confirm({
      title: 'Delete your account?',
      message: 'This is permanent and cannot be undone.',
      confirmText: 'Delete my account',
      danger: true,
    })) {
      await deleteAccount(user.id);
      toast.info('Account deleted');
      nav('/');
    }
  } catch (err) {
    toast.error('Could not delete account', err.message);
  }
};


  return (
    <div className="stack-lg" style={{ maxWidth: 720 }}>
      <div>
        <h3>Consent</h3>
        <p className="muted small">You're in control of how your information is used.</p>
        <div className="mt">
          {user.role === 'exhibitor' && <Switch checked={c.directory !== false} onChange={(v) => setC('directory', v)} label="Show my company in the public directory" description="Attendees can find your profile and booth." />}
          <Switch checked={c.analytics !== false} onChange={(v) => setC('analytics', v)} label="Anonymous usage analytics" description="Helps organizers improve events. Never sold or shared." />
          <Switch checked={!!c.marketing} onChange={(v) => setC('marketing', v)} label="Event news & offers by email" description="Occasional emails about upcoming expos." />
        </div>
      </div>
      <div className="card card-pad stack-sm">
        <h3>Download your data</h3>
        <p className="muted small">Get a JSON export of your profile, registrations, messages and more.</p>
        <div><button className="btn btn-outline" onClick={handleExport}><Download size={16} /> Download my data</button></div>
      </div>
      <div className="card card-pad stack-sm">
        <h3>Demo tools</h3>
        <p className="muted small">This frontend stores everything in your browser. Reset to restore the original sample data for all demo accounts.</p>
        <div><button className="btn btn-outline" onClick={async () => { if (await confirm({ title: 'Reset demo data?', message: 'All changes made in this browser will be lost and you will be signed out.', confirmText: 'Reset', danger: true })) { localStorage.removeItem('eventsphere.session'); resetDemoData(); window.location.href = '/'; } }}><RotateCcw size={16} /> Reset demo data</button></div>
      </div>
      <div className="card card-pad stack-sm danger-zone">
        <h3>Delete account</h3>
        <p className="muted small">Permanently removes your profile, registrations, applications and messages.</p>
        <div><button className="btn btn-danger" onClick={handleDeleteAccount}><Trash2 size={16} /> Delete my account</button></div>
      </div>
    </div>
  );
}
