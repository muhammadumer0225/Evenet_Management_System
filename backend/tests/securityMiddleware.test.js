const test = require("node:test");
const assert = require("node:assert/strict");
const { securityHeaders } = require("../middleware/securityMiddleware");

test("security middleware sets baseline browser security headers", () => {
  const headers = {};
  let continued = false;
  const res = {
    setHeader: (key, value) => { headers[key] = value; },
    removeHeader: (key) => { headers[key] = null; },
  };
  securityHeaders({}, res, () => { continued = true; });
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["Cross-Origin-Resource-Policy"], "same-site");
  assert.equal(headers["Permissions-Policy"], "camera=(), microphone=(), geolocation=()");
  assert.equal(headers["Content-Security-Policy"], "default-src 'none'; frame-ancestors 'none'");
  assert.equal(headers["X-Powered-By"], null);
  assert.equal(continued, true);
});
