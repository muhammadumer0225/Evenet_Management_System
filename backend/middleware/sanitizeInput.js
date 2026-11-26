const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const sanitizeValue = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".") || BLOCKED_KEYS.has(key)) continue;
    clean[key] = sanitizeValue(child);
  }
  return clean;
};

const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === "object") req.body = sanitizeValue(req.body);
  if (req.params && typeof req.params === "object") req.params = sanitizeValue(req.params);
  return next();
};

module.exports = { sanitizeInput, sanitizeValue };
