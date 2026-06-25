import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

async function registerAndLogin(app: ReturnType<typeof createApp>) {
  const email = "gate@example.com";
  const password = "very-long-password";
  await app("POST", "/auth/register", { email, password });
  const login = await app("POST", "/auth/login", { email, password });
  return (login.body as { data: { token: string } }).data.token;
}

function withGate<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.AUTH_GATE_ENABLED;
  if (value === undefined) delete process.env.AUTH_GATE_ENABLED;
  else process.env.AUTH_GATE_ENABLED = value;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.AUTH_GATE_ENABLED;
    else process.env.AUTH_GATE_ENABLED = prev;
  });
}

test("gate disabled by default: protected route works without a token", async () => {
  const { app } = await testApp();
  await withGate(undefined, async () => {
    const res = await app("GET", "/projects");
    assert.equal(res.status, 200);
  });
});

test("gate enabled: protected route without a token is rejected with 401", async () => {
  const { app } = await testApp();
  await withGate("true", async () => {
    const res = await app("GET", "/projects", undefined, { headers: { "x-request-id": "req-gate-401" } });
    assert.equal(res.status, 401);
    assert.equal((res.body as { error: { code: string } }).error.code, "unauthorized");
  });
});

test("gate enabled: protected route with a valid session token is allowed", async () => {
  const { app } = await testApp();
  await withGate("true", async () => {
    const token = await registerAndLogin(app);
    const res = await app("GET", "/projects", undefined, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200);
  });
});

test("gate enabled: public paths (health, auth) stay reachable without a token", async () => {
  const { app } = await testApp();
  await withGate("true", async () => {
    const health = await app("GET", "/health");
    assert.equal(health.status, 200);
    // The auth flow itself must work to obtain a token in the first place.
    const token = await registerAndLogin(app);
    assert.ok(token.length > 0);
  });
});

test("gate enabled: an invalid/expired token is rejected", async () => {
  const { app } = await testApp();
  await withGate("true", async () => {
    const res = await app("GET", "/projects", undefined, { headers: { authorization: "Bearer not-a-real-token" } });
    assert.equal(res.status, 401);
  });
});

test("cleanupExpiredSessions is wired and callable (no longer dead code)", async () => {
  const { store } = await testApp();
  const removed = await store.cleanupExpiredSessions();
  assert.equal(typeof removed, "number");
  assert.equal(removed, 0);
});
