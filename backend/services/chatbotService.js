const { BASE_RULES, ROLE_GUIDES } = require("./chatbotKnowledge");

let lastProviderHealth = null;
let lastProviderHealthAt = 0;

class ChatbotError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ChatbotError";
    this.status = status;
  }
}

const buildSystemPrompt = (role) => {
  const guide = ROLE_GUIDES[role] || ROLE_GUIDES.guest;
  return `${BASE_RULES}\n\n${guide}`;
};

const readConfig = () => {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const timeoutMs = Math.min(30000, Math.max(3000, Number(process.env.AI_TIMEOUT_MS) || 15000));
  const maxTokens = Math.min(2048, Math.max(256, Number(process.env.AI_MAX_TOKENS) || 1500));
  const configured = Boolean(
    apiKey && model &&
    !apiKey.startsWith("replace_with") &&
    !model.startsWith("replace_with") &&
    Object.hasOwn(PROVIDERS, provider)
  );
  return { provider, apiKey, model, timeoutMs, maxTokens, configured };
};

const getConfig = () => {
  const config = readConfig();
  if (!config.configured) throw new ChatbotError(503, "The chatbot is not configured yet.");
  return config;
};

// Reports configuration plus the last real provider result, without exposing credentials.
const getChatbotStatus = () => {
  if (!readConfig().configured) return { status: "unconfigured" };
  if (!lastProviderHealthAt || Date.now() - lastProviderHealthAt > 120000) return { status: "ready" };
  return { status: lastProviderHealth ? "available" : "unavailable" };
};

// Only role + conversation text are sent to the provider. No name, email, phone or company.
const callGemini = async ({ apiKey, model, timeoutMs, maxTokens }, systemPrompt, messages) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.35, topP: 0.9 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw await providerError(response);
  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p) => p.text || "").join("").trim() : "";
};

const callOpenRouter = async ({ apiKey, model, timeoutMs, maxTokens }, systemPrompt, messages) => {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.35,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw await providerError(response);
  const data = await response.json();
  const choice = data?.choices?.[0];
  const rawContent = choice?.message?.content;
  const content = typeof rawContent === "string"
    ? rawContent.trim()
    : Array.isArray(rawContent)
      ? rawContent.map((part) => typeof part?.text === "string" ? part.text : "").join("\n").trim()
      : "";
  if (!content) {
    // Log only why it was empty (never the request or the key).
    console.error("Empty AI answer. finish_reason:", choice?.finish_reason, "| has reasoning field:", Boolean(choice?.message?.reasoning));
  }
  return content;
};

const providerError = async (response) => {
  // Never log the request (it contains the key); log only the status.
  console.error("AI provider error: HTTP", response.status);
  if (response.status === 429) {
    return new ChatbotError(429, "The assistant is busy right now. Please try again in a moment.");
  }
  if (response.status === 401 || response.status === 403) {
    return new ChatbotError(502, "The assistant is temporarily unavailable.");
  }
  return new ChatbotError(502, "The assistant could not answer right now. Please try again.");
};

const PROVIDERS = { gemini: callGemini, openrouter: callOpenRouter };

