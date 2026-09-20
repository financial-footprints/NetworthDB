import { StageError } from "@statements/engine/errors";
import {
  type ImapSearchPlan,
  prepareSearchCriteriaFromStrings,
} from "@statements/ingest/email/readonly-imap-search";
import { ImapFlow } from "imapflow";

export const IMAP_CONNECT_TIMEOUT_MS = 30_000;
export const IMAP_READ_TIMEOUT_MS = 300_000;
export const IMAP_FETCH_MAX_ATTEMPTS = 3;

const FORBIDDEN = [
  "STORE",
  "COPY",
  "APPEND",
  "EXPUNGE",
  "DELETE",
  "CREATE",
  "RENAME",
  "MOVE",
] as const;

export function normalizeMailboxName(mailbox: string): string {
  const trimmed = mailbox.trim();
  if (!trimmed || trimmed.toUpperCase() === "INBOX") {
    return "INBOX";
  }
  return trimmed;
}

function validateCommand(name: string): void {
  const upper = name.toUpperCase();
  for (const marker of FORBIDDEN) {
    if (upper.includes(marker)) {
      throw new StageError(`read-only IMAP client refused command: ${name}`);
    }
  }
}

export type ReadonlyImapConnectionConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  useSsl: boolean;
  folder: string;
};

export class ReadOnlyImapClient {
  private readonly commands: string[] = [];
  private readonly connection: ReadonlyImapConnectionConfig;
  private folder: string;
  private client: ImapFlow;

  private constructor(client: ImapFlow, connection: ReadonlyImapConnectionConfig) {
    this.client = client;
    this.connection = connection;
    this.folder = connection.folder;
  }

  static async connect(
    host: string,
    port: number,
    username: string,
    password: string,
    useSsl: boolean,
    folder: string
  ): Promise<ReadOnlyImapClient> {
    if (!useSsl) {
      throw new StageError("non-SSL IMAP is not supported");
    }

    const connection: ReadonlyImapConnectionConfig = {
      host,
      port,
      username,
      password,
      useSsl,
      folder: normalizeMailboxName(folder),
    };

    const client = new ImapFlow({
      host: connection.host,
      port: connection.port,
      secure: connection.useSsl,
      auth: { user: connection.username, pass: connection.password },
      logger: false,
      connectionTimeout: IMAP_CONNECT_TIMEOUT_MS,
      greetingTimeout: IMAP_CONNECT_TIMEOUT_MS,
      socketTimeout: IMAP_READ_TIMEOUT_MS,
    });

    await client.connect();
    return new ReadOnlyImapClient(client, connection);
  }

  static isConnectionLost(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("Connection Lost") ||
      message.includes("Connection not available") ||
      message.includes("ECONNRESET") ||
      message.includes("ETIMEDOUT") ||
      message.includes("EPIPE")
    );
  }

  private record(name: string): void {
    validateCommand(name);
    this.commands.push(name.toUpperCase());
  }

  async reconnect(): Promise<void> {
    try {
      await this.client.logout();
    } catch {
      // ignore logout errors on dead connections
    }
    this.commands.length = 0;
    this.client = new ImapFlow({
      host: this.connection.host,
      port: this.connection.port,
      secure: this.connection.useSsl,
      auth: { user: this.connection.username, pass: this.connection.password },
      logger: false,
      connectionTimeout: IMAP_CONNECT_TIMEOUT_MS,
      greetingTimeout: IMAP_CONNECT_TIMEOUT_MS,
      socketTimeout: IMAP_READ_TIMEOUT_MS,
    });
    await this.client.connect();
    await this.examine(this.folder);
  }

  async examine(mailbox: string): Promise<void> {
    this.record("EXAMINE");
    const normalized = normalizeMailboxName(mailbox);
    this.folder = normalized;
    try {
      await this.client.mailboxOpen(normalized, { readOnly: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new StageError(`could not open IMAP folder "${normalized}": ${message}`);
    }
  }

  async search(plan: ImapSearchPlan): Promise<string[]> {
    this.record("SEARCH");
    try {
      if (plan.gmailRaw) {
        const uids = await this.client.search({ gmailraw: plan.gmailRaw }, { uid: true });
        if (!uids) {
          return [];
        }
        return uids.map(String);
      }

      const query = prepareSearchCriteriaFromStrings(plan.criteria);
      const uids = await this.client.search(query, { uid: true });
      if (!uids) {
        return [];
      }
      return uids.map(String);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new StageError(`IMAP search failed: ${message}`);
    }
  }

  async uidFetchBodyPeek(uid: string): Promise<Buffer | null> {
    this.record("UID FETCH");
    const message = await this.client.fetchOne(uid, { source: true, uid: true }, { uid: true });
    if (message === false) {
      return null;
    }
    if (!message.source) {
      return null;
    }
    return Buffer.from(message.source);
  }

  async noop(): Promise<void> {
    this.record("NOOP");
    await this.client.noop();
  }

  async close(): Promise<void> {
    this.record("CLOSE");
    if (this.client.mailbox) {
      await this.client.mailboxClose();
    }
  }

  async logout(): Promise<void> {
    this.record("LOGOUT");
    await this.client.logout();
  }
}
