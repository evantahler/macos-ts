export type ErrorCategory =
  | "not_found"
  | "access_denied"
  | "invalid_input"
  | "internal";

export class MacOSError extends Error {
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly recovery: string;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      category?: ErrorCategory;
      retryable?: boolean;
      recovery?: string;
    },
  ) {
    super(message, options);
    this.name = "MacOSError";
    this.category = options?.category ?? "internal";
    this.retryable = options?.retryable ?? false;
    this.recovery = options?.recovery ?? "";
  }
}

export class DatabaseNotFoundError extends MacOSError {
  constructor(path: string) {
    super(`Database not found or inaccessible: ${path}`, {
      category: "not_found",
      recovery: `Ensure macOS Notes/Messages is set up on this Mac. Expected database at: ${path}`,
    });
    this.name = "DatabaseNotFoundError";
  }
}

export class DatabaseAccessDeniedError extends MacOSError {
  constructor(path: string) {
    const app = detectTerminalApp();
    const appHint = app ? ` to "${app}"` : " to your terminal app";
    super(
      `Access denied to database: ${path}\n` +
        `Grant Full Disk Access${appHint} in System Settings → Privacy & Security → Full Disk Access.`,
      {
        category: "access_denied",
        recovery: `Grant Full Disk Access${appHint} in System Settings > Privacy & Security > Full Disk Access, then restart the MCP server.`,
      },
    );
    this.name = "DatabaseAccessDeniedError";
  }

  openSettings(): void {
    openFullDiskAccessSettings();
  }
}

export function openFullDiskAccessSettings(): void {
  Bun.spawn([
    "open",
    "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
  ]);
}

function detectTerminalApp(): string | null {
  const bundleId = process.env.__CFBundleIdentifier;
  if (bundleId) {
    const known: Record<string, string> = {
      "com.apple.Terminal": "Terminal",
      "com.googlecode.iterm2": "iTerm2",
      "dev.warp.Warp-Stable": "Warp",
      "com.microsoft.VSCode": "Visual Studio Code",
      "com.todesktop.230313mzl4w4u92": "Cursor",
      "dev.zed.Zed": "Zed",
      "com.conductor.app": "Conductor",
    };
    if (known[bundleId]) return known[bundleId];
  }

  const termProgram = process.env.TERM_PROGRAM;
  if (termProgram) return termProgram;

  return null;
}
