const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("server mounts security headers before CORS and sanitizes parsed request bodies before API routes", () => {
  const server = read("server.js");
  assert.match(server, /require\("\.\/middleware\/securityMiddleware"\)/);
  assert.match(server, /require\("\.\/middleware\/sanitizeInput"\)/);
  const headersIndex = server.indexOf("app.use(securityHeaders)");
  const corsIndex = server.indexOf("app.use(cors(");
  const jsonIndex = server.indexOf("app.use(express.json())");
  const sanitizerIndex = server.indexOf("app.use(sanitizeInput)");
  const authRoutesIndex = server.indexOf('app.use("/api/auth", authRoutes)');
  assert.ok(headersIndex >= 0 && headersIndex < corsIndex);
  assert.ok(corsIndex < jsonIndex);
  assert.ok(jsonIndex < sanitizerIndex);
  assert.ok(sanitizerIndex < authRoutesIndex);
});

test("sign-in endpoint uses the dedicated authentication-attempt rate limiter", () => {
  const routes = read("routes/authRoutes.js");
  assert.match(routes, /require\("\.\.\/middleware\/authAttemptLimiter"\)/);
  assert.match(routes, /router\.post\("\/signin",\s*authAttemptLimiter,\s*signin\)/);
});


test("Docker deployment allows the public frontend origin to be configured", () => {
  const compose = fs.readFileSync(path.join(__dirname, "..", "..", "docker-compose.yml"), "utf8");
  assert.match(compose, /FRONTEND_URL:\s*\$\{FRONTEND_URL:-http:\/\/localhost:8080\}/);
});

test("REST and Socket.IO CORS use configured comma-separated frontend origins", () => {
  const server = read("server.js");
  assert.match(server, /const configuredFrontendOrigins = \(process\.env\.FRONTEND_URL \|\| ""\)/);
  assert.match(server, /: \["http:\/\/localhost:5173"\]/);
  assert.match(server, /\.split\(","\)/);
  assert.match(server, /cors:\s*\{\s*origin: frontendOrigins/);
  assert.match(server, /app\.use\(cors\(\{\s*origin: frontendOrigins/);
});
