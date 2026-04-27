import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_CONTAINER_PATH = join(
  homedir(),
  "Library/Group Containers/group.com.apple.notes",
);

export type ResolveResult =
  | { path: string }
  | { error: "not-found" | "permission-denied" };

export class AttachmentResolver {
  private containerPath: string;

  constructor(containerPath?: string) {
    this.containerPath = containerPath ?? DEFAULT_CONTAINER_PATH;
  }

  // Back-compat: returns the file URL or null. Callers that need to
  // distinguish "not found" from "permission denied" should use resolveDetailed.
  resolve(identifier: string): string | null {
    const result = this.resolveDetailed(identifier);
    return "path" in result ? `file://${result.path}` : null;
  }

  resolveDetailed(identifier: string): ResolveResult {
    let sawPermissionError = false;

    // Search in priority order: FallbackPDFs first (for scanned/Paper docs),
    // then Media (most common), then the full Accounts tree as fallback.
    const accountsPath = join(this.containerPath, "Accounts");
    if (existsSync(accountsPath)) {
      try {
        const accounts = readdirSync(accountsPath, { withFileTypes: true });
        for (const acct of accounts) {
          if (!acct.isDirectory()) continue;
          const acctPath = join(accountsPath, acct.name);
          for (const sub of ["FallbackPDFs", "Media"]) {
            const subPath = join(acctPath, sub);
            if (!existsSync(subPath)) continue;
            const found = this.findFile(subPath, identifier);
            if (found.path) return { path: found.path };
            if (found.permissionDenied) sawPermissionError = true;
          }
        }
      } catch (err) {
        if (isPermissionError(err)) sawPermissionError = true;
      }
    }

    // Fallback: search top-level FallbackPDFs, Media, and full Accounts tree
    for (const sub of ["FallbackPDFs", "Media", "Accounts"]) {
      const basePath = join(this.containerPath, sub);
      if (!existsSync(basePath)) continue;
      const found = this.findFile(basePath, identifier);
      if (found.path) return { path: found.path };
      if (found.permissionDenied) sawPermissionError = true;
    }

    return { error: sawPermissionError ? "permission-denied" : "not-found" };
  }

  private findFirstFile(
    dir: string,
    depth = 0,
  ): { path: string | null; permissionDenied: boolean } {
    if (depth > 2) return { path: null, permissionDenied: false };
    let permissionDenied = false;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      // Prefer files at current level
      const file = entries.find((e) => e.isFile());
      if (file) return { path: join(dir, file.name), permissionDenied: false };
      // Otherwise recurse into subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const found = this.findFirstFile(join(dir, entry.name), depth + 1);
          if (found.path) return found;
          if (found.permissionDenied) permissionDenied = true;
        }
      }
    } catch (err) {
      if (isPermissionError(err)) permissionDenied = true;
    }
    return { path: null, permissionDenied };
  }

  private findFile(
    dir: string,
    identifier: string,
    depth = 0,
  ): { path: string | null; permissionDenied: boolean } {
    const MAX_DEPTH = 4;
    if (depth > MAX_DEPTH) return { path: null, permissionDenied: false };
    let permissionDenied = false;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip macOS bundles — they contain internal databases, not user files
          if (entry.name.endsWith(".bundle")) continue;

          if (entry.name === identifier) {
            // Found the UUID directory — find the first file in it (may be nested)
            const file = this.findFirstFile(fullPath);
            if (file.path) return file;
            if (file.permissionDenied) permissionDenied = true;
          }
          // Recurse deeper (e.g. Accounts/<acct>/Media/<uuid>/file)
          const found = this.findFile(fullPath, identifier, depth + 1);
          if (found.path) return found;
          if (found.permissionDenied) permissionDenied = true;
        }
      }
    } catch (err) {
      if (isPermissionError(err)) permissionDenied = true;
    }
    return { path: null, permissionDenied };
  }
}

function isPermissionError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  return code === "EACCES" || code === "EPERM";
}
