import { MacOSError } from "../errors.ts";

export class ContactNotFoundError extends MacOSError {
  constructor(contactId: number) {
    super(`Contact not found: ${contactId}`, {
      category: "not_found",
      recovery:
        "Use list_contacts or search_contacts to find valid contact IDs.",
    });
    this.name = "ContactNotFoundError";
  }
}

export class GroupNotFoundError extends MacOSError {
  constructor(groupId: number) {
    super(`Group not found: ${groupId}`, {
      category: "not_found",
      recovery: "Use list_groups to find valid group IDs.",
    });
    this.name = "GroupNotFoundError";
  }
}
