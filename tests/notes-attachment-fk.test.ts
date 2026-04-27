import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Notes } from "../src/index.ts";

// Build a minimal NoteStore.sqlite where the schema has BOTH ZNOTE and
// ZNOTE1 columns, but only ZNOTE is populated on attachment rows. This is
// the macOS 15+ shape that motivated the original bug report (#31).

const TMP_DIR = join(
  tmpdir(),
  `macos-ts-attachment-fk-${process.pid}-${Date.now()}`,
);
const DB_PATH = join(TMP_DIR, "NoteStore.sqlite");

const ENT_ACCOUNT = 1;
const ENT_FOLDER = 2;
const ENT_NOTE = 3;
const ENT_ATTACHMENT = 5;

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE Z_PRIMARYKEY (
      Z_ENT INTEGER PRIMARY KEY,
      Z_NAME VARCHAR,
      Z_SUPER INTEGER,
      Z_MAX INTEGER
    );

    CREATE TABLE ZICCLOUDSYNCINGOBJECT (
      Z_PK INTEGER PRIMARY KEY,
      Z_ENT INTEGER,
      Z_OPT INTEGER,
      ZNAME VARCHAR,
      ZTITLE2 VARCHAR,
      ZPARENT INTEGER,
      ZMARKEDFORDELETION INTEGER DEFAULT 0,
      ZTITLE1 VARCHAR,
      ZSNIPPET VARCHAR,
      ZFOLDER INTEGER,
      ZACCOUNT2 INTEGER,
      ZCREATIONDATE1 TIMESTAMP,
      ZMODIFICATIONDATE1 TIMESTAMP,
      ZISPASSWORDPROTECTED INTEGER DEFAULT 0,
      ZIDENTIFIER VARCHAR,
      ZFILENAME VARCHAR,
      ZTYPEUTI VARCHAR,
      ZNOTE INTEGER,
      ZNOTE1 INTEGER,
      ZMEDIA INTEGER,
      ZMERGEABLEDATA1 BLOB
    );

    CREATE TABLE ZICNOTEDATA (
      Z_PK INTEGER PRIMARY KEY,
      Z_ENT INTEGER,
      Z_OPT INTEGER,
      ZNOTE INTEGER,
      ZDATA BLOB
    );

    INSERT INTO Z_PRIMARYKEY (Z_ENT, Z_NAME, Z_SUPER, Z_MAX) VALUES
      (${ENT_ACCOUNT}, 'ICAccount', 0, 0),
      (${ENT_FOLDER}, 'ICFolder', 0, 0),
      (${ENT_NOTE}, 'ICNote', 0, 0),
      (${ENT_ATTACHMENT}, 'ICAttachment', 0, 0);
  `);

  db.query(
    `INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, Z_OPT, ZNAME)
     VALUES (1, ${ENT_ACCOUNT}, 1, 'iCloud')`,
  ).run();

  db.query(
    `INSERT INTO ZICCLOUDSYNCINGOBJECT
       (Z_PK, Z_ENT, Z_OPT, ZTITLE2, ZPARENT, ZMARKEDFORDELETION)
     VALUES (10, ${ENT_FOLDER}, 1, 'Notes', 1, 0)`,
  ).run();

  db.query(
    `INSERT INTO ZICCLOUDSYNCINGOBJECT
       (Z_PK, Z_ENT, Z_OPT, ZTITLE1, ZSNIPPET, ZFOLDER, ZACCOUNT2,
        ZCREATIONDATE1, ZMODIFICATIONDATE1, ZISPASSWORDPROTECTED)
     VALUES (100, ${ENT_NOTE}, 1, 'Note', '', 10, 1, 0, 0, 0)`,
  ).run();

  // Attachment rows: ZNOTE populated, ZNOTE1 NULL — the macOS 15+ shape.
  db.query(
    `INSERT INTO ZICCLOUDSYNCINGOBJECT
       (Z_PK, Z_ENT, Z_OPT, ZIDENTIFIER, ZFILENAME, ZTYPEUTI, ZNOTE, ZNOTE1)
     VALUES (200, ${ENT_ATTACHMENT}, 1, 'A1', 'a.jpg', 'public.jpeg', 100, NULL),
            (201, ${ENT_ATTACHMENT}, 1, 'A2', 'b.png', 'public.png',  100, NULL)`,
  ).run();

  db.close();
});

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("attachment FK column discovery (ZNOTE vs ZNOTE1)", () => {
  test("listAttachments returns rows when only ZNOTE is populated", () => {
    const notes = new Notes({ dbPath: DB_PATH, containerPath: TMP_DIR });
    try {
      const attachments = notes.listAttachments(100);
      expect(attachments).toHaveLength(2);
      const ids = attachments.map((a) => a.identifier).sort();
      expect(ids).toEqual(["A1", "A2"]);
    } finally {
      notes.close();
    }
  });

  test("attachment.name uses ZFILENAME when set", () => {
    const notes = new Notes({ dbPath: DB_PATH, containerPath: TMP_DIR });
    try {
      const attachments = notes.listAttachments(100);
      const names = attachments.map((a) => a.name).sort();
      expect(names).toEqual(["a.jpg", "b.png"]);
    } finally {
      notes.close();
    }
  });
});
