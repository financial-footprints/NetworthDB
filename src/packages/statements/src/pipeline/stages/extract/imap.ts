import type { Account, EmailSource } from "@ndb/core";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { raiseIfCancelled, StageError } from "@statements/engine/errors";
import { ParsedEmail } from "@statements/ingest/email/attachments";
import { buildImapSearchCriteria } from "@statements/ingest/email/imap-search";
import { withImapSessionLock } from "@statements/ingest/email/lock";
import { effectiveMailForAccount } from "@statements/ingest/email/matching";
import { sanitizeFilename } from "@statements/ingest/email/message";
import {
  IMAP_FETCH_MAX_ATTEMPTS,
  ReadOnlyImapClient,
} from "@statements/ingest/email/readonly-imap";
import { resolveAccountSearchDates, utcToday } from "@statements/period/account-dates";
import type { ExtractAccountResult } from "@statements/pipeline/stages/extract/types";
import {
  readLastFetchDate,
  writeLastFetchDate,
} from "@statements/pipeline/stages/metadata/last-fetch";
import { accountWorkspace, ensureDir } from "@statements/storage/vault/workspace";

async function uidFetchWithRetry(client: ReadOnlyImapClient, uid: string): Promise<Buffer | null> {
  let attempts = 0;
  while (attempts < IMAP_FETCH_MAX_ATTEMPTS) {
    attempts += 1;
    try {
      return await client.uidFetchBodyPeek(uid);
    } catch (error) {
      if (ReadOnlyImapClient.isConnectionLost(error) && attempts < IMAP_FETCH_MAX_ATTEMPTS) {
        await client.reconnect();
        continue;
      }
      throw error;
    }
  }
  return null;
}

async function imapSearchWithRetry(
  client: ReadOnlyImapClient,
  searchPlan: ReturnType<typeof buildImapSearchCriteria>
): Promise<string[]> {
  let attempts = 0;
  while (attempts < IMAP_FETCH_MAX_ATTEMPTS) {
    attempts += 1;
    try {
      return await client.search(searchPlan);
    } catch (error) {
      if (ReadOnlyImapClient.isConnectionLost(error) && attempts < IMAP_FETCH_MAX_ATTEMPTS) {
        await client.reconnect();
        continue;
      }
      throw error;
    }
  }
  return [];
}

async function extractAccount(
  client: ReadOnlyImapClient,
  config: StatementsEngineConfig,
  account: Account,
  source: EmailSource,
  folderLabel: string,
  dataKey: Buffer | null,
  shouldCancel?: () => boolean,
  trace?: (event: string, fields: Record<string, unknown>) => void
): Promise<ExtractAccountResult> {
  raiseIfCancelled(shouldCancel);

  const downloadDir = accountWorkspace(account.userId, account.accountType, account.id);
  ensureDir(downloadDir);

  const lastFetch = await readLastFetchDate(config, account.userId, dataKey, account);
  const { start: effectiveStart, end: searchEnd } = resolveAccountSearchDates(
    account.openingDate,
    account.closingDate,
    lastFetch
  );

  const mail = effectiveMailForAccount(account);
  const searchPlan = buildImapSearchCriteria(mail.subjects, effectiveStart, source.host, searchEnd);

  trace?.("imap search filters", {
    accountId: account.id,
    host: source.host,
    folder: source.folder || "INBOX",
    subjects: mail.subjects,
    searchCriteria: searchPlan.criteria,
  });

  const uids = await imapSearchWithRetry(client, searchPlan);
  await client.noop();

  let messagesMatched = 0;
  let attachmentsSaved = 0;
  let postFilterRejected = 0;
  let parseFailed = 0;
  const rejectReasonCounts: Record<string, number> = {};

  for (const [index, uid] of uids.entries()) {
    raiseIfCancelled(shouldCancel);
    const raw = await uidFetchWithRetry(client, uid);
    if (!raw) {
      continue;
    }
    const parsed = await ParsedEmail.parse(raw);
    if (!parsed) {
      parseFailed += 1;
      continue;
    }
    const rejectReason = parsed.rejectReason(account, effectiveStart, searchEnd);
    if (rejectReason) {
      postFilterRejected += 1;
      rejectReasonCounts[rejectReason] = (rejectReasonCounts[rejectReason] ?? 0) + 1;
      continue;
    }
    messagesMatched += 1;
    attachmentsSaved += await parsed.saveAttachments(downloadDir, folderLabel, account);

    if ((index + 1) % 10 === 0) {
      await client.noop();
    }
  }

  trace?.("imap search results", {
    accountId: account.id,
    searchUidCount: uids.length,
    messagesMatched,
    postFilterRejected,
    postFilterRejectReasons: rejectReasonCounts,
    parseFailed,
    attachmentsSaved,
  });

  if (messagesMatched > 0 || attachmentsSaved > 0) {
    writeLastFetchDate(config, account.userId, dataKey, account, utcToday());
  }

  return {
    bank: account.bank,
    downloadDir,
    messagesMatched,
    attachmentsSaved,
  };
}

export async function runImapExtract(input: {
  config: StatementsEngineConfig;
  accounts: Account[];
  source: EmailSource;
  dataKey?: Buffer | null;
  shouldCancel?: () => boolean;
  trace?: (event: string, fields: Record<string, unknown>) => void;
}): Promise<ExtractAccountResult[]> {
  const { config, accounts, source, shouldCancel, trace } = input;
  if (!source.host?.trim()) {
    throw new StageError("email source missing host");
  }
  if (!source.username?.trim()) {
    throw new StageError("email source missing username");
  }

  const folder = source.folder?.trim() || "INBOX";
  const folderLabel = sanitizeFilename(folder);

  return withImapSessionLock(source.host, source.username, async () => {
    const client = await ReadOnlyImapClient.connect(
      source.host,
      source.port ?? 993,
      source.username,
      source.password ?? "",
      source.useSsl,
      folder
    );

    await client.examine(folder);
    const results: ExtractAccountResult[] = [];

    for (const account of accounts) {
      raiseIfCancelled(shouldCancel);
      results.push(
        await extractAccount(
          client,
          config,
          account,
          source,
          folderLabel,
          input.dataKey ?? null,
          shouldCancel,
          trace
        )
      );
    }

    await client.close();
    await client.logout();
    return results;
  });
}
