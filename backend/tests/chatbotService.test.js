const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSystemPrompt, getChatbotStatus } = require("../services/chatbotService");

test("chatbot prompt follows the user's language and keeps answers practical and concise", () => {
  const prompt = buildSystemPrompt("guest");
  assert.match(prompt, /Roman Urdu/);
  assert.match(prompt, /Answer the exact question in the first sentence/);
  assert.match(prompt, /one short, specific follow-up question/);
  assert.match(prompt, /Never guess/);
});

test("chatbot role prompts expose only the relevant EventSphere guidance", () => {
  const attendeePrompt = buildSystemPrompt("attendee");
  const adminPrompt = buildSystemPrompt("admin");
  assert.match(attendeePrompt, /Verify their own registration/);
  assert.doesNotMatch(attendeePrompt, /Dashboard > Floor plan & booths/);
  assert.match(adminPrompt, /Expo timezone/);
  assert.match(adminPrompt, /CSV and PDF/);
});

test("attendee Expo registration questions receive a clear built-in answer", async () => {
  const { generateReply } = require("../services/chatbotService");
  const previous = { AI_PROVIDER: process.env.AI_PROVIDER, AI_API_KEY: process.env.AI_API_KEY, AI_MODEL: process.env.AI_MODEL };
  try {
    delete process.env.AI_PROVIDER;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    const reply = await generateReply({ role: "attendee", message: "How can an attendee register for an expo and get a ticket?", history: [] });
    assert.match(reply, /Browse expos/);
    assert.match(reply, /Dashboard > Expos & tickets/);
    assert.match(reply, /simulated demo payment/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("attendee registration verification questions receive an accurate built-in answer without an AI provider", async () => {
  const { generateReply } = require("../services/chatbotService");
  const keys = ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    keys.forEach((key) => delete process.env[key]);
    const reply = await generateReply({
      role: "attendee",
      message: "How can I verify my registration ID?",
      history: [],
    });
    assert.match(reply, /Dashboard > Expos & tickets/);
    assert.match(reply, /Verify your registration/);
    assert.match(reply, /Registration ID or ES ticket code/);
    assert.match(reply, /own account/);
    assert.match(reply, /payment is pending/);
  } finally {
    keys.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
});

test("chatbot status exposes only configured/unconfigured state", () => {
  const keys = ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    keys.forEach((key) => delete process.env[key]);
    assert.deepEqual(getChatbotStatus(), { status: "unconfigured" });
    process.env.AI_PROVIDER = "gemini";
    process.env.AI_API_KEY = "test-key-not-used-for-network";
    process.env.AI_MODEL = "test-model";
    assert.deepEqual(getChatbotStatus(), { status: "ready" });
    process.env.AI_PROVIDER = "unsupported-provider";
    assert.deepEqual(getChatbotStatus(), { status: "unconfigured" });
  } finally {
    keys.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
});

test("chatbot status endpoint has its own limiter and keeps chatbot authentication", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const routes = fs.readFileSync(path.join(__dirname, "../routes/chatbotRoutes.js"), "utf8");
  assert.match(routes, /const statusLimiter = rateLimit/);
  assert.match(routes, /router\.get\("\/status", statusLimiter, chatbotAuth, getChatStatus\)/);
  assert.match(routes, /router\.post\("\/", chatbotLimiter, chatbotAuth, sendChat\)/);
});


test('common EventSphere and Admin questions receive deterministic answers without an AI provider', async () => {
  const { generateReply } = require('../services/chatbotService');
  const keys = ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    keys.forEach((key) => delete process.env[key]);
    const intro = await generateReply({ role: 'attendee', message: 'Can you explain what EventSphere is and what I can do as an attendee?', history: [] });
    assert.match(intro, /Expo and trade-show management platform/);
    const dashboard = await generateReply({ role: 'admin', message: 'What can I do from my Admin Dashboard in EventSphere?', history: [] });
    assert.match(dashboard, /Dashboard > Expos/);
    const expo = await generateReply({ role: 'admin', message: 'How can I create a new Expo and manage its details as an Admin?', history: [] });
    assert.match(expo, /New Expo/);
    const users = await generateReply({ role: 'admin', message: 'How can I manage users and their roles as an Admin in EventSphere?', history: [] });
    assert.match(users, /Dashboard > Users/);
  } finally {
    keys.forEach((key) => { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; });
  }
});
