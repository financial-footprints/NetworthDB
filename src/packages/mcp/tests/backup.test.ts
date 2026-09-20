import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { SessionStore } from "@mcp/auth/session-store";
import { createBackupTools } from "@mcp/tools/backup";
import { API } from "@ndb/platform";
import { requireNamed } from "@tests/mcp/require-named";

const API_ORIGIN = "http://127.0.0.1:8000";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tokenPair() {
  return {
    sessionToken: "session-abc",
    refreshToken: "refresh-xyz",
    expiresIn: 3600,
  };
}

function mePayload() {
  return {
    id: "user-1",
    username: "usher",
    role: "user",
    multifactorEnabled: false,
  };
}

describe("createBackupTools", () => {
  test("backup_export returns job id", async () => {
    const handler = (url: string, init?: RequestInit) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.backup.export) && init?.method === "POST") {
        return jsonResponse(202, { data: { jobId: "job-export-1" } });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const store = new SessionStore({
      apiOrigin: API_ORIGIN,
      fetchImpl: async (url, init) => handler(url, init),
    });
    await store.login({ username: "usher", password: "admin" });
    const exportTool = requireNamed(createBackupTools(store), "backup_export");
    const result = await exportTool.handler({ password: "password1" });
    expect(result).toEqual({ jobId: "job-export-1" });
  });

  test("backup_status reads GET /backup without a job id", async () => {
    const handler = (url: string, init?: RequestInit) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.backup.get) && (init?.method === "GET" || init?.method === undefined)) {
        return jsonResponse(200, {
          data: {
            current: {
              filename: "networthdb-backup-2026-09-20.zip",
              bytes: 12,
              created_at: "2026-09-20T00:00:00.000Z",
              expires_at: "2026-09-27T00:00:00.000Z",
            },
            active_job_id: null,
            active_import_job_id: null,
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const store = new SessionStore({
      apiOrigin: API_ORIGIN,
      fetchImpl: async (url, init) => handler(url, init),
    });
    await store.login({ username: "usher", password: "admin" });
    const statusTool = requireNamed(createBackupTools(store), "backup_status");
    const result = await statusTool.handler({});
    expect(result).toEqual({
      current: {
        filename: "networthdb-backup-2026-09-20.zip",
        bytes: 12,
        created_at: "2026-09-20T00:00:00.000Z",
        expires_at: "2026-09-27T00:00:00.000Z",
      },
      active_job_id: null,
      active_import_job_id: null,
    });
  });

  test("backup_download writes GET /backup/file to dest_path", async () => {
    const destPath = `/tmp/ndb-mcp-backup-download-${crypto.randomUUID()}.zip`;
    const zipBytes = new Uint8Array([80, 75, 3, 4]);
    const handler = (url: string) => {
      if (url.endsWith(API.auth.session.login)) {
        return jsonResponse(200, { data: tokenPair() });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, { data: mePayload() });
      }
      if (url.endsWith(API.backup.file)) {
        return new Response(zipBytes, {
          status: 200,
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="networthdb-backup-2026-09-20.zip"',
          },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const store = new SessionStore({
      apiOrigin: API_ORIGIN,
      fetchImpl: async (url) => handler(url),
    });
    await store.login({ username: "usher", password: "admin" });
    const downloadTool = requireNamed(createBackupTools(store), "backup_download");
    try {
      const result = await downloadTool.handler({ dest_path: destPath });
      expect(result).toEqual({
        path: destPath,
        filename: "networthdb-backup-2026-09-20.zip",
        bytes: zipBytes.byteLength,
      });
    } finally {
      await rm(destPath, { force: true });
    }
  });
});
