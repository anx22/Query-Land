import { randomUUID } from "node:crypto";
import { normalizeEmail, validatePassword, type AuthUser, type UserRole } from "@seo-tool/domain-model";
import { hashPassword, hashToken, verifyPassword } from "../password.js";
import { mapUser } from "../row-mappers.js";
import type { AuditLog } from "./audit-log.js";
import { sqliteConstraintError } from "./store-errors.js";
import type { AsyncDatabase } from "../db/index.js";

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
}

export interface LoginResult {
  user: AuthUser;
  token: string;
  expiresAt: string;
}

export interface AuthStore {
  registerUser(input: RegisterInput): Promise<AuthUser>;
  login(email: string, password: string): Promise<LoginResult | null>;
  getUserBySessionToken(token: string): Promise<AuthUser | null>;
  invalidateSessionToken(token: string): Promise<boolean>;
  cleanupExpiredSessions(now?: string): Promise<number>;
}

export function createAuthStore(db: AsyncDatabase, audit: AuditLog): AuthStore {
  return new SQLiteAuthStore(db, audit);
}

class SQLiteAuthStore implements AuthStore {
  constructor(private readonly db: AsyncDatabase, private readonly audit: AuditLog) {}

  async registerUser(input: RegisterInput): Promise<AuthUser> {
    const email = normalizeEmail(input.email);
    const password = validatePassword(input.password);
    const now = new Date().toISOString();
    const user: AuthUser = {
      id: `usr-${randomUUID()}`,
      email,
      name: input.name?.trim() || email.split("@")[0],
      role: input.role ?? "owner",
      status: "active",
      createdAt: now,
      updatedAt: now
    };
    try {
      await this.db.prepare(`INSERT INTO users (id, email, name, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(user.id, user.email, user.name, hashPassword(password), user.role, user.status, user.createdAt, user.updatedAt);
    } catch (error) {
      throw sqliteConstraintError(error, "duplicate_email", "Email already exists");
    }
    await this.audit(user.id, "auth.register", "user", user.id, { role: user.role });
    return user;
  }

  async login(email: string, password: string): Promise<LoginResult | null> {
    const normalizedEmail = normalizeEmail(email);
    const row = await this.db.prepare(`SELECT * FROM users WHERE email = ? AND status = 'active'`).get(normalizedEmail);
    if (!row || !verifyPassword(password, String(row.password_hash))) {
      return null;
    }
    // Opportunistic session hygiene: purge expired rows on each successful login
    // (cheap, indexed by expires_at). Keeps the table bounded without a separate daemon.
    await this.cleanupExpiredSessions();
    const token = `seo_${randomUUID()}_${randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const sessionId = `ses-${randomUUID()}`;
    await this.db.prepare(`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`).run(sessionId, String(row.id), hashToken(token), expiresAt, now.toISOString());
    await this.audit(String(row.id), "auth.login", "session", sessionId, { expiresAt });
    return { user: mapUser(row), token, expiresAt };
  }

  async getUserBySessionToken(token: string): Promise<AuthUser | null> {
    const row = await this.db.prepare(`
      SELECT users.*
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.status = 'active'
    `).get(hashToken(token), new Date().toISOString());
    return row ? mapUser(row) : null;
  }

  async invalidateSessionToken(token: string): Promise<boolean> {
    const result = await this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token));
    return result.changes > 0;
  }

  async cleanupExpiredSessions(now = new Date().toISOString()): Promise<number> {
    const result = await this.db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(now);
    return result.changes;
  }
}
