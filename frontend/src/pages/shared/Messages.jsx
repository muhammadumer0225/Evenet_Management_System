import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Check, IdCard, MessageSquarePlus, Send, X, Smile, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../context/UIContext';
import { Avatar, Badge, EmptyState, Modal, PageHeader, SearchBox } from '../../components/ui';
import {
  getMessageContacts,
  getMyConversations,
  getConversation,
  markThreadRead,
  sendMessage,
  deleteMessageApi,
  clearConversationMessagesApi,
  hideConversationApi,
} from '../../lib/api';
import { socket } from '../../lib/socket';

import { cx, fmtDateTime, timeAgo } from '../../lib/utils';

const nameOf = (u) => u?.company || u?.name || 'Unknown';
const ROLE = { admin: 'Organizer', exhibitor: 'Exhibitor', attendee: 'Attendee' };

export default function Messages() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [sp, setSp] = useSearchParams();
  const to = sp.get('to');

  const [threads, setThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [convo, setConvo] = useState([]);
  const [active, setActive] = useState(to || null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [conversationReloadVersion, setConversationReloadVersion] = useState(0);
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);

    useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true);
        setLoadError('');

        const [conversationData, contactData] = await Promise.all([
          getMyConversations(),
          getMessageContacts(),
        ]);

        setThreads(conversationData);
        setContacts(contactData);

        if (!active && conversationData.length > 0) {
          setActive(conversationData[0].other);
        }
      } catch (error) {
        setLoadError(error.message || 'Unable to load messages');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [reloadVersion]);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState('');
  const [mobileChat, setMobileChat] = useState(!!to);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (to) {
      setActive(to);
      setMobileChat(true);
    }
  }, [to]);

