import type { Database } from "bun:sqlite";
import type {
  Contact,
  ContactAddress,
  ContactDate,
  ContactDetails,
  ContactEmail,
  ContactPhone,
  ContactRelatedName,
  ContactSocialProfile,
  ContactURL,
  Group,
  ListContactsOptions,
  ListGroupsOptions,
  SearchContactsOptions,
} from "../types.ts";
import * as Q from "./queries.ts";

interface ContactRow {
  id: number;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
  jobTitle: string | null;
  department: string | null;
  birthday: number | null;
  createdAt: number | null;
  modifiedAt: number | null;
  hasImage: number;
}

interface GroupRow {
  id: number;
  name: string | null;
}

interface NoteRow {
  text: string | null;
}

export class ContactReader {
  private db: Database;
  private groupMemberCounts: Map<number, number> = new Map();

  constructor(db: Database) {
    this.db = db;
    this.buildCaches();
  }

  private buildCaches(): void {
    const rows = this.db.query(Q.COUNT_GROUP_MEMBERS).all() as {
      groupId: number;
      count: number;
    }[];
    for (const r of rows) {
      this.groupMemberCounts.set(r.groupId, r.count);
    }
  }

  private cleanLabel(label: string | null): string | null {
    if (!label) return null;
    const match = label.match(/^_\$!<(.+)>!\$_$/);
    return match ? (match[1] as string) : label;
  }

  private rowToContact(row: ContactRow): Contact {
    const firstName = row.firstName ?? "";
    const lastName = row.lastName ?? "";
    const displayName =
      `${firstName} ${lastName}`.trim() || row.organization || "No Name";
    return {
      id: row.id,
      firstName,
      lastName,
      displayName,
      organization: row.organization,
      jobTitle: row.jobTitle,
      department: row.department,
      birthday: row.birthday != null ? Q.macTimeToDate(row.birthday) : null,
      note: null,
      hasImage: row.hasImage === 1,
      createdAt: Q.macTimeToDate(row.createdAt),
      modifiedAt: Q.macTimeToDate(row.modifiedAt),
    };
  }

  listContacts(options?: ListContactsOptions): Contact[] {
    let results: Contact[];

    if (options?.groupId != null) {
      const rows = this.db
        .query(Q.LIST_CONTACTS_IN_GROUP)
        .all(options.groupId) as ContactRow[];
      results = rows.map((r) => this.rowToContact(r));
    } else {
      const rows = this.db.query(Q.LIST_CONTACTS).all() as ContactRow[];
      results = rows.map((r) => this.rowToContact(r));
    }

    if (options?.search) {
      const q = options.search.toLowerCase();
      results = results.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          (c.organization?.toLowerCase().includes(q) ?? false),
      );
    }

    const sortBy = options?.sortBy ?? "displayName";
    const order = options?.order ?? "asc";
    const mul = order === "asc" ? 1 : -1;

    results.sort((a, b) => {
      switch (sortBy) {
        case "createdAt":
          return mul * (a.createdAt.getTime() - b.createdAt.getTime());
        case "modifiedAt":
          return mul * (a.modifiedAt.getTime() - b.modifiedAt.getTime());
        default:
          return mul * a.displayName.localeCompare(b.displayName);
      }
    });

