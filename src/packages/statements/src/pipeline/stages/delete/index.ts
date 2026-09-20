import type { PipelineRun } from "@ndb/core";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { openVaultStore } from "@statements/config/runtime";
import { raiseIfCancelled } from "@statements/engine/errors";
import type { DeleteAccountResult } from "@statements/pipeline/stages/cleanup/models";
import { accountMetadataRelative } from "@statements/storage/vault/path";
import { accountWorkspace, clearDir } from "@statements/storage/vault/workspace";

function collectAccountOutputRelatives(
  store: { list(prefix?: string): string[] },
  accountType: string,
  accountId: string
): string[] {
  const segment = `/${accountType}/${accountId}/`;
  const metadataRelative = accountMetadataRelative(accountType, accountId);
  return store.list().filter((key) => key.includes(segment) || key === metadataRelative);
}

export async function runDelete(
  pipeline: PipelineRun,
  config: StatementsEngineConfig,
  shouldCancel?: () => boolean
): Promise<DeleteAccountResult> {
  raiseIfCancelled(shouldCancel);

  const store = openVaultStore(config, pipeline.userId, pipeline.dataKey);
  const account = pipeline.account;
  const workspaceDir = accountWorkspace(pipeline.userId, account.accountType, account.id);
  const relatives = collectAccountOutputRelatives(store, account.accountType, account.id);

  let filesRemoved = 0;
  for (const relative of relatives) {
    try {
      store.unlink(relative);
      filesRemoved += 1;
    } catch {
      // ignore missing files
    }
  }

  clearDir(workspaceDir);

  return {
    bank: account.bank,
    downloadDir: workspaceDir,
    filesRemoved,
    dirsRemoved: 0,
  };
}
