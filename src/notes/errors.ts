import { MacOSError } from "../errors.ts";

export class NoteNotFoundError extends MacOSError {
  constructor(noteId: number) {
    super(`Note not found: ${noteId}`, {
      category: "not_found",
      recovery: "Use list_notes or search_notes to find valid note IDs.",
    });
    this.name = "NoteNotFoundError";
  }
}

export class PasswordProtectedError extends MacOSError {
  constructor(noteId: number) {
    super(`Note is password protected and cannot be read: ${noteId}`, {
      category: "access_denied",
      recovery:
        "This note is password-protected and cannot be read via the database.",
    });
    this.name = "PasswordProtectedError";
  }
}
