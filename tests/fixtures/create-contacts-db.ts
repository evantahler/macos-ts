/**
 * Creates a test AddressBook-v22.abcddb database with realistic Contacts data.
 * Run with: bun run tests/fixtures/create-contacts-db.ts
 *
 * The generated DB is checked into git so tests run without Full Disk Access.
 */

import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import {
  FIXTURE_DIR,
  cleanupDatabase,
  dateToMacTime as toMacTime,
} from "./helpers.ts";

const DB_PATH = resolve(FIXTURE_DIR, "AddressBook-v22.abcddb");

// Delete existing DB
cleanupDatabase(DB_PATH);

const db = new Database(DB_PATH);

// ============================================================================
// Create schema (simplified version of the real AddressBook Core Data schema)
// ============================================================================

db.exec(`
  CREATE TABLE Z_PRIMARYKEY (
    Z_ENT INTEGER PRIMARY KEY,
    Z_NAME VARCHAR,
    Z_SUPER INTEGER DEFAULT 0,
    Z_MAX INTEGER DEFAULT 0
  );

  CREATE TABLE ZABCDRECORD (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER NOT NULL,
    Z_OPT INTEGER DEFAULT 1,
    ZTYPE INTEGER DEFAULT 0,
    ZFIRSTNAME VARCHAR,
    ZLASTNAME VARCHAR,
    ZMIDDLENAME VARCHAR,
    ZORGANIZATION VARCHAR,
    ZJOBTITLE VARCHAR,
    ZDEPARTMENT VARCHAR,
    ZNICKNAME VARCHAR,
    ZBIRTHDAY TIMESTAMP,
    ZNAME VARCHAR,
    ZSORTINGFIRSTNAME VARCHAR,
    ZSORTINGLASTNAME VARCHAR,
    ZCREATIONDATE TIMESTAMP,
    ZMODIFICATIONDATE TIMESTAMP,
    ZIMAGEDATA BLOB,
    ZTHUMBNAILIMAGEDATA BLOB,
    ZCONTAINER INTEGER,
    ZCONTACTINDEX INTEGER,
    ZNOTE INTEGER,
    ZUNIQUEID VARCHAR
  );

  CREATE TABLE ZABCDEMAILADDRESS (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER DEFAULT 11,
    Z_OPT INTEGER DEFAULT 1,
    ZOWNER INTEGER REFERENCES ZABCDRECORD(Z_PK),
    ZADDRESS VARCHAR,
    ZADDRESSNORMALIZED VARCHAR,
    ZLABEL VARCHAR,
    ZISPRIMARY INTEGER DEFAULT 0,
    ZISPRIVATE INTEGER DEFAULT 0,
    ZORDERINGINDEX INTEGER DEFAULT 0,
    ZUNIQUEID VARCHAR
  );
  CREATE INDEX IDX_EMAIL_OWNER ON ZABCDEMAILADDRESS(ZOWNER);

  CREATE TABLE ZABCDPHONENUMBER (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER DEFAULT 15,
    Z_OPT INTEGER DEFAULT 1,
    ZOWNER INTEGER REFERENCES ZABCDRECORD(Z_PK),
    ZFULLNUMBER VARCHAR,
    ZLABEL VARCHAR,
    ZISPRIMARY INTEGER DEFAULT 0,
    ZISPRIVATE INTEGER DEFAULT 0,
    ZORDERINGINDEX INTEGER DEFAULT 0,
    ZUNIQUEID VARCHAR
  );
  CREATE INDEX IDX_PHONE_OWNER ON ZABCDPHONENUMBER(ZOWNER);

  CREATE TABLE ZABCDPOSTALADDRESS (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER DEFAULT 16,
    Z_OPT INTEGER DEFAULT 1,
    ZOWNER INTEGER REFERENCES ZABCDRECORD(Z_PK),
    ZSTREET VARCHAR,
    ZCITY VARCHAR,
    ZSTATE VARCHAR,
    ZZIPCODE VARCHAR,
    ZCOUNTRYNAME VARCHAR,
    ZCOUNTRYCODE VARCHAR,
    ZLABEL VARCHAR,
    ZISPRIMARY INTEGER DEFAULT 0,
    ZISPRIVATE INTEGER DEFAULT 0,
    ZORDERINGINDEX INTEGER DEFAULT 0,
    ZUNIQUEID VARCHAR
  );
  CREATE INDEX IDX_ADDR_OWNER ON ZABCDPOSTALADDRESS(ZOWNER);

  CREATE TABLE ZABCDURLADDRESS (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER DEFAULT 31,
    Z_OPT INTEGER DEFAULT 1,
    ZOWNER INTEGER REFERENCES ZABCDRECORD(Z_PK),
    ZURL VARCHAR,
    ZLABEL VARCHAR,
    ZISPRIMARY INTEGER DEFAULT 0,
    ZISPRIVATE INTEGER DEFAULT 0,
    ZORDERINGINDEX INTEGER DEFAULT 0,
    ZUNIQUEID VARCHAR
  );
  CREATE INDEX IDX_URL_OWNER ON ZABCDURLADDRESS(ZOWNER);

  CREATE TABLE ZABCDSOCIALPROFILE (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER DEFAULT 29,
    Z_OPT INTEGER DEFAULT 1,
    ZOWNER INTEGER REFERENCES ZABCDRECORD(Z_PK),
    ZURLSTRING VARCHAR,
    ZUSERIDENTIFIER VARCHAR,
    ZSERVICENAME VARCHAR,
    ZLABEL VARCHAR,
    ZISPRIMARY INTEGER DEFAULT 0,
    ZISPRIVATE INTEGER DEFAULT 0,
    ZORDERINGINDEX INTEGER DEFAULT 0,
    ZUNIQUEID VARCHAR
  );
  CREATE INDEX IDX_SOCIAL_OWNER ON ZABCDSOCIALPROFILE(ZOWNER);

  CREATE TABLE ZABCDRELATEDNAME (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER DEFAULT 26,
    Z_OPT INTEGER DEFAULT 1,
    ZOWNER INTEGER REFERENCES ZABCDRECORD(Z_PK),
    ZNAME VARCHAR,
    ZLABEL VARCHAR,
    ZISPRIMARY INTEGER DEFAULT 0,
    ZISPRIVATE INTEGER DEFAULT 0,
    ZORDERINGINDEX INTEGER DEFAULT 0,
    ZUNIQUEID VARCHAR
  );
  CREATE INDEX IDX_RELATED_OWNER ON ZABCDRELATEDNAME(ZOWNER);

  CREATE TABLE ZABCDCONTACTDATE (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER DEFAULT 4,
    Z_OPT INTEGER DEFAULT 1,
    ZOWNER INTEGER REFERENCES ZABCDRECORD(Z_PK),
    ZDATE TIMESTAMP,
    ZLABEL VARCHAR,
    ZISPRIMARY INTEGER DEFAULT 0,
    ZISPRIVATE INTEGER DEFAULT 0,
    ZORDERINGINDEX INTEGER DEFAULT 0,
    ZUNIQUEID VARCHAR
  );
  CREATE INDEX IDX_DATE_OWNER ON ZABCDCONTACTDATE(ZOWNER);

  CREATE TABLE ZABCDNOTE (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER DEFAULT 14,
    Z_OPT INTEGER DEFAULT 1,
    ZCONTACT INTEGER REFERENCES ZABCDRECORD(Z_PK),
    ZTEXT VARCHAR,
    ZRICHTEXTDATA BLOB
  );
  CREATE INDEX IDX_NOTE_CONTACT ON ZABCDNOTE(ZCONTACT);

  CREATE TABLE ZABCDCONTACTINDEX (
    Z_PK INTEGER PRIMARY KEY,
    Z_ENT INTEGER DEFAULT 5,
    Z_OPT INTEGER DEFAULT 1,
    ZCONTACT INTEGER REFERENCES ZABCDRECORD(Z_PK),
    ZSTRINGFORINDEXING VARCHAR
  );
  CREATE INDEX IDX_CI_CONTACT ON ZABCDCONTACTINDEX(ZCONTACT);

  CREATE TABLE Z_22PARENTGROUPS (
    Z_22CONTACTS INTEGER,
    Z_19PARENTGROUPS1 INTEGER
  );
  CREATE INDEX IDX_GP_CONTACTS ON Z_22PARENTGROUPS(Z_22CONTACTS);
  CREATE INDEX IDX_GP_GROUPS ON Z_22PARENTGROUPS(Z_19PARENTGROUPS1);
`);

