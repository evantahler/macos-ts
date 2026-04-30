import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { DatabaseAccessDeniedError, DatabaseNotFoundError } from "../errors.ts";

export function openDatabase(
  dbPath: string | undefined,
  defaultPath: string,
): Database {
  const path = dbPath ?? defaultPath;

  if (!existsSync(path)) {
    throw new DatabaseNotFoundError(path);
  }

  try {
    const db = new Database(path, { readonly: true });
    // Tuning for read-heavy access against multi-GB system DBs (Photos.sqlite,
    // chat.db). Defaults give ~2 MB cache and no mmap, which thrashes pages on
    // every list query. 64 MB cache + 256 MB mmap typically gets large reads
    // 3-10x faster on cold cache and lets the OS share pages across queries.
    db.exec(`
      PRAGMA query_only = 1;
      PRAGMA temp_store = MEMORY;
      PRAGMA cache_size = -65536;
      PRAGMA mmap_size = 268435456;
    `);
    return db;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "SQLITE_AUTH"
    ) {
      throw new DatabaseAccessDeniedError(path);
    }
    throw new DatabaseNotFoundError(path);
  }
}
