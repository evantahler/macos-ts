import { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { DatabaseNotFoundError } from "../errors.ts";

const DEFAULT_DB_PATH = join(
  homedir(),
  "Library/Group Containers/group.com.apple.notes/NoteStore.sqlite",
);

export function openDatabase(dbPath?: string): Database {
  const path = dbPath ?? DEFAULT_DB_PATH;

  if (!existsSync(path)) {
    throw new DatabaseNotFoundError(path);
  }

  try {
    return new Database(path, { readonly: true });
  } catch (error) {
    throw new DatabaseNotFoundError(path);
  }
}

export function defaultDatabasePath(): string {
  return DEFAULT_DB_PATH;
}
