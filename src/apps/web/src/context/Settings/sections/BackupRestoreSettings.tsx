import { PrimaryButton } from "@web/components/button";
import { FileDropzone } from "@web/components/fields/FileDropzone";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { useNotifications } from "@web/context/Notifications/NotificationContext";
import { ProfileSectionCard } from "@web/context/Settings/components/ProfileSectionCard";
import {
  type BackupImportSummary,
  backupEntryToWritePayload,
  buildBackupFiles,
  downloadBackupBlob,
  findExistingAccountId,
  parseBackupAccountsJson,
  parseBackupSourcesJson,
  sourcesToWritePayload,
} from "@web/utils/accounts/backup";
import {
  createAccount,
  invalidateAllAccountCaches,
  readAccounts,
  updateAccount,
} from "@web/utils/api/endpoints/accounts";
import { isSensitiveBackupsEnabled, readPublicConfig } from "@web/utils/api/endpoints/config";
import { getSources, updateSources } from "@web/utils/api/endpoints/sources";
import { errorMessage } from "@web/utils/errors";
import { Zip } from "@web/utils/zip";
import { useEffect, useId, useState } from "react";

const ZIP_ACCEPT = ".zip,application/zip";

export function BackupRestoreSettings() {
  const { pushNotification } = useNotifications();
  const backupPasswordId = useId();
  const restorePasswordId = useId();
  const restoreFileId = useId();

  const [backupPassword, setBackupPassword] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sensitiveBackupsEnabled, setSensitiveBackupsEnabled] = useState(() =>
    isSensitiveBackupsEnabled()
  );

  useEffect(() => {
    void readPublicConfig()
      .then((config) => {
        setSensitiveBackupsEnabled(config.advanced_security.disabled);
      })
      .catch(() => {
        setSensitiveBackupsEnabled(false);
      });
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      await readPublicConfig();
      const [creditCards, bankAccounts, sources] = await Promise.all([
        readAccounts("credit_card"),
        readAccounts("bank_account"),
        getSources(),
      ]);
      const accounts = [...creditCards.accounts, ...bankAccounts.accounts];
      const files = buildBackupFiles(accounts, sources.sources);
      const zipBytes = await Zip.create(files, {
        password: backupPassword.trim() || undefined,
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadBackupBlob(
        new Blob([zipBytes.slice()], { type: "application/zip" }),
        `export-${date}.zip`
      );
      pushNotification("Account backup downloaded.", "success");
    } catch (error) {
      pushNotification(errorMessage(error, "Could not export account backup"), "error");
    } finally {
      setExporting(false);
    }
  }

  async function importBackupEntries(
    entries: ReturnType<typeof parseBackupAccountsJson>,
    existingAccounts: Awaited<ReturnType<typeof readAccounts>>["accounts"]
  ): Promise<BackupImportSummary> {
    const usedIds = new Set<string>();
    const summary: BackupImportSummary = { created: 0, updated: 0, errors: [] };

    for (const entry of entries) {
      try {
        const existingId = findExistingAccountId(entry, existingAccounts, usedIds);
        const payload = backupEntryToWritePayload(entry);
        if (existingId) {
          await updateAccount(existingId, payload);
          summary.updated += 1;
        } else {
          await createAccount(payload);
          summary.created += 1;
        }
      } catch (error) {
        const label = `${entry.bank}${entry.variant ? ` ${entry.variant}` : ""}`;
        summary.errors.push(`${label}: ${errorMessage(error, "import failed")}`);
      }
    }

    return summary;
  }

  async function handleRestore() {
    if (!selectedFile) {
      pushNotification("Choose a backup ZIP file first.", "error");
      return;
    }

    setImporting(true);
    try {
      const files = await Zip.open(selectedFile, {
        password: restorePassword.trim() || undefined,
      });
      const accountsJson = files["accounts.json"];
      if (!accountsJson) {
        throw new Error("accounts.json is missing from the backup archive.");
      }

      const entries = parseBackupAccountsJson(accountsJson);
      const sourceEntries = parseBackupSourcesJson(files["sources.json"]);
      const [creditCards, bankAccounts] = await Promise.all([
        readAccounts("credit_card"),
        readAccounts("bank_account"),
      ]);
      const existingAccounts = [...creditCards.accounts, ...bankAccounts.accounts];
      const summary = await importBackupEntries(entries, existingAccounts);

      if (sourceEntries.length > 0) {
        await updateSources({ sources: sourcesToWritePayload(sourceEntries) });
      }

      invalidateAllAccountCaches();
      pushNotification(
        `Restored ${summary.created + summary.updated} account(s): ${summary.created} created, ${summary.updated} updated.`,
        "success"
      );
      if (summary.errors.length > 0) {
        pushNotification(summary.errors.join(" "), "error");
      }
      setSelectedFile(null);
    } catch (error) {
      pushNotification(errorMessage(error, "Could not restore account backup"), "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Backup & Restore</h3>
        <p className="mt-1 text-sm text-slate-600">
          Export and import your account configuration and statement sources as a ZIP file
          containing accounts.json and sources.json.
        </p>
        {!sensitiveBackupsEnabled ? (
          <p className="mt-2 text-sm text-amber-700">
            Sensitive backups are disabled on the server. Exports omit statement passwords and IMAP
            credentials until <code>DISABLE_ADVANCED_SECURITY=true</code>.
          </p>
        ) : null}
      </div>

      <ProfileSectionCard
        title="Backup"
        description={
          <p>
            Download a ZIP backup of your accounts and statement sources.
            {sensitiveBackupsEnabled
              ? " The file includes passwords, statement rules, and IMAP credentials."
              : " Passwords and IMAP credentials are omitted while sensitive backups are disabled."}{" "}
            Store backups securely.
          </p>
        }
      >
        <FormRow
          label="Password"
          htmlFor={backupPasswordId}
          infoAriaLabel="About ZIP password"
          info={
            <p className="font-medium text-slate-800">
              Optional. Leave blank for an unencrypted archive.
            </p>
          }
        >
          <PasswordInput
            id={backupPasswordId}
            value={backupPassword}
            onChange={(event) => setBackupPassword(event.target.value)}
            autoComplete="new-password"
            revealLabel="Password"
          />
        </FormRow>
        <PrimaryButton onClick={() => void handleExport()} disabled={exporting}>
          {exporting ? "Preparing backup…" : "Download Backup"}
        </PrimaryButton>
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Restore"
        description={
          <p>
            Upload a backup ZIP to restore account metadata and statement sources. Existing accounts
            are matched by id, account number, or bank metadata and updated when found.
          </p>
        }
      >
        <FormRow label="Backup File" htmlFor={restoreFileId}>
          <FileDropzone
            id={restoreFileId}
            accept={ZIP_ACCEPT}
            value={selectedFile}
            onChange={setSelectedFile}
            onReject={(reason) => pushNotification(reason, "error")}
            disabled={importing}
            emptyTitle="Drag and drop a ZIP file here"
          />
        </FormRow>
        <FormRow
          label="Password"
          htmlFor={restorePasswordId}
          infoAriaLabel="About ZIP password"
          info={
            <p className="font-medium text-slate-800">
              Required when the backup archive is password protected.
            </p>
          }
        >
          <PasswordInput
            id={restorePasswordId}
            value={restorePassword}
            onChange={(event) => setRestorePassword(event.target.value)}
            autoComplete="current-password"
            revealLabel="Password"
          />
        </FormRow>
        <PrimaryButton onClick={() => void handleRestore()} disabled={importing || !selectedFile}>
          {importing ? "Restoring…" : "Restore Backup"}
        </PrimaryButton>
      </ProfileSectionCard>
    </div>
  );
}