const getKnownAnswer = (role, message) => {
  const text = String(message || "").toLowerCase();

  if (/\b(what is eventsphere|explain (?:what )?eventsphere|about eventsphere|what (?:can i do|i can do) as an attendee)\b/.test(text)) {
    return "EventSphere is an Expo and trade-show management platform. Attendees can browse Expos, register for tickets, manage digital passes, explore exhibitors and sessions, read announcements, message permitted contacts and submit feedback. Exhibitors can apply for Expos, track approvals, reserve booths after approval and manage their booth showcase. Organizers manage Expos, applications, booths, check-in, schedules, users, announcements and reports. The options available depend on your account role.";
  }

  if (role === "admin" && /\b(what can i do|what can i manage|admin dashboard|organizer dashboard)\b/.test(text)) {
    return "Your Admin Dashboard lets you manage the EventSphere event workflow. Use **Dashboard > Expos** to create and publish Expos; **Applications** to review exhibitor applications; **Floor plan & booths** to manage zones and reservations; **Attendee check-in** and **Booth visitor check-in** to record visits; **Schedule** to manage sessions; **Analytics & reports** to review results; **Users** to manage accounts and roles; and **Feedback inbox**, **Announcements** and **Messages** for communication and support. Start with the section that matches the task you need to complete.";
  }

  if (role === "admin" && /\b(create|new|add|manage|edit|update)\b/.test(text) && /\b(expo|expos|event)\b/.test(text)) {
    return "To create an Expo, open **Dashboard > Expos** and choose **New Expo**. Enter the title, description, category/theme, start and end dates, daily opening and closing times, timezone, venue and city, registration deadline, capacity and base ticket price in PKR. Add an optional JPG, PNG or WebP cover image (up to 5 MB), then save as Draft or publish when ready. Check the dates and registration deadline before publishing; the deadline must be on or before the Expo start date.";
  }

  if (role === "admin" && /\b(user|users|account|accounts|role|roles)\b/.test(text) && /\b(manage|change|update|assign|control|how|can)\b/.test(text)) {
    return "Open **Dashboard > Users** to review registered accounts. You can change an eligible user's role between Attendee, Exhibitor and Admin, or update their account status to Active or Suspended. Select the correct account and verify its current role before saving. You cannot change your own role or suspend your own account, and the system prevents removing the final active Admin account.";
  }
  const asksToVerifyRegistration =
    /\b(verify|check|confirm|validate|tasdeeq)\b/.test(text) &&
    /\b(registration|ticket|pass|id|code|number)\b/.test(text);

  if (asksToVerifyRegistration && role === "attendee") {
    return `You can verify your own Expo registration from your attendee dashboard.\n1. Open **Dashboard > Expos & tickets**.\n2. Find the **Verify your registration** section.\n3. Enter your Registration ID or ES ticket code, then select **Verify registration**.\n4. Review the Expo, ticket, registration, payment and check-in details shown in the result.\nIf the pass is not active because payment is pending, complete the payment from your pass and verify again. If the ID is not found or the status looks wrong, contact the event organizer. For privacy, you can verify only registrations linked to your own account.`;
  }

  if (asksToVerifyRegistration && role === "guest") {
    return "To verify a registration, first create an attendee account or log in to the account that owns the pass. Then open **Dashboard > Expos & tickets**, enter your Registration ID or ES ticket code under **Verify your registration**, and select **Verify registration**. You can verify only a registration linked to your own account.";
  }

  const asksAboutExpoRegistration =
    /\b(register|registration|sign ?up|ticket|pass)\b/.test(text) &&
    /\b(expo|event)\b/.test(text) &&
    /\b(how|where|can|do|create|get|obtain)\b/.test(text);

  if ((role === "attendee" || role === "guest") && asksAboutExpoRegistration) {
    const signInStep = role === "guest"
      ? "First create an attendee account or log in. Then follow these steps:"
      : "Follow these steps:";
    return `You can register for an Expo and get your digital ticket from EventSphere.\n${signInStep}\n1. Open **Browse expos** and select a published Expo.\n2. On the Expo details page, choose **Register**.\n3. Select **Standard**, **Premium** or **VIP**, then confirm your choice.\n4. Standard registration is free. Premium and VIP use the project's simulated demo payment; no real card is charged. Complete the on-screen confirmation.\n5. Open **Dashboard > Expos & tickets** to view your digital pass. It shows your Registration ID and, when available, your ticket code and QR.\nIf the Register option is missing, check that you are logged in as an attendee and that registration is open for that Expo.`;
  }
  return null;
};

// history: array of { role: "user" | "assistant", content }, oldest first.
const generateReply = async ({ role, message, history }) => {
  const knownAnswer = getKnownAnswer(role, message);
  if (knownAnswer) return knownAnswer;

  const config = getConfig();
  const call = PROVIDERS[config.provider];
  if (!call) throw new ChatbotError(503, "The chatbot is not configured yet.");

  const messages = [...history, { role: "user", content: message }];

  try {
    const reply = await call(config, buildSystemPrompt(role), messages);
    if (!reply) throw new ChatbotError(502, "The assistant could not form a clear answer. Please rephrase your question and try again.");
    lastProviderHealth = true;
    lastProviderHealthAt = Date.now();
    return reply;
  } catch (error) {
    lastProviderHealth = false;
    lastProviderHealthAt = Date.now();
    if (error instanceof ChatbotError) throw error;
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new ChatbotError(504, "The assistant took too long to respond. Please try again.");
    }
    console.error("AI request failed:", error.message);
    throw new ChatbotError(502, "The assistant is temporarily unavailable.");
  }
};

module.exports = { generateReply, buildSystemPrompt, getChatbotStatus, ChatbotError };