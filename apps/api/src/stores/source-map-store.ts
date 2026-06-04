import type { SourceMapEntry } from "@seo-tool/domain-model";
import { mapSourceMapEntry } from "../sqlite-mappers.js";
import type { SQLiteDatabase } from "./sqlite-types.js";

export interface SourceMapStore {
  listSourceMapEntries(): SourceMapEntry[];
}

export function createSourceMapStore(db: SQLiteDatabase): SourceMapStore {
  return new SQLiteSourceMapStore(db);
}

class SQLiteSourceMapStore implements SourceMapStore {
  constructor(private readonly db: SQLiteDatabase) {}

  listSourceMapEntries(): SourceMapEntry[] {
    return this.db.prepare(`
      SELECT url_template_map.id, url_template_map.project_id, url_template_map.url_pattern, templates.name AS template,
             templates.component, templates.repo_path, url_template_map.confidence
      FROM url_template_map
      JOIN templates ON templates.id = url_template_map.template_id
      ORDER BY url_template_map.created_at ASC
    `).all().map(mapSourceMapEntry);
  }
}
