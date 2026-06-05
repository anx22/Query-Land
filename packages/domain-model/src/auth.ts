import { DomainValidationError } from "./errors.js";

export type UserRole = "owner" | "editor" | "viewer";
export type UserStatus = "active" | "disabled";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new DomainValidationError("email must be valid");
  }
  return normalized;
}

export function validatePassword(password: string): string {
  if (password.length < 12) {
    throw new DomainValidationError("password must contain at least 12 characters");
  }
  return password;
}