// ============================================================================
// Z_PRIMARYKEY entries (entity type registry)
// ============================================================================

const entities: [number, string][] = [
  [19, "ABCDGroup"],
  [22, "ABCDContact"],
  [11, "ABCDEmailAddress"],
  [15, "ABCDPhoneNumber"],
  [16, "ABCDPostalAddress"],
  [31, "ABCDURLAddress"],
  [29, "ABCDSocialProfile"],
  [26, "ABCDRelatedName"],
  [4, "ABCDContactDate"],
  [14, "ABCDNote"],
  [5, "ABCDContactIndex"],
];

for (const [ent, name] of entities) {
  db.query("INSERT INTO Z_PRIMARYKEY (Z_ENT, Z_NAME) VALUES (?, ?)").run(
    ent,
    name,
  );
}

// ============================================================================
// Timestamps
// ============================================================================

const now = new Date("2025-06-15T10:00:00Z");
const yesterday = new Date("2025-06-14T10:00:00Z");
const lastWeek = new Date("2025-06-08T10:00:00Z");
const lastMonth = new Date("2025-05-15T10:00:00Z");
const twoMonthsAgo = new Date("2025-04-15T10:00:00Z");

// ============================================================================
// Contact records (Z_ENT = 22 for ABCDContact)
// ============================================================================

