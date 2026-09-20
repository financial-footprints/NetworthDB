import { CalloutSummary } from "@web/components/Badge/CalloutSummary";
import { PrimaryButton } from "@web/components/Button";
import { FileDropzone } from "@web/components/Fields/FileDropzone";
import { FormRow } from "@web/components/Fields/FormRow";
import { PasswordInput } from "@web/components/Fields/PasswordInput";
import { Hover } from "@web/components/Popover/Hover";
import { useAuth } from "@web/contexts/Auth/Context";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { Card } from "@web/contexts/Settings/components/Card";
import { usePollingWhileActive } from "@web/hooks/polling";
import { path } from "@web/router/path";
import { downloadBackupBlob, formatBackupImportMessage } from "@web/utils/accounts";
import { invalidateAllAccountCaches } from "@web/utils/api/routes/accounts";
import { fetchMe, withSessionToken } from "@web/utils/api/routes/auth";
import {
  type BackupExportStatus,
  downloadExportFile,
  fetchExportStatus,
  startExport,
  startImport,
} from "@web/utils/api/routes/backup";
import { fetchPublicConfig } from "@web/utils/api/routes/config";
import { fetchJob } from "@web/utils/api/routes/jobs";
import { clearDEK } from "@web/utils/crypto/session";
import { errorMessage } from "@web/utils/errors";
import {
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";

const ZIP_ACCEPT = ".zip,application/zip";
const STATUS_POLL_MS = 2_000;
const MIN_ZIP_PASSWORD = 8;

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function backupHelpSection(title: string, children: ReactNode) {
  return (
    <>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </>
  );
}

function BackupOverviewHelp() {
  return (
    <Hover ariaLabel="About backup and restore">
      {backupHelpSection(
        "Backup & restore",
        <>
          <p>
            Export a password-protected ZIP of your vault wraps, encrypted fields (still sealed),
            profile, accounts, taxonomy, rules, and ledger.
          </p>
          <p>
            Restore overwrites the vault and profile from the ZIP so a new account can decrypt those
            fields, and merges transactions.
          </p>
          <p>
            If this login password matches the backup vault password, unlock with it; otherwise use
            the old password or a recovery phrase, then rotate the password slot under Encryption.
          </p>
          <p>Passkeys from a deleted account will not unlock a new account.</p>
        </>
      )}
    </Hover>
  );
}

function SensitiveBackupsHelp() {
  return (
    <Hover ariaLabel="About sensitive fields in backups">
      {backupHelpSection(
        "Sensitive backups",
        <>
          <p>
            This server omits statement passwords and IMAP credentials from export archives while
            sensitive backups are disabled.
          </p>
          <p>
            Server operators can include those fields by enabling advanced-security bypass for local
            or debug deployments (
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-800">
              DISABLE_ADVANCED_SECURITY=true
            </code>
            ).
          </p>
        </>
      )}
    </Hover>
  );
}

function BackupJobBanner({ label, jobId }: { label: string; jobId: string }) {
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
      <p>{label}</p>
      <p className="mt-1">
        <Link className="font-medium text-sky-800 underline" to={path.jobs.details(jobId)}>
          View job progress
        </Link>
      </p>
    </div>
  );
}

function useSensitiveBackupsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    void fetchPublicConfig()
      .then((config) => {
        setEnabled(config.advancedSecurity.disabled);
      })
      .catch(() => {
        setEnabled(false);
      });
  }, []);
  return enabled;
}

