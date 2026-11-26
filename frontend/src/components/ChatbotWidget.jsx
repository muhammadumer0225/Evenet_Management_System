import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot, X, Minus, Send, Sparkles, RotateCcw,
  Trash2, MessageCircle, LoaderCircle, AlertCircle,
} from 'lucide-react';
import { getChatbotStatus, sendChatbotMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './chatbot.css';

const MAX_CHARS = 1000;
const MAX_HISTORY = 10;
const MAX_STORED_MESSAGES = 30;

const createMessageId = () => globalThis.crypto?.randomUUID?.()
  || `message-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const readStoredMessages = (key) => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
      .slice(-MAX_STORED_MESSAGES)
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : createMessageId(),
        role: item.role,
        content: item.content.slice(0, 12000),
      }));
  } catch {
    return [];
  }
};

const saveStoredMessages = (key, messages) => {
  try {
    localStorage.setItem(key, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch {
    // Storage may be unavailable or full; the live conversation still works.
  }
};

const getSuggestions = (role) => {
  const suggestions = {
    guest: [
      'What is EventSphere?',
      'How can I register for an expo?',
      'How do I become an exhibitor?',
    ],
    attendee: [
      'How do I register for an expo?',
      'How can I verify my registration ID?',
      'How do I register for or bookmark a session?',
    ],
    exhibitor: [
      'How can I apply for an expo?',
      'How does booth allocation work?',
      'How can I contact organizers?',
    ],
    admin: [
      'How do I create an expo?',
      'How do I check in an attendee?',
      'How can I manage zones and reports?',
    ],
  };
  return suggestions[role] || suggestions.guest;
};

const isSafeUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const renderInline = (text, keyPrefix) => {
  const pattern = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<]+|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  return String(text).split(pattern).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (markdownLink && isSafeUrl(markdownLink[2])) {
      return <a key={key} href={markdownLink[2]} target="_blank" rel="noopener noreferrer">{markdownLink[1]}</a>;
    }
    if (/^https?:\/\//i.test(part)) {
      const punctuation = part.match(/[.,!?;:]+$/)?.[0] || '';
      const url = punctuation ? part.slice(0, -punctuation.length) : part;
      if (isSafeUrl(url)) return <span key={key}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a>{punctuation}</span>;
    }
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
};

const renderMessageContent = (content, messageId) => String(content || '').split(/\r?\n/).map((line, index) => {
  const key = `${messageId}-line-${index}`;
  const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
  const bullet = line.match(/^\s*[-*]\s+(.+)$/);
  const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
  if (heading) return <h4 key={key}>{renderInline(heading[2], key)}</h4>;
  if (bullet) return <div className="chatbot-rich-list-item" key={key}><span aria-hidden="true">•</span><span>{renderInline(bullet[1], key)}</span></div>;
  if (numbered) return <div className="chatbot-rich-list-item" key={key}><span aria-hidden="true">{line.match(/^\s*(\d+)/)[1]}.</span><span>{renderInline(numbered[1], key)}</span></div>;
  if (!line.trim()) return <div className="chatbot-rich-spacer" key={key} aria-hidden="true" />;
  return <p key={key}>{renderInline(line, key)}</p>;
});

export default function ChatbotWidget() {
  const { user } = useAuth();
  const role = user?.role || 'guest';
  const storageKey = `eventsphere-chat:${user?.id || user?._id || 'guest'}:${role}`;

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState(() => readStoredMessages(storageKey));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serviceStatus, setServiceStatus] = useState('checking');
  const [statusChecking, setStatusChecking] = useState(false);

  const panelRef = useRef(null);
  const launcherRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const suggestions = getSuggestions(role);

  const updateMessages = (updater) => {
    setMessages((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      saveStoredMessages(storageKey, next);
      return next;
    });
  };

  useEffect(() => {
    setMessages(readStoredMessages(storageKey));
    setInput('');
    setError('');
  }, [storageKey]);

  const refreshChatStatus = useCallback(async () => {
    setStatusChecking(true);
    try {
      const status = await getChatbotStatus();
      setServiceStatus(status.status);
      return status.status;
    } catch {
      setServiceStatus('unknown');
      return 'unknown';
    } finally {
      setStatusChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshChatStatus();
    const interval = window.setInterval(() => { void refreshChatStatus(); }, 60000);
    return () => window.clearInterval(interval);
  }, [refreshChatStatus]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, error]);

  useEffect(() => {
    if (isOpen && !isMinimized) inputRef.current?.focus();
  }, [isOpen, isMinimized]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    launcherRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleDialogKeys = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeChat();
        return;
      }
      if (event.key !== 'Tab' || isMinimized) return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hasAttribute('hidden'));
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeys);
    return () => document.removeEventListener('keydown', handleDialogKeys);
  }, [isOpen, isMinimized, closeChat]);

  const handleSend = async (text = input, historyOverride = null, retryMessageId = null) => {
    const message = text.trim();
    if (!message || loading || message.length > MAX_CHARS) return;
    const previousMessages = (historyOverride || messages).filter(
      (item) => item.role === 'user' || item.role === 'assistant'
    );
    const history = previousMessages.slice(-MAX_HISTORY).map(({ role: messageRole, content }) => ({
      role: messageRole,
      content,
    }));
    const userMessage = { id: createMessageId(), role: 'user', content: message };

    updateMessages((previous) => [
      ...previous.filter((item) => item.id !== retryMessageId),
      userMessage,
    ].slice(-MAX_STORED_MESSAGES));
    setInput('');
    setError('');
    setLoading(true);

    try {
      const result = await sendChatbotMessage(message, history);
      updateMessages((previous) => [
        ...previous,
        { id: createMessageId(), role: 'assistant', content: result.reply },
      ].slice(-MAX_STORED_MESSAGES));
    } catch (err) {
      setInput(message);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    if (loading) return;
    updateMessages([]);
    setError('');
    setInput('');
  };

  const retryLastMessage = () => {
    const lastUserIndex = messages.map((item) => item.role).lastIndexOf('user');
    if (lastUserIndex < 0 || loading) return;
    const lastUserMessage = messages[lastUserIndex];
    const retryHistory = messages.slice(0, lastUserIndex)
      .filter((item) => item.role === 'user' || item.role === 'assistant');
    void handleSend(lastUserMessage.content, retryHistory, lastUserMessage.id);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const statusLabel = serviceStatus === 'available'
    ? 'Available'
    : serviceStatus === 'unavailable'
      ? 'Temporarily unavailable'
      : serviceStatus === 'unconfigured'
        ? 'Not configured'
        : serviceStatus === 'ready'
          ? 'Ready · not yet checked'
          : statusChecking ? 'Checking availability' : 'Status unknown';
  const serviceUnavailable = serviceStatus === 'unavailable' || serviceStatus === 'unconfigured';
  const servicePending = ['ready', 'checking', 'unknown'].includes(serviceStatus);

  return (
    <div className="chatbot-widget">
      {isOpen && (
        <section
          ref={panelRef}
          className={`chatbot-panel ${isMinimized ? 'chatbot-minimized' : ''}`}
          role="dialog"
          aria-modal={!isMinimized}
          aria-labelledby="chatbot-title"
          aria-describedby="chatbot-status"
          tabIndex={-1}
        >
          <header className="chatbot-header">
            <div className="chatbot-brand">
              <div className="chatbot-avatar">
                <Bot size={23} />
                <span className={`chatbot-online ${serviceUnavailable ? 'is-offline' : ''} ${servicePending ? 'is-pending' : ''}`} />
              </div>
              <div>
                <strong id="chatbot-title">EventSphere AI</strong>
                <small id="chatbot-status" aria-live="polite">
                  <span className={`chatbot-status-dot ${serviceUnavailable ? 'is-offline' : ''} ${servicePending ? 'is-pending' : ''}`} />
                  {statusLabel} · {role === 'guest' ? 'Guest' : role}
                </small>
              </div>
            </div>

            <div className="chatbot-header-actions">
              <button type="button" className="chatbot-icon-btn" onClick={clearChat} disabled={loading || messages.length === 0} aria-label="New conversation" title="New conversation">
                <Trash2 size={17} />
              </button>
              <button type="button" className="chatbot-icon-btn" onClick={() => { setIsMinimized((previous) => !previous); launcherRef.current?.focus(); }} aria-label={isMinimized ? 'Restore chatbot' : 'Minimize chatbot'} title={isMinimized ? 'Restore' : 'Minimize'}>
                <Minus size={19} />
              </button>
              <button type="button" className="chatbot-icon-btn" onClick={closeChat} aria-label="Close chatbot" title="Close">
                <X size={19} />
              </button>
            </div>
          </header>

          {!isMinimized && (
            <>
              <div className="chatbot-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversation">
                {serviceUnavailable && (
                  <div className="chatbot-status-note" role="status">
                    The assistant service is currently unavailable. You can still type your question; failed messages stay in the input so you can retry.
                    {' '}<button type="button" className="chatbot-status-retry" onClick={() => void refreshChatStatus()} disabled={statusChecking}>{statusChecking ? 'Checking…' : 'Check again'}</button>
                  </div>
                )}

                {messages.length === 0 && (
                  <div className="chatbot-welcome">
                    <div className="chatbot-welcome-icon"><Sparkles size={27} /></div>
                    <span className="chatbot-eyebrow">YOUR EVENTSPHERE ASSISTANT</span>
                    <h3>How can I help?</h3>
                    <p>Ask a question about using EventSphere, or choose a suggested question below.</p>
                    <div className="chatbot-suggestions">
                      <span>Suggested questions</span>
                      {suggestions.map((suggestion) => (
                        <button type="button" key={suggestion} onClick={() => void handleSend(suggestion)} disabled={loading}>
                          {suggestion}<span aria-hidden="true">↗</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div key={message.id} className={`chatbot-message chatbot-${message.role}`}>
                    {message.role === 'assistant' && <div className="chatbot-message-avatar" aria-hidden="true"><Bot size={15} /></div>}
                    <div className={`chatbot-bubble ${message.role === 'assistant' ? 'chatbot-rich' : ''}`}>
                      {message.role === 'assistant' ? renderMessageContent(message.content, message.id) : message.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="chatbot-message chatbot-assistant">
                    <div className="chatbot-message-avatar" aria-hidden="true"><Bot size={15} /></div>
                    <div className="chatbot-typing" role="status" aria-label="Assistant is typing"><i /><i /><i /></div>
                  </div>
                )}

                {error && (
                  <div className="chatbot-error" role="alert">
                    <AlertCircle size={17} />
                    <span>{error}</span>
                    <button type="button" onClick={retryLastMessage} disabled={loading}>
                      <RotateCcw size={14} />Retry
                    </button>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {messages.length > 0 && (
                <div className="chatbot-quick-actions" aria-label="Suggested follow-up questions">
                  {suggestions.slice(0, 2).map((suggestion) => (
                    <button type="button" key={suggestion} onClick={() => void handleSend(suggestion)} disabled={loading}>{suggestion}</button>
                  ))}
                </div>
              )}

              <form className="chatbot-composer" onSubmit={(event) => { event.preventDefault(); void handleSend(); }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={serviceUnavailable ? 'Assistant temporarily unavailable' : 'Ask me about EventSphere…'}
                  maxLength={MAX_CHARS}
                  rows={1}
                  disabled={loading}
                  aria-label="Your message"
                  aria-describedby="chatbot-char-count"
                />
                <div className="chatbot-composer-bottom">
                  <span id="chatbot-char-count">{input.length}/{MAX_CHARS}</span>
                  <button type="submit" disabled={!input.trim() || loading} aria-label="Send message">
                    {loading ? <LoaderCircle size={18} className="chatbot-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </form>

              <footer className="chatbot-footer">
                <Sparkles size={12} />
                AI can make mistakes. Verify important information.
              </footer>
            </>
          )}
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        className={`chatbot-launcher ${isOpen ? 'chatbot-launcher-active' : ''}`}
        onClick={() => {
          if (isOpen && !isMinimized) closeChat();
          else { setIsOpen(true); setIsMinimized(false); }
        }}
        aria-label={isOpen && !isMinimized ? 'Close AI assistant' : 'Open AI assistant'}
        aria-haspopup="dialog"
        aria-expanded={isOpen && !isMinimized}
      >
        {isOpen && !isMinimized ? <X size={25} /> : <MessageCircle size={25} />}
        {!(isOpen && !isMinimized) && <span className="chatbot-launcher-pulse" />}
      </button>
    </div>
  );
}
