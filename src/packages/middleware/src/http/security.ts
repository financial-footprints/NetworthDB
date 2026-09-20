import { createMiddleware } from "hono/factory";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const MULTIPART_MAX_BODY_BYTES = 32 * 1024 * 1024;
const BACKUP_IMPORT_PATH = "/api/v1/backup/import";

type SecurityOptions = {
  backupMaxUploadBytes?: number;
};

function maxBodyBytes(
  contentType: string | undefined,
  path: string,
  backupMaxUploadBytes: number
): number {
  if (path === BACKUP_IMPORT_PATH && contentType?.includes("multipart/form-data")) {
    return backupMaxUploadBytes;
  }
  if (contentType?.includes("multipart/form-data")) {
    return MULTIPART_MAX_BODY_BYTES;
  }
  return DEFAULT_MAX_BODY_BYTES;
}

export function security(options: SecurityOptions = {}) {
  const backupMaxUploadBytes = options.backupMaxUploadBytes ?? 512 * 1024 * 1024;

  return createMiddleware(async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");

    const contentLength = c.req.header("Content-Length");
    if (contentLength !== undefined) {
      const limit = maxBodyBytes(c.req.header("Content-Type"), c.req.path, backupMaxUploadBytes);
      if (Number(contentLength) > limit) {
        return c.json({ error: "Request body is too large.", code: "PAYLOAD_TOO_LARGE" }, 413);
      }
    }

    await next();
  });
}