function useBackupExportStatus(
  pushNotification: ReturnType<typeof useNotifications>["pushNotification"],
  setVaultLocked: ReturnType<typeof useAuth>["setVaultLocked"],
  setSelectedFile: (file: File | null) => void
) {
  const [status, setStatus] = useState<BackupExportStatus | null>(null);
  const importWatchJobIdRef = useRef<string | null>(null);

  const handleImportFinished = useCallback(
    async (jobId: string) => {
      try {
        const job = await fetchJob(jobId);
        if (job.status === "completed") {
          invalidateAllAccountCaches();
          await clearDEK();
          const me = await withSessionToken((sessionToken) => fetchMe(sessionToken));
          setVaultLocked(me);
          pushNotification(
            `${formatBackupImportMessage(job.output.backup)} Unlock with the backup vault password or recovery phrase.`,
            "success"
          );
          setSelectedFile(null);
          return;
        }
        if (job.status === "failed" || job.status === "cancelled") {
          pushNotification(job.error ?? "Backup restore failed.", "error");
        }
      } catch (error) {
        pushNotification(errorMessage(error, "Could not load restore job status"), "error");
      }
    },
    [pushNotification, setSelectedFile, setVaultLocked]
  );

  const refreshStatus = useCallback(async () => {
    const next = await fetchExportStatus();
    const watchId = importWatchJobIdRef.current;
    if (watchId && !next.activeImportJobId) {
      importWatchJobIdRef.current = null;
      await handleImportFinished(watchId);
    } else if (next.activeImportJobId) {
      importWatchJobIdRef.current = next.activeImportJobId;
    }
    setStatus(next);
  }, [handleImportFinished]);

  useEffect(() => {
    void refreshStatus().catch(() => {
      setStatus(null);
    });
  }, [refreshStatus]);

  const backupJobActive = Boolean(status?.activeJobId || status?.activeImportJobId);

  usePollingWhileActive({
    isActive: backupJobActive,
    intervalMs: STATUS_POLL_MS,
    poll: refreshStatus,
    failedEventId: "backup.status.poll.failed",
    path: "settings.backup",
  });

  return { status, refreshStatus, importWatchJobIdRef };
}

async function runBackupExport(
  backupPassword: string,
  refreshStatus: () => Promise<void>,
  pushNotification: ReturnType<typeof useNotifications>["pushNotification"]
): Promise<void> {
  if (backupPassword.trim().length < MIN_ZIP_PASSWORD) {
    pushNotification("ZIP password must be at least 8 characters.", "error");
    return;
  }
  try {
    await startExport(backupPassword.trim());
    await refreshStatus();
  } catch (error) {
    pushNotification(errorMessage(error, "Could not export account backup"), "error");
  }
}

async function runBackupDownload(
  status: BackupExportStatus | null,
  pushNotification: ReturnType<typeof useNotifications>["pushNotification"]
): Promise<void> {
  if (!status?.current) {
    return;
  }
  try {
    const blob = await downloadExportFile();
    downloadBackupBlob(blob, status.current.filename);
  } catch (error) {
    pushNotification(errorMessage(error, "Could not download backup"), "error");
  }
}

async function runBackupRestore(
  selectedFile: File | null,
  restorePassword: string,
  importWatchJobIdRef: MutableRefObject<string | null>,
  refreshStatus: () => Promise<void>,
  pushNotification: ReturnType<typeof useNotifications>["pushNotification"]
): Promise<void> {
  if (!selectedFile) {
    pushNotification("Choose a backup ZIP file first.", "error");
    return;
  }
  if (restorePassword.trim().length < MIN_ZIP_PASSWORD) {
    pushNotification("ZIP password must be at least 8 characters.", "error");
    return;
  }

  try {
    const { jobId } = await startImport(selectedFile, restorePassword.trim());
    importWatchJobIdRef.current = jobId;
    await refreshStatus();
    pushNotification(
      "Restore is running in the background. You can leave this page; unlock the vault when it finishes.",
      "info"
    );
  } catch (error) {
    importWatchJobIdRef.current = null;
    pushNotification(errorMessage(error, "Could not restore account backup"), "error");
  }
}

