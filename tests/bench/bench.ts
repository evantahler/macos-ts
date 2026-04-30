import { resolve } from "node:path";
import { Contacts, Messages, Notes, Photos } from "../../src/index.ts";

const FIXTURE_DIR = resolve(import.meta.dir, "../fixtures");
const NOTES_DB = resolve(FIXTURE_DIR, "NoteStore.sqlite");
const MESSAGES_DB = resolve(FIXTURE_DIR, "chat.db");
const CONTACTS_DB = resolve(FIXTURE_DIR, "AddressBook-v22.abcddb");
const PHOTOS_DB = resolve(FIXTURE_DIR, "photos-library/database/Photos.sqlite");

const ITERATIONS = 200;

// Budgets are µs/call ceilings against the test fixtures. They're set ~10×
// the observed local numbers so CI variance doesn't cause flakes — a budget
// breach means a catastrophic regression (e.g. an N+1 sneaking back in or
// the SQLite pragmas being dropped), not a small slowdown. Tighten if you
// want a tighter perf gate.
interface Result {
  label: string;
  iterations: number;
  totalMs: number;
  perCallUs: number;
  budgetUs: number;
  passed: boolean;
}

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function bench(label: string, budgetUs: number, fn: () => unknown): Result {
  // Warmup so JIT/cache pages settle before timing
  for (let i = 0; i < 5; i++) fn();

  const start = Bun.nanoseconds();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const elapsedNs = Bun.nanoseconds() - start;

  const perCallUs = elapsedNs / ITERATIONS / 1e3;
  return {
    label,
    iterations: ITERATIONS,
    totalMs: elapsedNs / 1e6,
    perCallUs,
    budgetUs,
    passed: perCallUs <= budgetUs,
  };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function printResults(rows: Result[]): void {
  const headers = {
    op: "operation",
    n: "n",
    total: "total ms",
    per: "per call µs",
    budget: "budget µs",
    status: "status",
  };
  const opW = Math.max(headers.op.length, ...rows.map((r) => r.label.length));
  const nW = Math.max(
    headers.n.length,
    ...rows.map((r) => String(r.iterations).length),
  );
  const totalW = Math.max(
    headers.total.length,
    ...rows.map((r) => r.totalMs.toFixed(2).length),
  );
  const perW = Math.max(
    headers.per.length,
    ...rows.map((r) => r.perCallUs.toFixed(1).length),
  );
  const budgetW = Math.max(
    headers.budget.length,
    ...rows.map((r) => String(r.budgetUs).length),
  );
  const statusW = Math.max(headers.status.length, "FAIL".length);

  const sep = `+-${"-".repeat(opW)}-+-${"-".repeat(nW)}-+-${"-".repeat(totalW)}-+-${"-".repeat(perW)}-+-${"-".repeat(budgetW)}-+-${"-".repeat(statusW)}-+`;
  console.log(sep);
  console.log(
    `| ${pad(headers.op, opW)} | ${pad(headers.n, nW)} | ${pad(headers.total, totalW)} | ${pad(headers.per, perW)} | ${pad(headers.budget, budgetW)} | ${pad(headers.status, statusW)} |`,
  );
  console.log(sep);
  for (const r of rows) {
    const statusText = r.passed ? "PASS" : "FAIL";
    const color = r.passed ? GREEN : RED;
    const statusCell = `${color}${BOLD}${pad(statusText, statusW)}${RESET}`;
    console.log(
      `| ${pad(r.label, opW)} | ${pad(String(r.iterations), nW)} | ${pad(r.totalMs.toFixed(2), totalW)} | ${pad(r.perCallUs.toFixed(1), perW)} | ${pad(String(r.budgetUs), budgetW)} | ${statusCell} |`,
    );
  }
  console.log(sep);
}

const notes = new Notes({ dbPath: NOTES_DB, containerPath: FIXTURE_DIR });
const messages = new Messages({ dbPath: MESSAGES_DB });
const contacts = new Contacts({ dbPath: CONTACTS_DB });
const photos = new Photos({ dbPath: PHOTOS_DB });

const firstNoteId = notes.notes()[0]?.id;
const firstChatId = messages.chats()[0]?.id;
const firstContactId = contacts.contacts()[0]?.id;
const firstPhotoId = photos.photos()[0]?.id;

const rows: Result[] = [];

rows.push(bench("notes.notes()", 200, () => notes.notes()));
if (firstNoteId !== undefined) {
  rows.push(bench("notes.read(id)", 200, () => notes.read(firstNoteId)));
}

rows.push(bench("messages.chats()", 150, () => messages.chats()));
if (firstChatId !== undefined) {
  rows.push(
    bench("messages.messages(chatId)", 200, () =>
      messages.messages(firstChatId),
    ),
  );
}

rows.push(bench("contacts.contacts()", 100, () => contacts.contacts()));
if (firstContactId !== undefined) {
  rows.push(
    bench("contacts.getContact(id)", 150, () =>
      contacts.getContact(firstContactId),
    ),
  );
}

rows.push(
  bench("photos.photos({limit:50})", 250, () => photos.photos({ limit: 50 })),
);
rows.push(
  bench("photos.photos({mediaType:'video'})", 75, () =>
    photos.photos({ mediaType: "video" }),
  ),
);
if (firstPhotoId !== undefined) {
  rows.push(
    bench("photos.getPhoto(id)", 75, () => photos.getPhoto(firstPhotoId)),
  );
  rows.push(
    bench("photos.getPhotoUrl(id)", 75, () => photos.getPhotoUrl(firstPhotoId)),
  );
}

printResults(rows);

notes.close();
messages.close();
contacts.close();
photos.close();

const failures = rows.filter((r) => !r.passed);
if (failures.length > 0) {
  console.log(
    `\n${RED}${BOLD}${failures.length} of ${rows.length} budgets exceeded:${RESET}`,
  );
  for (const r of failures) {
    console.log(
      `  ${RED}${r.label}${RESET}: ${r.perCallUs.toFixed(1)}µs > ${r.budgetUs}µs budget`,
    );
  }
  process.exit(1);
}

console.log(`\n${GREEN}${BOLD}All ${rows.length} budgets met.${RESET}`);
