import { existsSync, statSync } from "node:fs";
import type { Account, ThunderbirdSource } from "@ndb/core";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { raiseIfCancelled, StageError } from "@statements/engine/errors";
import { discoverMboxFiles, iterMboxMessages } from "@statements/ingest/email/mbox";
import { sanitizeFilename } from "@statements/ingest/email/message";
import { resolveAccountSearchDates, utcToday } from "@statements/period/account-dates";
import type { ExtractAccountResult } from "@statements/pipeline/stages/extract/types";
import {
  readLastFetchDate,
  writeLastFetchDate,
} from "@statements/pipeline/stages/metadata/last-fetch";
import { accountWorkspace, ensureDir } from "@statements/storage/vault/workspace";

async function processMbox(
  mboxPath: string,
  account: Account,
  downloadDir: string,
  folderPrefix: string,
  startDate: Date | null,
  endDate: Date | null
): Promise<{ messagesMatched: number; attachmentsSaved: number }> {
  let messagesMatched = 0;
  let attachmentsSaved = 0;
  for (const parsed of await iterMboxMessages(mboxPath)) {
    if (!parsed.matchesAccount(account, startDate, endDate)) {
      continue;
    }
    messagesMatched += 1;
    attachmentsSaved += await parsed.saveAttachments(downloadDir, folderPrefix, account);
  }
  return { messagesMatched, attachmentsSaved };
}

export async function runThunderbirdAccount(input: {
  config: StatementsEngineConfig;
  account: Account;
  source: ThunderbirdSource;
  dataKey?: Buffer | null;
  shouldCancel?: () => boolean;
}): Promise<ExtractAccountResult> {
  raiseIfCancelled(input.shouldCancel);

  const profile = input.source.profile?.trim();
  if (!profile) {
    throw new StageError("thunderbird source missing profile config");
  }
  if (!existsSync(profile) || !statSync(profile).isDirectory()) {
    throw new StageError(`profile directory not found: ${profile}`);
  }

  const downloadDir = accountWorkspace(
    input.account.userId,
    input.account.accountType,
    input.account.id
  );
  ensureDir(downloadDir);

  const lastFetch = await readLastFetchDate(
    input.config,
    input.account.userId,
    input.dataKey ?? null,
    input.account
  );
  const { start: effectiveStart, end: effectiveEnd } = resolveAccountSearchDates(
    input.account.openingDate,
    input.account.closingDate,
    lastFetch
  );

  const mboxFiles = discoverMboxFiles(profile);
  if (mboxFiles.length === 0) {
    throw new StageError("no mbox stores found");
  }

  let totalMessages = 0;
  let attachmentsSaved = 0;
  for (const mboxPath of mboxFiles) {
    raiseIfCancelled(input.shouldCancel);
    const folderLabel = sanitizeFilename(mboxPath.split(/[/\\]/).pop() ?? "mbox");
    const result = await processMbox(
      mboxPath,
      input.account,
      downloadDir,
      folderLabel,
      effectiveStart,
      effectiveEnd
    );
    totalMessages += result.messagesMatched;
    attachmentsSaved += result.attachmentsSaved;
  }

  if (totalMessages > 0 || attachmentsSaved > 0) {
    writeLastFetchDate(
      input.config,
      input.account.userId,
      input.dataKey ?? null,
      input.account,
      utcToday()
    );
  }

  return {
    bank: input.account.bank,
    downloadDir,
    messagesMatched: totalMessages,
    attachmentsSaved,
  };
}