export function Backup() {
  const { pushNotification } = useNotifications();
  const { setVaultLocked } = useAuth();
  const backupPasswordId = useId();
  const restorePasswordId = useId();
  const restoreFileId = useId();

  const [backupPassword, setBackupPassword] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [exporting, setExporting] = useState(false);
  const [uploadingImport, setUploadingImport] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const sensitiveBackupsEnabled = useSensitiveBackupsEnabled();
  const { status, refreshStatus, importWatchJobIdRef } = useBackupExportStatus(
    pushNotification,
    setVaultLocked,
    setSelectedFile
  );

  async function handleExport() {
    setExporting(true);
    try {
      await runBackupExport(backupPassword, refreshStatus, pushNotification);
    } finally {
      setExporting(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await runBackupDownload(status, pushNotification);
    } finally {
      setDownloading(false);
    }
  }

  async function handleRestore() {
    setUploadingImport(true);
    try {
      await runBackupRestore(
        selectedFile,
        restorePassword,
        importWatchJobIdRef,
        refreshStatus,
        pushNotification
      );
    } finally {
      setUploadingImport(false);
    }
  }

  const exportInProgress = Boolean(status?.activeJobId) || exporting;
  const importInProgress = Boolean(status?.activeImportJobId) || uploadingImport;
  const backupBusy = exportInProgress || importInProgress;
  const current = status?.current;
  const activeExportJobId = status?.activeJobId ?? null;
  const activeImportJobId = status?.activeImportJobId ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Backup & Restore</h3>
          <BackupOverviewHelp />
        </div>
        <p className="text-sm text-slate-500">
          Export or restore a password-protected archive of your account.
        </p>
        {!sensitiveBackupsEnabled ? (
          <CalloutSummary variant="warning">
            <span className="inline-flex flex-wrap items-center gap-2">
              Sensitive fields are omitted from exports on this server.
              <SensitiveBackupsHelp />
            </span>
          </CalloutSummary>
        ) : null}
      </div>

      <Card
        title="Backup"
        description={
          <p>
            Create one downloadable ZIP per account. The file stays available for 7 days and can be
            downloaded repeatedly. Creating a new export keeps the previous file until the new ZIP
            is ready.
            {sensitiveBackupsEnabled
              ? " The file includes passwords, statement rules, and IMAP credentials."
              : " Passwords and IMAP credentials are omitted while sensitive backups are disabled."}{" "}
            Store backups securely.
          </p>
        }
      >
        {activeExportJobId ? (
          <BackupJobBanner
            jobId={activeExportJobId}
            label="Export is running in the background. The download below updates when the new ZIP is ready."
          />
        ) : null}
        {current ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p className="font-medium text-slate-900">{current.filename}</p>
            <p className="mt-1">
              {formatBytes(current.bytes)} · expires {current.expiresAt}
            </p>
            <div className="mt-3">
              <PrimaryButton onClick={() => void handleDownload()} disabled={downloading}>
                {downloading ? "Downloading…" : "Download"}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
        <FormRow
          label="Password"
          htmlFor={backupPasswordId}
          infoAriaLabel="About ZIP password"
          info={
            <p className="font-medium text-slate-800">
              Required. Protects the archive with AES-256. At least 8 characters. This is not your
              vault password.
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
        <PrimaryButton onClick={() => void handleExport()} disabled={backupBusy}>
          {exportInProgress ? "Export in progress…" : "Create Export"}
        </PrimaryButton>
      </Card>

      <Card
        title="Restore"
        description={
          <p>
            Upload a backup ZIP and its password. The vault and E2E fields from the archive replace
            the ones on this account. Transactions merge; ids you already own are skipped. Restore
            runs as a background job after the upload finishes.
          </p>
        }
      >
        {activeImportJobId ? (
          <BackupJobBanner
            jobId={activeImportJobId}
            label="Restore is running in the background. Unlock the vault when it completes."
          />
        ) : null}
        <FormRow label="Backup File" htmlFor={restoreFileId}>
          <FileDropzone
            id={restoreFileId}
            accept={ZIP_ACCEPT}
            value={selectedFile}
            onChange={setSelectedFile}
            onReject={(reason) => pushNotification(reason, "error")}
            disabled={backupBusy}
            emptyTitle="Drag and drop a ZIP file here"
          />
        </FormRow>
        <FormRow
          label="Password"
          htmlFor={restorePasswordId}
          infoAriaLabel="About ZIP password"
          info={
            <p className="font-medium text-slate-800">
              Required. Must match the password used when the archive was created.
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
        <PrimaryButton onClick={() => void handleRestore()} disabled={backupBusy || !selectedFile}>
          {importInProgress ? "Restore in progress…" : "Restore Backup"}
        </PrimaryButton>
      </Card>
    </div>
  );
}
