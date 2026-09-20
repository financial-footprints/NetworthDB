import { describe, expect, test } from "bun:test";
import { Username } from "@ndb/core";
import { ACCOUNTS_JSON_NAME, API, backupAccountsFileSchema } from "@ndb/platform";
import { readApiData } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";
import { waitForJobInServices } from "@tests/api/helpers/wait-for-job";

const AAL2 = "aal2";
const ZIP_PASSWORD = "password1";

type BackupStatusData = {
  current: { filename: string; bytes: number; createdAt: string; expiresAt: string } | null;
  activeJobId: string | null;
  activeImportJobId: string | null;
};

describe("backup routes", () => {
  test("POST export without password returns 400", async () => {
    const { app } = await createTestApp({
      username: "backup_nopw",
      password: "password123",
    });
    const token = await loginViaApp(app, "backup_nopw", "password123");
    const exportResponse = await app.request(API.backup.export, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(exportResponse.status).toBe(400);
  });

  test("GET file returns 404 when no export exists", async () => {
    const { app } = await createTestApp({
      username: "backup_none",
      password: "password123",
    });
    const token = await loginViaApp(app, "backup_none", "password123");
    const downloadResponse = await app.request(API.backup.file, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(downloadResponse.status).toBe(404);
  });

  test("POST /api/v1/backup/export returns 202 and download returns zip", async () => {
    const { app, services } = await createTestApp({
      username: "backup_export",
      password: "password123",
    });
    const token = await loginViaApp(app, "backup_export", "password123");

    const exportResponse = await app.request(API.backup.export, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: ZIP_PASSWORD }),
    });
    expect(exportResponse.status).toBe(202);
    const created = await readApiData<{ jobId: string }>(exportResponse);
    const jobId = created.jobId;

    await waitForJobInServices(services, "backup_export", jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });

    const statusResponse = await app.request(API.backup.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(statusResponse.status).toBe(200);
    const status = await readApiData<BackupStatusData>(statusResponse);
    expect(status.current?.filename).toContain("networthdb-backup-");
    expect(status.activeJobId).toBeNull();
    expect(status.activeImportJobId).toBeNull();

    const downloadResponse = await app.request(API.backup.file, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("Content-Type")).toBe("application/zip");
    const bytes = new Uint8Array(await downloadResponse.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test("export with sensitiveBackups false redacts account secrets", async () => {
    const { app, services } = await createTestApp({
      username: "backup_redact",
      password: "password123",
    });
    const token = await loginViaApp(app, "backup_redact", "password123");

    const user = (
      await services.users.findByFilters({ username: Username.parse("backup_redact") })
    )[0];
    if (!user) {
      throw new Error("user missing");
    }

    await services.accountService.create(user, AAL2, {
      bank: "HDFC",
      accountType: "bank",
      openingDate: "2020-01-01",
      accountNumber: "9999888877",
      passwords: ["secret"],
    });

    const exportResponse = await app.request(API.backup.export, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: ZIP_PASSWORD }),
    });
    const created = await readApiData<{ jobId: string }>(exportResponse);
    await waitForJobInServices(services, "backup_redact", created.jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });

    const downloadResponse = await app.request(API.backup.file, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const zipBytes = new Uint8Array(await downloadResponse.arrayBuffer());
    const parsed = JSON.parse(new TextDecoder().decode(zipBytes)) as Record<string, string>;
    const accounts = backupAccountsFileSchema.parse(JSON.parse(parsed[ACCOUNTS_JSON_NAME] ?? "[]"));
    expect(accounts[0]?.has_passwords).toBe(true);
    expect("passwords" in (accounts[0] ?? {})).toBe(false);
  });

  test("GET backup reports active import job while restore runs", async () => {
    const { app, services } = await createTestApp({
      username: "backup_import_status",
      password: "password123",
    });
    const token = await loginViaApp(app, "backup_import_status", "password123");

    const exportResponse = await app.request(API.backup.export, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: ZIP_PASSWORD }),
    });
    const exportJob = await readApiData<{ jobId: string }>(exportResponse);
    await waitForJobInServices(services, "backup_import_status", exportJob.jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });

    const downloadResponse = await app.request(API.backup.file, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const zipBytes = await downloadResponse.arrayBuffer();

    const importResponse = await app.request(API.backup.import, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: createMultipartBody(new Blob([zipBytes]), "backup.zip"),
    });
    expect(importResponse.status).toBe(202);
    const importJob = await readApiData<{ jobId: string }>(importResponse);

    const user = (
      await services.users.findByFilters({ username: Username.parse("backup_import_status") })
    )[0];
    if (!user) {
      throw new Error("user missing");
    }

    const running = await services.jobService.get(user, AAL2, importJob.jobId);
    if (running.status === "queued" || running.status === "running") {
      const statusResponse = await app.request(API.backup.get, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(statusResponse.status).toBe(200);
      const status = await readApiData<BackupStatusData>(statusResponse);
      expect(status.activeImportJobId).toBe(importJob.jobId);
    }

    await waitForJobInServices(services, "backup_import_status", importJob.jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });

    const doneStatusResponse = await app.request(API.backup.get, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const doneStatus = await readApiData<BackupStatusData>(doneStatusResponse);
    expect(doneStatus.activeImportJobId).toBeNull();
  });

  test("importing the same export twice inserts no new transactions", async () => {
    const { app, services } = await createTestApp({
      username: "backup_twice",
      password: "password123",
    });
    const token = await loginViaApp(app, "backup_twice", "password123");

    const user = (
      await services.users.findByFilters({ username: Username.parse("backup_twice") })
    )[0];
    if (!user) {
      throw new Error("user missing");
    }

    await services.accountService.ensureSystemAccounts(user.id);
    const system = await services.accountService.listSystemAccounts(user, AAL2);
    const unknownId = system.find((row) => row.accountType === "unknown")?.id ?? "";
    const bank = await services.accountService.create(user, AAL2, {
      bank: "HDFC",
      accountType: "bank",
      openingDate: "2020-01-01",
      accountNumber: "5555666677",
      passwords: [],
    });
    await services.transactionService.create(user, AAL2, bank.id, {
      date: "2024-04-01",
      amount: 100,
      sourceAccountId: unknownId,
      destinationAccountId: bank.id,
      description: "Coffee shop",
    });

    const exportResponse = await app.request(API.backup.export, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: ZIP_PASSWORD }),
    });
    const exportJob = await readApiData<{ jobId: string }>(exportResponse);
    await waitForJobInServices(services, "backup_twice", exportJob.jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });

    const downloadResponse = await app.request(API.backup.file, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const zipBytes = await downloadResponse.arrayBuffer();

    const importOnce = await app.request(API.backup.import, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: createMultipartBody(new Blob([zipBytes]), "backup.zip"),
    });
    expect(importOnce.status).toBe(202);
    const firstImportJob = await readApiData<{ jobId: string }>(importOnce);
    const firstDone = await waitForJobInServices(services, "backup_twice", firstImportJob.jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });
    expect(firstDone.status).toBe("completed");

    const importTwice = await app.request(API.backup.import, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: createMultipartBody(new Blob([zipBytes]), "backup.zip"),
    });
    const secondImportJob = await readApiData<{ jobId: string }>(importTwice);
    const secondDone = await waitForJobInServices(services, "backup_twice", secondImportJob.jobId, {
      wantStatus: "completed",
      timeoutMs: 10_000,
    });
    expect(secondDone.status).toBe("completed");

    const secondJob = await services.jobService.get(user, AAL2, secondImportJob.jobId);
    expect(secondJob.output.backup?.transactionsInserted ?? 0).toBe(0);
  });
});

function createMultipartBody(file: Blob, filename: string): FormData {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("password", ZIP_PASSWORD);
  return form;
}
