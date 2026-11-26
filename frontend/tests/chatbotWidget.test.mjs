import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const widget = fs.readFileSync(path.join(here, '../src/components/ChatbotWidget.jsx'), 'utf8');
const styles = fs.readFileSync(path.join(here, '../src/components/chatbot.css'), 'utf8');

test('chatbot history persists per account and is bounded', () => {
  assert.match(widget, /eventsphere-chat:/);
  assert.match(widget, /MAX_STORED_MESSAGES = 30/);
  assert.match(widget, /localStorage\.setItem/);
  assert.match(widget, /readStoredMessages/);
});

test('chatbot retry reuses prior history without duplicating the failed message', () => {
  assert.match(widget, /retryHistory = messages\.slice\(0, lastUserIndex\)/);
  assert.match(widget, /handleSend\(lastUserMessage\.content, retryHistory, lastUserMessage\.id\)/);
});

test('assistant rich links allow only HTTP and HTTPS and use safe target attributes', () => {
  assert.match(widget, /url\.protocol === 'https:' \|\| url\.protocol === 'http:'/);
  assert.match(widget, /rel="noopener noreferrer"/);
  assert.doesNotMatch(widget, /dangerouslySetInnerHTML/);
});

test('chatbot reports real last-known status and supports keyboard/screen-reader interaction', () => {
  assert.doesNotMatch(widget, /Online ·/);
  assert.match(widget, /getChatbotStatus/);
  assert.match(widget, /event\.key === 'Escape'/);
  assert.match(widget, /role="log" aria-live="polite"/);
  assert.match(widget, /aria-modal/);
});

test('chatbot CSS includes tablet, mobile dynamic viewport and visible focus rules', () => {
  assert.match(styles, /min-width: 481px.*max-width: 900px/s);
  assert.match(styles, /max-width: 480px/);
  assert.match(styles, /100dvh/);
  assert.match(styles, /focus-visible/);
});

test('chatbot keeps the composer editable during outages and restores failed text for retry', () => {
  assert.match(widget, /setInput\(message\)/);
  assert.match(widget, /disabled=\{loading\}\s+aria-label="Your message"/);
  assert.match(widget, /refreshChatStatus/);
  assert.match(widget, /Check again/);
  assert.doesNotMatch(widget, /disabled=\{loading \|\| serviceUnavailable\}/);
});