let recordPk = 0;

function insertContact(opts: {
  firstName?: string | null;
  lastName?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  birthday?: Date | null;
  hasImage?: boolean;
  createdAt: Date;
  modifiedAt: Date;
}): number {
  const pk = ++recordPk;
  const sortFirst = (opts.firstName ?? "").toLowerCase();
  const sortLast = (opts.lastName ?? "").toLowerCase();
  // For groups, ZNAME is used. For contacts, display name is computed.
  const name = opts.firstName || opts.lastName
    ? `${opts.firstName ?? ""} ${opts.lastName ?? ""}`.trim()
    : opts.organization ?? null;

  db.query(
    `INSERT INTO ZABCDRECORD
     (Z_PK, Z_ENT, Z_OPT, ZFIRSTNAME, ZLASTNAME, ZORGANIZATION, ZJOBTITLE, ZDEPARTMENT,
      ZBIRTHDAY, ZNAME, ZSORTINGFIRSTNAME, ZSORTINGLASTNAME,
      ZCREATIONDATE, ZMODIFICATIONDATE, ZIMAGEDATA, ZUNIQUEID)
     VALUES (?, 22, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    pk,
    opts.firstName ?? null,
    opts.lastName ?? null,
    opts.organization ?? null,
    opts.jobTitle ?? null,
    opts.department ?? null,
    opts.birthday ? toMacTime(opts.birthday) : null,
    name,
    sortFirst,
    sortLast,
    toMacTime(opts.createdAt),
    toMacTime(opts.modifiedAt),
    opts.hasImage ? Buffer.from([0x89, 0x50, 0x4e, 0x47]) : null, // fake PNG header
    `contact-${pk}`,
  );
  return pk;
}

function insertGroup(name: string): number {
  const pk = ++recordPk;
  db.query(
    `INSERT INTO ZABCDRECORD
     (Z_PK, Z_ENT, Z_OPT, ZNAME, ZUNIQUEID, ZCREATIONDATE, ZMODIFICATIONDATE)
     VALUES (?, 19, 1, ?, ?, ?, ?)`,
  ).run(pk, name, `group-${pk}`, toMacTime(now), toMacTime(now));
  return pk;
}

// --- Contact 1: John Doe (full details) ---
const johnId = insertContact({
  firstName: "John",
  lastName: "Doe",
  organization: "Acme Inc",
  jobTitle: "Software Engineer",
  department: "Engineering",
  birthday: new Date("1990-05-15T00:00:00Z"),
  hasImage: true,
  createdAt: twoMonthsAgo,
  modifiedAt: now,
});

// --- Contact 2: Jane Smith (moderate details) ---
const janeId = insertContact({
  firstName: "Jane",
  lastName: "Smith",
  organization: "Tech Corp",
  createdAt: lastMonth,
  modifiedAt: yesterday,
});

// --- Contact 3: Acme Corp (organization-only) ---
const acmeId = insertContact({
  organization: "Acme Corporation",
  jobTitle: null,
  createdAt: lastWeek,
  modifiedAt: lastWeek,
});

// --- Contact 4: Alice Johnson (minimal) ---
const aliceId = insertContact({
  firstName: "Alice",
  lastName: "Johnson",
  createdAt: lastMonth,
  modifiedAt: lastMonth,
});

// --- Contact 5: Bob Wilson (name only, no details) ---
const bobId = insertContact({
  firstName: "Bob",
  lastName: "Wilson",
  createdAt: yesterday,
  modifiedAt: yesterday,
});

// ============================================================================
// Email addresses
// ============================================================================

let emailPk = 0;

function insertEmail(
  owner: number,
  address: string,
  label: string,
  isPrimary: boolean,
): void {
  const pk = ++emailPk;
  db.query(
    `INSERT INTO ZABCDEMAILADDRESS (Z_PK, ZOWNER, ZADDRESS, ZADDRESSNORMALIZED, ZLABEL, ZISPRIMARY, ZORDERINGINDEX, ZUNIQUEID)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(pk, owner, address, address.toLowerCase(), label, isPrimary ? 1 : 0, pk, `email-${pk}`);
}

insertEmail(johnId, "john@acme.com", "_$!<Work>!$_", true);
insertEmail(johnId, "johndoe@gmail.com", "_$!<Home>!$_", false);
insertEmail(janeId, "jane@techcorp.com", "_$!<Work>!$_", true);
insertEmail(acmeId, "info@acmecorp.com", "_$!<Work>!$_", true);
insertEmail(aliceId, "alice@example.com", "_$!<Home>!$_", true);

// ============================================================================
// Phone numbers
// ============================================================================

let phonePk = 0;

function insertPhone(
  owner: number,
  number: string,
  label: string,
  isPrimary: boolean,
): void {
  const pk = ++phonePk;
  db.query(
    `INSERT INTO ZABCDPHONENUMBER (Z_PK, ZOWNER, ZFULLNUMBER, ZLABEL, ZISPRIMARY, ZORDERINGINDEX, ZUNIQUEID)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(pk, owner, number, label, isPrimary ? 1 : 0, pk, `phone-${pk}`);
}

insertPhone(johnId, "+1 (555) 123-4567", "_$!<Mobile>!$_", true);
insertPhone(johnId, "+1 (555) 987-6543", "_$!<Work>!$_", false);
insertPhone(janeId, "+1 (555) 234-5678", "_$!<Mobile>!$_", true);
insertPhone(acmeId, "+1 (555) 000-1111", "_$!<Main>!$_", true);

// ============================================================================
// Postal addresses
// ============================================================================

let addrPk = 0;

function insertAddress(
  owner: number,
  opts: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    label: string;
  },
): void {
  const pk = ++addrPk;
  db.query(
    `INSERT INTO ZABCDPOSTALADDRESS (Z_PK, ZOWNER, ZSTREET, ZCITY, ZSTATE, ZZIPCODE, ZCOUNTRYNAME, ZLABEL, ZORDERINGINDEX, ZUNIQUEID)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(pk, owner, opts.street, opts.city, opts.state, opts.zip, opts.country, opts.label, pk, `addr-${pk}`);
}

insertAddress(johnId, {
  street: "123 Main St",
  city: "San Francisco",
  state: "CA",
  zip: "94105",
  country: "United States",
  label: "_$!<Home>!$_",
});

insertAddress(acmeId, {
  street: "456 Corporate Blvd",
  city: "New York",
  state: "NY",
  zip: "10001",
  country: "United States",
  label: "_$!<Work>!$_",
});

// ============================================================================
// URLs
// ============================================================================

let urlPk = 0;

function insertURL(owner: number, url: string, label: string): void {
  const pk = ++urlPk;
  db.query(
    `INSERT INTO ZABCDURLADDRESS (Z_PK, ZOWNER, ZURL, ZLABEL, ZORDERINGINDEX, ZUNIQUEID)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(pk, owner, url, label, pk, `url-${pk}`);
}

insertURL(johnId, "https://johndoe.dev", "_$!<HomePage>!$_");
insertURL(acmeId, "https://acmecorp.com", "_$!<HomePage>!$_");

// ============================================================================
// Social profiles
// ============================================================================

let socialPk = 0;

function insertSocialProfile(
  owner: number,
  opts: { url: string; username: string; service: string },
): void {
  const pk = ++socialPk;
  db.query(
    `INSERT INTO ZABCDSOCIALPROFILE (Z_PK, ZOWNER, ZURLSTRING, ZUSERIDENTIFIER, ZSERVICENAME, ZORDERINGINDEX, ZUNIQUEID)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(pk, owner, opts.url, opts.username, opts.service, pk, `social-${pk}`);
}

insertSocialProfile(johnId, {
  url: "https://twitter.com/johndoe",
  username: "johndoe",
  service: "Twitter",
});

// ============================================================================
// Related names
// ============================================================================

let relPk = 0;

function insertRelatedName(
  owner: number,
  name: string,
  label: string,
): void {
  const pk = ++relPk;
  db.query(
    `INSERT INTO ZABCDRELATEDNAME (Z_PK, ZOWNER, ZNAME, ZLABEL, ZORDERINGINDEX, ZUNIQUEID)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(pk, owner, name, label, pk, `rel-${pk}`);
}

insertRelatedName(johnId, "Jane Doe", "_$!<Spouse>!$_");

// ============================================================================
// Contact dates
// ============================================================================

let datePk = 0;

function insertContactDate(
  owner: number,
  date: Date,
  label: string,
): void {
  const pk = ++datePk;
  db.query(
    `INSERT INTO ZABCDCONTACTDATE (Z_PK, ZOWNER, ZDATE, ZLABEL, ZORDERINGINDEX, ZUNIQUEID)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(pk, owner, toMacTime(date), label, pk, `date-${pk}`);
}

insertContactDate(johnId, new Date("2015-06-20T00:00:00Z"), "_$!<Anniversary>!$_");

// ============================================================================
// Notes
// ============================================================================

let notePk = 0;

function insertNote(contactId: number, text: string): void {
  const pk = ++notePk;
  db.query(
    `INSERT INTO ZABCDNOTE (Z_PK, ZCONTACT, ZTEXT) VALUES (?, ?, ?)`,
  ).run(pk, contactId, text);
}

insertNote(johnId, "Met at WWDC 2023. Great engineer, loves Rust.");

// ============================================================================
// Groups (Z_ENT = 19 for ABCDGroup)
// ============================================================================

const workGroupId = insertGroup("Work");
const friendsGroupId = insertGroup("Friends");

// ============================================================================
// Group membership
// ============================================================================

function addToGroup(contactId: number, groupId: number): void {
  db.query(
    "INSERT INTO Z_22PARENTGROUPS (Z_22CONTACTS, Z_19PARENTGROUPS1) VALUES (?, ?)",
  ).run(contactId, groupId);
}

addToGroup(johnId, workGroupId);
addToGroup(janeId, workGroupId);
addToGroup(janeId, friendsGroupId);
addToGroup(aliceId, friendsGroupId);

// ============================================================================
// Done
// ============================================================================

db.close();
console.log(`Created test Contacts database at ${DB_PATH}`);
console.log(`Contacts created: ${recordPk - 2} (plus 2 groups)`);
console.log("Contacts: John Doe, Jane Smith, Acme Corporation, Alice Johnson, Bob Wilson");
console.log("Groups: Work (John, Jane), Friends (Jane, Alice)");
