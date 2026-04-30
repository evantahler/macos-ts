import { Database } from "bun:sqlite";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { openDatabase as openDatabaseShared } from "../../database/connection.ts";

const ADDRESSBOOK_DIR = join(
  homedir(),
  "Library/Application Support/AddressBook",
);
const ROOT_DB = join(ADDRESSBOOK_DIR, "AddressBook-v22.abcddb");
const SOURCES_DIR = join(ADDRESSBOOK_DIR, "Sources");

// Module-level cache: discovery scans every Sources/<UUID> DB and opens each
// to count rows. Repeated Contacts() instantiation (tests, server restart)
// would re-scan unnecessarily. Cache the resolved path for the process lifetime.
let cachedDefaultDbPath: string | null = null;

/**
 * Find the best AddressBook database to open.
 *
 * Apple Contacts stores data in per-account "source" databases under
 * Sources/<UUID>/AddressBook-v22.abcddb. The root database typically
 * contains no contacts. We scan all source databases and pick the one
 * with the most contact records (Z_ENT=22).
 */
function findDefaultDbPath(): string {
  if (cachedDefaultDbPath !== null) return cachedDefaultDbPath;
  if (!existsSync(SOURCES_DIR)) {
    cachedDefaultDbPath = ROOT_DB;
    return ROOT_DB;
  }

  let bestPath = ROOT_DB;
  let bestCount = 0;

  try {
    const sources = readdirSync(SOURCES_DIR);
    for (const source of sources) {
      const dbPath = join(SOURCES_DIR, source, "AddressBook-v22.abcddb");
      if (!existsSync(dbPath)) continue;

      try {
        const db = new Database(dbPath, { readonly: true });
        const row = db
          .query("SELECT COUNT(*) as cnt FROM ZABCDRECORD WHERE Z_ENT = 22")
          .get() as { cnt: number } | null;
        const count = row?.cnt ?? 0;
        db.close();

        if (count > bestCount) {
          bestCount = count;
          bestPath = dbPath;
        }
      } catch {
        // Skip unreadable databases
      }
    }
  } catch {
    // Sources dir unreadable, fall back to root
  }

  cachedDefaultDbPath = bestPath;
  return bestPath;
}

export function openDatabase(dbPath?: string) {
  const path = dbPath ?? findDefaultDbPath();
  return openDatabaseShared(path, path);
}
