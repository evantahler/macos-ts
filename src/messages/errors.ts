import { MacOSError } from "../errors.ts";

export class ChatNotFoundError extends MacOSError {
  constructor(chatId: number) {
    super(`Chat not found: ${chatId}`, {
      category: "not_found",
      recovery: "Use list_chats to find valid chat IDs.",
    });
    this.name = "ChatNotFoundError";
  }
}

export class MessageNotFoundError extends MacOSError {
  constructor(messageId: number) {
    super(`Message not found: ${messageId}`, {
      category: "not_found",
      recovery:
        "Use list_messages or search_messages to find valid message IDs.",
    });
    this.name = "MessageNotFoundError";
  }
}