useEffect(() => {
  let current = true;
  if (!active) {
    setConvo([]);
    setConversationError('');
    setConversationLoading(false);
    return () => { current = false; };
  }

  const loadConversation = async () => {
    setConversationLoading(true);
    setConversationError('');
    try {
      const messages = await getConversation(active);
      if (!current) return;
      setConvo(messages);
      try {
        await markThreadRead(active);
        if (!current) return;
        setThreads((previous) => previous.map((thread) =>
          thread.other === active ? { ...thread, unread: 0 } : thread
        ));
      } catch (readError) {
        // Keep the conversation visible even if the read-receipt request fails.
        console.warn('Unable to mark conversation as read:', readError.message);
      }
    } catch (error) {
      if (current) setConversationError(error.message || 'Unable to load conversation');
    } finally {
      if (current) setConversationLoading(false);
    }
  };

  loadConversation();
  return () => { current = false; };
}, [active, conversationReloadVersion]);

  useEffect(() => {
    // Scroll the conversation pane only; scrollIntoView can unexpectedly move the whole page.
    const pane = scrollRef.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [convo.length, active]);

    const activeThread = threads.find((t) => t.other === active);

  const other =
    activeThread?.user ||
    contacts.find((u) => u._id === active) ||
    null;

  const list = threads.slice();

  if (active && other && !list.some((t) => t.other === active)) {
    list.unshift({ other: active, user: other, last: null, unread: 0 });
  }

  const candidates = contacts.filter((u) =>
    !q ||
    `${u.name} ${u.company || ''}`
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  // Listen for incoming real-time messages
useEffect(() => {
  const handleNewMessage = async (message) => {
    const senderId = message.from?.toString();

    if (senderId === active) {
      // Add message to currently open conversation
      setConvo((previous) => {
        if (previous.some((m) => m._id === message._id)) {
          return previous;
        }

        return [...previous, message];
      });

      // Mark incoming message as read
      try {
        await markThreadRead(senderId);

        setThreads((previous) =>
          previous.map((thread) =>
            thread.other === senderId
              ? { ...thread, unread: 0 }
              : thread
          )
        );
      } catch (error) {
        console.error("Unable to mark message as read:", error);
      }
    } else {
      // Update unread count for another conversation
      setThreads((previous) => {
        const exists = previous.some(
          (thread) => thread.other === senderId
        );

        if (exists) {
          return previous.map((thread) =>
            thread.other === senderId
              ? {
                  ...thread,
                  last: message,
                  unread: (thread.unread || 0) + 1,
                }
              : thread
          );
        }

        const sender = contacts.find(
          (contact) => contact._id === senderId
        );

        if (!sender) return previous;

        return [
          {
            other: senderId,
            user: sender,
            last: message,
            unread: 1,
          },
          ...previous,
        ];
      });
    }
  };

  socket.on("new-message", handleNewMessage);

  return () => {
    socket.off("new-message", handleNewMessage);
  };
}, [active, contacts]);

  useEffect(() => {
    const handleMessageDeleted = (event) => {
      if (event?.scope === 'everyone' || event?.scope === 'me') {
        setConvo((previous) => previous.filter((message) => String(message.id || message._id) !== String(event.messageId)));
        setReloadVersion((value) => value + 1);
      }
    };
    socket.on('message-deleted', handleMessageDeleted);
    return () => socket.off('message-deleted', handleMessageDeleted);
  }, []);

  useEffect(() => {
    const handleMessageStatus = (status) => {
      const messageId = String(status.messageId);
      setConvo((previous) => previous.map((message) =>
        String(message.id || message._id) === messageId
          ? { ...message, deliveredAt: status.deliveredAt || message.deliveredAt, read: Boolean(status.read), readAt: status.readAt || message.readAt }
          : message
      ));
    };
    socket.on('message-status', handleMessageStatus);
    return () => socket.off('message-status', handleMessageStatus);
  }, []);

  const send = async (e) => {
    e.preventDefault();

    if (!text.trim() || !active) return;

    try {
      const message = await sendMessage({
        to: active,
        text,
      });

      setConvo((previous) => [...previous, message]);
      setThreads((previous) => {
        const existing = previous.find((thread) => thread.other === active);

        if (existing) {
          return previous.map((thread) =>
            thread.other === active
              ? { ...thread, last: message }
              : thread
          );
        }

        return [
          {
            other: active,
            user: other,
            last: message,
            unread: 0,
          },
          ...previous,
        ];
      });

      setText('');
    } catch (error) {
      toast.error(error.message || 'Message could not be sent');
    }
  };

  const deleteOneMessage = async (message, scope) => {
    const title = scope === 'everyone' ? 'Delete message for everyone?' : 'Delete message for you?';
    const warning = scope === 'everyone'
      ? 'This removes the message from both participants. Only messages you sent can be deleted for everyone.'
      : 'This hides the message only from your account. The other participant will still see it.';
    if (!(await confirm({ title, message: warning, confirmText: 'Delete', danger: true }))) return;
    try {
      await deleteMessageApi(message.id || message._id, scope);
      setConvo((previous) => previous.filter((item) => String(item.id || item._id) !== String(message.id || message._id)));
      toast.success(scope === 'everyone' ? 'Message deleted for everyone' : 'Message deleted for you');
      setReloadVersion((value) => value + 1);
    } catch (error) { toast.error('Could not delete message', error.message); }
  };

  const clearAllMessages = async () => {
    if (!(await confirm({ title: 'Clear all messages?', message: 'This clears messages only from your account. The conversation stays in your chat list, and the other participant keeps their messages.', confirmText: 'Clear messages', danger: true }))) return;
    try {
      await clearConversationMessagesApi(active);
      setConvo([]);
      setConversationReloadVersion((value) => value + 1);
      setReloadVersion((value) => value + 1);
      toast.success('Your conversation messages were cleared');
    } catch (error) { toast.error('Could not clear messages', error.message); }
  };

  const deleteSelectedChat = async () => {
    if (!(await confirm({ title: 'Delete this chat from your list?', message: 'The conversation will be removed only from your chat list. The other participant’s chat remains unchanged.', confirmText: 'Delete chat', danger: true }))) return;
    try {
      await hideConversationApi(active);
      setConvo([]);
      setActive(null);
      setMobileChat(false);
      setReloadVersion((value) => value + 1);
      toast.success('Chat removed from your list');
    } catch (error) { toast.error('Could not delete chat', error.message); }
  };

  const shareContact = async () => {
    try {
      const message = await sendMessage({
        to: active,
        kind: 'contact',
        text: `Contact card from ${nameOf(user)}`,
        meta: {
          name: user.name,
          company: user.company,
          email: user.email,
          phone: user.phone,
        },
      });

      setConvo((previous) => [...previous, message]);
      toast.success('Contact shared');
    } catch (error) {
      toast.error(error.message || 'Unable to share contact');
    }
  };

  const respond = async (m, accept) => {
    try {
      const message = await sendMessage({
        to: m.from,
        text: accept
          ? `Appointment confirmed for ${m.meta?.date} at ${m.meta?.time}. See you at the booth!`
          : 'Sorry, that time does not work for us. Could you suggest another slot?',
      });

      setConvo((previous) => [...previous, message]);
      toast.success(accept ? 'Appointment accepted' : 'Appointment declined');
    } catch (error) {
      toast.error(error.message || 'Unable to send response');
    }
  };

  return (
    <>
      <PageHeader title="Messages" subtitle="Chat with organizers, exhibitors and visitors in real time." actions={<button className="btn btn-primary" onClick={() => setPicker(true)}><MessageSquarePlus size={17} /> New message</button>} />
      <div className={cx('chat card card-flush', mobileChat && 'show-chat')}>
        <aside className="chat-list">
          {loading ? (
  <p className="center muted small">Loading conversations...</p>
) : loadError ? (
  <div className="card-pad stack-sm"><p className="alert alert-error" role="alert">{loadError}</p><button type="button" className="btn btn-outline" onClick={() => setReloadVersion((value) => value + 1)}>Retry loading messages</button></div>
) : list.length ? list.map((t) => {
            const u = t.user;
            return (
              <button key={t.other} className={cx('chat-item', active === t.other && 'active')} onClick={() => { setActive(t.other); setMobileChat(true); setSp({}, { replace: true }); }}>
                <Avatar user={u} size={44} />
                <span className="grow">
                  <strong className="truncate">{nameOf(u)}</strong>
                  <small className="truncate">{t.last ? (t.last.from === user.id ? 'You: ' : '') + t.last.text : 'Start a conversation'}</small>
                </span>
                <span className="chat-meta">
                  {t.last && <em>{timeAgo(t.last.createdAt)}</em>}
                  {t.unread > 0 && <b>{t.unread}</b>}
                </span>
              </button>
            );
          }) : <EmptyState title="No conversations yet" text="Start one with the button above." />}
        </aside>

        <section className="chat-pane">
          {other ? (
            <>
              <header className="chat-head">
                <button className="icon-btn chat-back" onClick={() => setMobileChat(false)} aria-label="Back to conversations"><ArrowLeft size={20} /></button>
                <Avatar user={other} size={42} />
                <div className="grow"><strong>{nameOf(other)}</strong><p className="small muted">{ROLE[other.role]}{other.role === 'exhibitor' ? ` · ${other.category}` : ''}</p></div>
                <div className="row gap-xs">
                  <button type="button" className="btn btn-outline btn-sm" onClick={clearAllMessages} title="Clear messages"><Trash2 size={14} /> <span className="hide-sm">Clear messages</span></button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={deleteSelectedChat} title="Delete chat"><X size={14} /> <span className="hide-sm">Delete chat</span></button>
                  {user.role === 'exhibitor' && other.role === 'exhibitor' && <button className="btn btn-outline btn-sm" onClick={shareContact}><IdCard size={15} /> Share my contact</button>}
                </div>
              </header>
              <div className="chat-scroll" ref={scrollRef} role="log" aria-live="polite">
                {conversationLoading ? <p className="center muted small">Loading conversation…</p> : conversationError ? <div className="stack-sm"><p className="alert alert-error" role="alert">{conversationError}</p><button type="button" className="btn btn-outline" onClick={() => setConversationReloadVersion((value) => value + 1)}>Retry conversation</button></div> : null}
                {!conversationLoading && !conversationError && convo.length === 0 && <p className="center muted small" style={{ margin: 'auto' }}>Say hello 👋 — this is the start of your conversation with {nameOf(other)}.</p>}
                {!conversationLoading && !conversationError && convo.map((m) => {
                  const mine = m.from === user.id;
                  return (
                    <div key={m.id || m._id} className={cx('bubble-row', mine && 'mine')}>
                      <div className={cx('bubble', m.kind !== 'text' && 'bubble-card')}>
                        {m.kind === 'appointment' && (
                          <div className="bubble-appt">
                            <span className="row gap-sm"><CalendarClock size={17} /> <strong>Appointment request</strong></span>
                            <p>{m.meta?.date} · {m.meta?.time}</p>
                            {m.text.includes('—') && <p className="small">{m.text.split('—').slice(1).join('—').trim()}</p>}
                            {!mine && user.role === 'exhibitor' && (
                              <div className="row gap-sm" style={{ marginTop: 8 }}>
                                <button className="btn btn-sm btn-primary" onClick={() => respond(m, true)}><Check size={14} /> Accept</button>
                                <button className="btn btn-sm btn-outline" onClick={() => respond(m, false)}><X size={14} /> Decline</button>
                              </div>
                            )}
                          </div>
                        )}
                        {m.kind === 'contact' && (
                          <div className="bubble-appt">
                            <span className="row gap-sm"><IdCard size={17} /> <strong>{m.meta?.company || m.meta?.name}</strong></span>
                            <p className="small">{m.meta?.name}<br />{m.meta?.email}<br />{m.meta?.phone}{m.meta?.website && <><br />{m.meta.website}</>}</p>
                          </div>
                        )}
                        {(m.kind === 'text' || !m.kind) && m.text}
                        <time>{fmtDateTime(m.createdAt)}{mine && <span className="message-receipt"> · {m.read ? 'Seen' : m.deliveredAt ? 'Delivered' : 'Sent'}</span>}</time>
                        <div className="row gap-xs" style={{ marginTop: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => deleteOneMessage(m, 'me')} title="Delete for me">Delete for me</button>
                          {mine && <button type="button" className="btn btn-ghost btn-xs" onClick={() => deleteOneMessage(m, 'everyone')} title="Delete for everyone">Delete for everyone</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}

              </div>
              {emojiOpen && (
                <div className="chat-emoji-picker" role="group" aria-label="Choose an emoji">
                  {['😀', '😂', '😊', '😍', '👍', '👏', '🎉', '❤️', '🙏', '🔥', '🤝', '👋'].map((emoji) => (
                    <button key={emoji} type="button" onClick={() => setText((value) => `${value}${emoji}`)} aria-label={`Insert ${emoji}`}>{emoji}</button>
                  ))}
                </div>
              )}
              <form className="chat-input" onSubmit={send}>
                <button type="button" className="icon-btn" onClick={() => setEmojiOpen((value) => !value)} aria-label="Choose emoji" aria-expanded={emojiOpen}><Smile size={19} /></button>
                <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (text.trim()) event.currentTarget.form?.requestSubmit(); } }} placeholder={`Message ${nameOf(other)}…`} aria-label="Type a message" />
                <button className="btn btn-primary" disabled={!text.trim()}><Send size={17} /> <span className="hide-sm">Send</span></button>
              </form>
            </>
          ) : (
            <EmptyState icon={MessageSquarePlus} title="Select a conversation" text="Pick someone from the list or start a new message." action={<button className="btn btn-primary" onClick={() => setPicker(true)}>New message</button>} />
          )}
        </section>
      </div>

      <Modal open={picker} onClose={() => setPicker(false)} title="New message" subtitle="Choose who you'd like to talk to." size="sm">
        <div className="stack">
          <SearchBox value={q} onChange={setQ} placeholder="Search people & companies…" />
          <ul className="picker-list">
{candidates.map((u) => (
  <li key={u._id || u.id}>
    <button onClick={() => {
      setActive(u._id || u.id);
      setMobileChat(true);
      setPicker(false);
      setQ('');
    }}>
                  <Avatar user={u} size={38} />
                  <span className="grow"><strong>{nameOf(u)}</strong><small>{u.role === 'exhibitor' ? u.name : ''}</small></span>
                  <Badge tone={u.role === 'admin' ? 'accent' : u.role === 'exhibitor' ? 'teal' : 'blue'}>{ROLE[u.role]}</Badge>
                </button>
              </li>
            ))}
            {!candidates.length && <li className="dropdown-empty">No one found.</li>}
          </ul>
        </div>
      </Modal>
    </>
  );
}
