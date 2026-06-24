import { randomUUID } from "node:crypto";
import type { AsyncDatabase } from "../db/index.js";

export type AuditLog = (
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>
) => Promise<void>;

export function createAuditLog(db: AsyncDatabase): AuditLog {
  return async (actorId, action, entityType, entityId, metadata) => {
    await db
      .prepare(
        `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
