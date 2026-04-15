#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MacOSError } from "./errors.ts";
import { Messages, type MessagesOptions } from "./messages/index.ts";
import { Notes, type NotesOptions } from "./notes/index.ts";

// ============================================================================
// Response helpers
// ============================================================================

interface NextAction {
  tool: string;
  description: string;
}

const readOnlyAnnotations = {
  readOnlyHint: true as const,
  destructiveHint: false as const,
  idempotentHint: true as const,
  openWorldHint: false as const,
};

function toolError(e: MacOSError) {
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          error: e.name,
          message: e.message,
          category: e.category,
          retryable: e.retryable,
          recovery: e.recovery,
        }),
      },
    ],
  };
}

function wrapTool<T>(fn: () => T, hints?: NextAction[]) {
  try {
    const data = fn();
    const result: Record<string, unknown> = { data };
    if (Array.isArray(data)) result.totalResults = data.length;
    if (hints?.length) result._next = hints;
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  } catch (e) {
    if (e instanceof MacOSError) return toolError(e);
    throw e;
  }
}

// ============================================================================
// Server
// ============================================================================

export interface ServerOptions {
  notes?: NotesOptions;
  messages?: MessagesOptions;
}

export function createServer(options?: ServerOptions) {
  const notes = new Notes(options?.notes);
  const messages = new Messages(options?.messages);

  const server = new McpServer({
    name: "macos",
    version: "0.7.0",
  });

  // ==========================================================================
  // Discovery tool
  // ==========================================================================

  server.registerTool(
    "get_capabilities",
    {
      title: "Get server capabilities",
      description:
        "Discover available data sources and their tools. Call this first to understand what macOS data this server can access and which tool to start with.",
      annotations: readOnlyAnnotations,
    },
    async () =>
      wrapTool(() => ({
        dataSources: [
          {
            name: "Apple Notes",
            description: "Read-only access to Apple Notes on this Mac",
            tools: [
              "list_accounts",
              "list_folders",
              "list_notes",
              "search_notes",
              "read_note",
              "list_attachments",
              "get_attachment_url",
            ],
            startWith: "list_accounts or list_notes",
          },
          {
            name: "iMessage / SMS",
            description:
              "Read-only access to iMessage and SMS conversations on this Mac",
            tools: [
              "list_chats",
              "get_chat",
              "list_messages",
              "get_message",
              "search_messages",
              "list_message_attachments",
              "list_handles",
            ],
            startWith: "list_chats or search_messages",
          },
        ],
        allToolsReadOnly: true,
        requirement: "Full Disk Access permission for the terminal app",
      })),
  );

  // ==========================================================================
  // Notes tools
  // ==========================================================================

  server.registerTool(
    "list_accounts",
    {
      title: "List Notes accounts",
      description:
        "List all Apple Notes accounts on this Mac (e.g. iCloud, On My Mac). Returns account IDs and names. Use these to filter list_folders or list_notes.",
      annotations: readOnlyAnnotations,
    },
    async () =>
      wrapTool(
        () => notes.accounts(),
        [
          { tool: "list_folders", description: "List folders for an account" },
          { tool: "list_notes", description: "List notes in an account" },
        ],
      ),
  );

  server.registerTool(
    "list_folders",
    {
      title: "List Notes folders",
      description:
        "List Apple Notes folders with note counts. Optionally filter by account (from list_accounts). Use folder names/IDs to filter list_notes.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        account: z
          .string()
          .optional()
          .describe(
            "Account name (e.g. 'iCloud') or numeric account ID to filter by.",
          ),
      },
    },
    async ({ account }) =>
      wrapTool(
        () => notes.folders(account),
        [{ tool: "list_notes", description: "List notes in a folder" }],
      ),
  );

  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description:
        "List notes with filtering, sorting, and limiting. Returns metadata only (title, snippet, dates). Use list_folders or list_accounts for filter values. Follow-up: use read_note with a noteId to get full markdown content.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        folder: z
          .string()
          .optional()
          .describe(
            "Folder name (e.g. 'Work') or numeric folder ID to filter by.",
          ),
        account: z
          .string()
          .optional()
          .describe(
            "Account name (e.g. 'iCloud') or numeric account ID to filter by.",
          ),
        search: z
          .string()
          .optional()
          .describe(
            "Text to filter notes by, matched case-insensitively against title and snippet.",
          ),
        sortBy: z
          .enum(["title", "createdAt", "modifiedAt"])
          .optional()
          .describe("Field to sort results by. Defaults to 'modifiedAt'."),
        order: z
          .enum(["asc", "desc"])
          .optional()
          .describe(
            "Sort direction. Defaults to 'desc' (newest first for date sorts, Z-A for title).",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("Maximum number of notes to return."),
      },
    },
    async ({ folder, account, search, sortBy, order, limit }) =>
      wrapTool(
        () => notes.notes({ folder, account, search, sortBy, order, limit }),
        [
          {
            tool: "read_note",
            description: "Read a note's full markdown content",
          },
        ],
      ),
  );

  server.registerTool(
    "search_notes",
    {
      title: "Search notes",
      description:
        "Search Apple Notes by text matching against titles and snippets. Returns metadata for matches. Follow-up: use read_note with a noteId for full content. Tip: use list_notes for browsing without a search term.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        query: z
          .string()
          .describe("Text to search for in note titles and snippets."),
        folder: z
          .string()
          .optional()
          .describe(
            "Folder name or numeric folder ID to restrict the search to.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Maximum number of results to return. Defaults to 50."),
      },
    },
    async ({ query, folder, limit }) =>
      wrapTool(
        () => notes.search(query, { folder, limit }),
        [{ tool: "read_note", description: "Read a matching note" }],
      ),
  );

  server.registerTool(
    "read_note",
    {
      title: "Read note content",
      description:
        "Read the full content of an Apple Note as markdown. Requires a noteId from list_notes or search_notes. Supports pagination via offset/limit for large notes. Follow-up: use list_attachments to see attached files.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        noteId: z
          .number()
          .int()
          .describe(
            "Numeric note ID (from list_notes or search_notes results).",
          ),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Line number to start reading from (0-based). Omit to start from the beginning.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "Maximum number of lines to return. Omit to return the entire note. When set, response includes totalLines and hasMore fields.",
          ),
      },
    },
    async ({ noteId, offset, limit }) =>
      wrapTool(() => {
        if (offset !== undefined || limit !== undefined) {
          return notes.read(noteId, { offset, limit });
        }
        return notes.read(noteId);
      }, [
        {
          tool: "list_attachments",
          description: "See attachments for this note",
        },
      ]),
  );

  server.registerTool(
    "list_attachments",
    {
      title: "List note attachments",
      description:
        "List all attachments for a note. Requires a noteId from list_notes or search_notes. Follow-up: use get_attachment_url with a filename to get the local file path.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        noteId: z
          .number()
          .int()
          .describe("Numeric note ID to get attachments for."),
      },
    },
    async ({ noteId }) =>
      wrapTool(
        () => notes.listAttachments(noteId),
        [
          {
            tool: "get_attachment_url",
            description: "Get file path for an attachment",
          },
        ],
      ),
  );

  server.registerTool(
    "get_attachment_url",
    {
      title: "Get attachment URL",
      description:
        "Resolve a local file:// URL for a note attachment by filename (from list_attachments). Returns null if file not found on disk.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        name: z
          .string()
          .describe("Attachment filename (from list_attachments results)."),
      },
    },
    async ({ name }) => wrapTool(() => ({ url: notes.getAttachmentUrl(name) })),
  );

  // ==========================================================================
  // Messages tools
  // ==========================================================================

  server.registerTool(
    "list_handles",
    {
      title: "List message handles",
      description:
        "List all known contact handles (phone numbers, email addresses) from iMessage/SMS. Returns identifier (phone/email), service type (iMessage/SMS), and numeric ID. Useful for identifying senders in message results.",
      annotations: readOnlyAnnotations,
    },
    async () =>
      wrapTool(
        () => messages.handles(),
        [
          {
            tool: "list_chats",
            description: "Find conversations with a contact",
          },
        ],
      ),
  );

  server.registerTool(
    "list_chats",
    {
      title: "List conversations",
      description:
        "List iMessage/SMS conversations with display names, participants, service type, and last message date. Supports search by name or phone number. Follow-up: use list_messages with a chatId to read the conversation.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe(
            "Text to filter chats by, matched against display name, chat identifier, and participant handles.",
          ),
        sortBy: z
          .enum(["lastMessageDate", "displayName"])
          .optional()
          .describe("Field to sort results by. Defaults to 'lastMessageDate'."),
        order: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Sort direction. Defaults to 'desc' (newest first)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("Maximum number of chats to return."),
      },
    },
    async ({ search, sortBy, order, limit }) =>
      wrapTool(
        () => messages.chats({ search, sortBy, order, limit }),
        [
          {
            tool: "list_messages",
            description: "Read messages in a conversation",
          },
        ],
      ),
  );

  server.registerTool(
    "get_chat",
    {
      title: "Get conversation details",
      description:
        "Get details for a specific conversation. Requires a chatId from list_chats. Returns participants and metadata. Follow-up: use list_messages to read messages.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        chatId: z
          .number()
          .int()
          .describe("Numeric chat ID (from list_chats results)."),
      },
    },
    async ({ chatId }) =>
      wrapTool(
        () => messages.getChat(chatId),
        [
          {
            tool: "list_messages",
            description: "Read messages in this conversation",
          },
        ],
      ),
  );

  server.registerTool(
    "list_messages",
    {
      title: "List messages",
      description:
        "List messages in a conversation. Requires a chatId from list_chats. Supports date filtering (ISO 8601), direction filtering (fromMe), and limiting. Follow-up: use get_message for details or list_message_attachments for media.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        chatId: z
          .number()
          .int()
          .describe("Numeric chat ID to get messages for."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe(
            "Maximum number of messages to return. Defaults to all messages.",
          ),
        beforeDate: z
          .string()
          .optional()
          .describe(
            "ISO 8601 date string. Only return messages before this date.",
          ),
        afterDate: z
          .string()
          .optional()
          .describe(
            "ISO 8601 date string. Only return messages after this date.",
          ),
        fromMe: z
          .boolean()
          .optional()
          .describe(
            "Filter to only sent (true) or only received (false) messages.",
          ),
        order: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Sort direction. Defaults to 'desc' (newest first)."),
      },
    },
    async ({ chatId, limit, beforeDate, afterDate, fromMe, order }) =>
      wrapTool(
        () =>
          messages.messages(chatId, {
            limit,
            beforeDate: beforeDate ? new Date(beforeDate) : undefined,
            afterDate: afterDate ? new Date(afterDate) : undefined,
            fromMe,
            order,
          }),
        [
          { tool: "get_message", description: "Get full message details" },
          {
            tool: "list_message_attachments",
            description: "Get attachments for a message",
          },
        ],
      ),
  );

  server.registerTool(
    "get_message",
    {
      title: "Get message",
      description:
        "Get a single message by ID (from list_messages or search_messages). Returns full text, sender, date, and metadata. Follow-up: use list_message_attachments for attached media.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        messageId: z
          .number()
          .int()
          .describe(
            "Numeric message ID (from list_messages or search_messages results).",
          ),
      },
    },
    async ({ messageId }) =>
      wrapTool(
        () => messages.getMessage(messageId),
        [
          {
            tool: "list_message_attachments",
            description: "Get attachments for this message",
          },
        ],
      ),
  );

  server.registerTool(
    "search_messages",
    {
      title: "Search messages",
      description:
        "Search message text across all conversations or within a specific chat (chatId from list_chats). Follow-up: use get_message or list_message_attachments with a messageId.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        query: z.string().describe("Text to search for in message content."),
        chatId: z
          .number()
          .int()
          .optional()
          .describe("Numeric chat ID to restrict the search to."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Maximum number of results to return. Defaults to 50."),
      },
    },
    async ({ query, chatId, limit }) =>
      wrapTool(
        () => messages.search(query, { chatId, limit }),
        [{ tool: "get_message", description: "Get full message details" }],
      ),
  );

  server.registerTool(
    "list_message_attachments",
    {
      title: "List message attachments",
      description:
        "List attachments for a message. Requires a messageId from list_messages or search_messages. Returns filename, MIME type, and file size.",
      annotations: readOnlyAnnotations,
      inputSchema: {
        messageId: z
          .number()
          .int()
          .describe("Numeric message ID to get attachments for."),
      },
    },
    async ({ messageId }) => wrapTool(() => messages.attachments(messageId)),
  );

  return { server, notes, messages };
}

if (import.meta.main) {
  const { server, notes, messages } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("beforeExit", () => {
    notes.close();
    messages.close();
  });
}
