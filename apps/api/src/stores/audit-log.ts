import { randomUUID } from "node:crypto";
import type { SQLiteDatabase } from "./sqlite-types.js";

export type AuditLog = (actorId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) => void;

export function createAuditLog(db: SQLiteDatabase): AuditLog {
  return (actorId, action, entityType, entityId, metadata) => {
    db.prepare(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      `aud-${randomUUID()}`,
      actorId,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata),
      new Date().toISOString()
    );
  };
}