    if (options?.limit != null && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  getContact(contactId: number): ContactDetails | null {
    const row = this.db
      .query(Q.GET_CONTACT)
      .get(contactId) as ContactRow | null;
    if (!row) return null;

    const contact = this.rowToContact(row);

    const noteRow = this.db
      .query(Q.LIST_CONTACT_NOTE)
      .get(contactId) as NoteRow | null;

    const emails = (
      this.db.query(Q.LIST_EMAILS).all(contactId) as {
        address: string;
        label: string | null;
        isPrimary: number;
      }[]
    ).map(
      (r): ContactEmail => ({
        address: r.address,
        label: this.cleanLabel(r.label),
        isPrimary: r.isPrimary === 1,
      }),
    );

    const phones = (
      this.db.query(Q.LIST_PHONES).all(contactId) as {
        number: string;
        label: string | null;
        isPrimary: number;
      }[]
    ).map(
      (r): ContactPhone => ({
        number: r.number,
        label: this.cleanLabel(r.label),
        isPrimary: r.isPrimary === 1,
      }),
    );

    const addresses = (
      this.db.query(Q.LIST_ADDRESSES).all(contactId) as {
        street: string | null;
        city: string | null;
        state: string | null;
        zipCode: string | null;
        country: string | null;
        label: string | null;
      }[]
    ).map(
      (r): ContactAddress => ({
        street: r.street,
        city: r.city,
        state: r.state,
        zipCode: r.zipCode,
        country: r.country,
        label: this.cleanLabel(r.label),
      }),
    );

    const urls = (
      this.db.query(Q.LIST_URLS).all(contactId) as {
        url: string;
        label: string | null;
      }[]
    ).map(
      (r): ContactURL => ({
        url: r.url,
        label: this.cleanLabel(r.label),
      }),
    );

    const socialProfiles = (
      this.db.query(Q.LIST_SOCIAL_PROFILES).all(contactId) as {
        url: string | null;
        username: string | null;
        service: string | null;
        label: string | null;
      }[]
    ).map(
      (r): ContactSocialProfile => ({
        url: r.url,
        username: r.username,
        service: r.service,
        label: this.cleanLabel(r.label),
      }),
    );

    const relatedNames = (
      this.db.query(Q.LIST_RELATED_NAMES).all(contactId) as {
        name: string;
        label: string | null;
      }[]
    ).map(
      (r): ContactRelatedName => ({
        name: r.name,
        label: this.cleanLabel(r.label),
      }),
    );

    const dates = (
      this.db.query(Q.LIST_CONTACT_DATES).all(contactId) as {
        date: number;
        label: string | null;
      }[]
    ).map(
      (r): ContactDate => ({
        date: Q.macTimeToDate(r.date),
        label: this.cleanLabel(r.label),
      }),
    );

    return {
      ...contact,
      note: noteRow?.text ?? null,
      emails,
      phones,
      addresses,
      urls,
      socialProfiles,
      relatedNames,
      dates,
    };
  }

  searchContacts(query: string, options?: SearchContactsOptions): Contact[] {
    const pattern = `%${query}%`;
    const rows = this.db
      .query(Q.SEARCH_CONTACTS)
      .all(pattern, pattern, pattern, pattern, pattern) as ContactRow[];

    let results = rows.map((r) => this.rowToContact(r));

    if (options?.groupId != null) {
      const memberIds = new Set(
        (
          this.db
            .query(Q.LIST_CONTACTS_IN_GROUP)
            .all(options.groupId) as ContactRow[]
        ).map((r) => r.id),
      );
      results = results.filter((c) => memberIds.has(c.id));
    }

    const limit = options?.limit ?? 50;
    return results.slice(0, limit);
  }

  listGroups(options?: ListGroupsOptions): Group[] {
    const rows = this.db.query(Q.LIST_GROUPS).all() as GroupRow[];
    let results = rows.map(
      (r): Group => ({
        id: r.id,
        name: r.name ?? "Untitled Group",
        memberCount: this.groupMemberCounts.get(r.id) ?? 0,
      }),
    );

    if (options?.limit != null && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  getGroup(groupId: number): Group | null {
    const row = this.db.query(Q.GET_GROUP).get(groupId) as GroupRow | null;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name ?? "Untitled Group",
      memberCount: this.groupMemberCounts.get(row.id) ?? 0,
    };
  }

  getGroupMembers(groupId: number): Contact[] {
    const rows = this.db
      .query(Q.LIST_CONTACTS_IN_GROUP)
      .all(groupId) as ContactRow[];
    return rows.map((r) => this.rowToContact(r));
  }
}
