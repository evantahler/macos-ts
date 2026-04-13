export class AppleNotesError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AppleNotesError";
  }
}

export class NoteNotFoundError extends AppleNotesError {
  constructor(noteId: number) {
    super(`Note not found: ${noteId}`);
    this.name = "NoteNotFoundError";
  }
}

export class PasswordProtectedError extends AppleNotesError {
  constructor(noteId: number) {
    super(`Note is password protected and cannot be read: ${noteId}`);
    this.name = "PasswordProtectedError";
  }
}

export class DatabaseNotFoundError extends AppleNotesError {
  constructor(path: string) {
    super(`NoteStore database not found or inaccessible: ${path}`);
    this.name = "DatabaseNotFoundError";
  }
}
