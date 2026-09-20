import { posix } from "node:path";
import { StageError } from "@statements/engine/errors";
import { BlobReader, type FileEntry, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js";

export class ZipArchiveError extends StageError {
  constructor(message: string) {
    super(message);
    this.name = "ZipArchiveError";
  }
}

export class ZipPasswordError extends ZipArchiveError {
  constructor(cause?: unknown) {
    super("configured password(s) did not open zip archive (also tried empty password)");
    this.cause = cause;
    this.name = "ZipPasswordError";
  }
}

export class ZipNoCsvError extends ZipArchiveError {
  constructor() {
    super("zip archive contains no csv files");
    this.name = "ZipNoCsvError";
  }
}

export class ZipNoStatementFilesError extends ZipArchiveError {
  constructor() {
    super("zip archive contains no statement files");
    this.name = "ZipNoStatementFilesError";
  }
}

export type ExtractedCsv = {
  innerName: string;
  content: Buffer;
};

export function sanitizeZipMemberName(name: string): string {
  const normalized = posix.normalize(name.replaceAll("\\", "/"));
  const parts = normalized.split("/").filter((part) => part.length > 0);
  if (parts.length === 0 || normalized === "." || normalized === "..") {
    return "attachment";
  }
  const leaf = parts[parts.length - 1] ?? "attachment";
  if (leaf === "" || leaf === "." || leaf === "..") {
    return "attachment";
  }
  return leaf;
}

function isSafeZipMember(name: string): boolean {
  const normalized = name.replaceAll("\\", "/");
  if (normalized.startsWith("../") || normalized.startsWith("/")) {
    return false;
  }
  const parts = normalized.split("/").filter((part) => part.length > 0);
  if (parts.includes("..")) {
    return false;
  }
  if (parts[0] === "__MACOSX") {
    return false;
  }
  return !parts.some((part) => part.startsWith("."));
}

function isCsvMember(name: string): boolean {
  return sanitizeZipMemberName(name).toLowerCase().endsWith(".csv");
}

function isPdfMember(name: string): boolean {
  return sanitizeZipMemberName(name).toLowerCase().endsWith(".pdf");
}

function isStatementMember(name: string): boolean {
  return isCsvMember(name) || isPdfMember(name);
}

export function passwordCandidates(passwords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [""];
  seen.add("");
  for (const password of passwords) {
    if (!seen.has(password)) {
      seen.add(password);
      out.push(password);
    }
  }
  return out;
}

const ZIP_ENTRY_READ_TIMEOUT_MS = 2_000;

function zipEntryReadTimedOut(password: string): ZipArchiveError {
  return new ZipArchiveError(password ? "bad password" : "encrypted zip member requires password");
}

async function readZipEntryData(
  entry: FileEntry,
  writer: Uint8ArrayWriter,
  password: string
): Promise<Uint8Array> {
  const read = entry.getData(writer, password ? { password } : undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(zipEntryReadTimedOut(password)), ZIP_ENTRY_READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([read, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function extractZipEntry(
  entry: Awaited<ReturnType<ZipReader<BlobReader>["getEntries"]>>[number],
  password: string
): Promise<ExtractedCsv> {
  if (entry.directory || !("getData" in entry)) {
    throw new ZipArchiveError(`zip entry is not a file: ${entry.filename}`);
  }
  const writer = new Uint8ArrayWriter();
  try {
    const bytes = await readZipEntryData(entry as FileEntry, writer, password);
    return {
      innerName: sanitizeZipMemberName(entry.filename),
      content: Buffer.from(bytes),
    };
  } catch (error) {
    if (error instanceof ZipArchiveError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/password|encrypted|decrypt/i.test(message)) {
      throw new ZipArchiveError(
        password ? "bad password" : "encrypted zip member requires password"
      );
    }
    throw new ZipArchiveError(message);
  }
}

function rethrowExtractMembersError(error: unknown): never {
  if (error instanceof ZipArchiveError) {
    throw error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/unsafe filename/i.test(message)) {
    throw new ZipArchiveError(message);
  }
  if (/invalid.*zip|not a zip|corrupt|not recognized|file format/i.test(message)) {
    throw new ZipArchiveError(`invalid zip archive: ${message}`);
  }
  throw new ZipArchiveError(message);
}

function isFatalZipArchiveError(error: ZipArchiveError): boolean {
  if (error.message.includes("invalid zip archive")) {
    return true;
  }
  if (/unsafe filename/i.test(error.message)) {
    return true;
  }
  return false;
}

async function extractMembers(
  data: Buffer,
  password: string,
  isTarget: (name: string) => boolean
): Promise<ExtractedCsv[]> {
  const reader = new ZipReader(new BlobReader(new Blob([data])));
  try {
    const entries = await reader.getEntries();
    const extracted: ExtractedCsv[] = [];

    for (const entry of entries) {
      if (entry.directory) {
        continue;
      }
      const name = entry.filename;
      if (!isSafeZipMember(name) || !isTarget(name)) {
        continue;
      }
      extracted.push(await extractZipEntry(entry, password));
    }

    if (extracted.length === 0) {
      throw new ZipArchiveError("zip archive contains no statement files");
    }

    return extracted;
  } catch (error) {
    rethrowExtractMembersError(error);
  } finally {
    await reader.close();
  }
}

function handleZipPasswordAttempt(error: ZipArchiveError, noMembersError: ZipArchiveError): void {
  if (error.message.includes("no statement files") || error.message.includes("no csv")) {
    throw noMembersError;
  }
  if (isFatalZipArchiveError(error)) {
    throw error;
  }
}

async function extractWithPasswords(
  data: Buffer,
  passwords: string[],
  isTarget: (name: string) => boolean,
  noMembersError: ZipArchiveError
): Promise<ExtractedCsv[]> {
  const candidates = passwordCandidates(passwords);
  let lastError: ZipArchiveError | undefined;

  for (const password of candidates) {
    try {
      return await extractMembers(data, password, isTarget);
    } catch (error) {
      if (error instanceof ZipArchiveError) {
        handleZipPasswordAttempt(error, noMembersError);
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    throw new ZipPasswordError(lastError);
  }
  throw noMembersError;
}

export async function extractCsvsFromZip(
  data: Buffer,
  passwords: string[]
): Promise<ExtractedCsv[]> {
  return extractWithPasswords(data, passwords, isCsvMember, new ZipNoCsvError());
}

export async function extractStatementsFromZip(
  data: Buffer,
  passwords: string[]
): Promise<ExtractedCsv[]> {
  return extractWithPasswords(data, passwords, isStatementMember, new ZipNoStatementFilesError());
}
